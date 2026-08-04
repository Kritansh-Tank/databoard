import io
import math
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.deps import get_current_user
from app import models, schemas

router = APIRouter(prefix="/dataset", tags=["dataset"])


# ── Upload CSV ────────────────────────────────────────────────────────────────

@router.post("", response_model=schemas.DatasetOut, status_code=status.HTTP_201_CREATED)
def upload_dataset(
    name: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Upload a CSV file and store its rows as JSONB in PostgreSQL."""
    if not file.filename.endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are supported")

    contents = file.file.read()
    try:
        df = pd.read_csv(io.StringIO(contents.decode("utf-8")))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to parse CSV: {str(e)}")

    if len(df) > 100_000:
        raise HTTPException(
            status_code=400,
            detail=f"CSV too large: {len(df):,} rows. Maximum allowed is 100,000 rows.",
        )

    # Replace NaN / Inf with None so PostgreSQL JSON accepts it.
    # Python's json module silently allows NaN but PostgreSQL rejects it.
    # We check each value explicitly — this is the only reliable approach.
    def _safe(val):
        if isinstance(val, float) and not math.isfinite(val):
            return None
        return val

    dataset = models.Dataset(
        user_id=current_user.id,
        name=name.strip(),
        row_count=len(df),
    )
    db.add(dataset)
    db.flush()  # Get dataset.id without committing

    rows = [
        models.DatasetRow(
            dataset_id=dataset.id,
            row_index=i,
            data={k: _safe(v) for k, v in row.items()},
        )
        for i, row in df.iterrows()
    ]
    db.bulk_save_objects(rows)
    db.commit()
    db.refresh(dataset)
    return dataset


# ── List Datasets (paginated) ─────────────────────────────────────────────────

@router.get("", response_model=schemas.DatasetListOut)
def list_datasets(
    page: int = 1,
    limit: int = 10,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return paginated list of datasets for the authenticated user."""
    if page < 1:
        page = 1
    if limit < 1 or limit > 100:
        limit = 10

    offset = (page - 1) * limit
    query = db.query(models.Dataset).filter(models.Dataset.user_id == current_user.id)
    total = query.count()
    datasets = query.order_by(models.Dataset.created_at.desc()).offset(offset).limit(limit).all()

    return {
        "datasets": datasets,
        "total": total,
        "page": page,
        "limit": limit,
        "total_pages": math.ceil(total / limit) if total > 0 else 1,
    }


# ── Preview (first 25 rows) ───────────────────────────────────────────────────

@router.get("/{dataset_id}/preview", response_model=schemas.PreviewOut)
def preview_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return the first 25 rows and column names of a dataset."""
    dataset = _get_owned_dataset(dataset_id, current_user.id, db)

    rows = (
        db.query(models.DatasetRow)
        .filter(models.DatasetRow.dataset_id == dataset.id)
        .order_by(models.DatasetRow.row_index)
        .limit(25)
        .all()
    )

    if not rows:
        return {"columns": [], "rows": []}

    columns = list(rows[0].data.keys())
    return {"columns": columns, "rows": [r.data for r in rows]}


# ── Delete ────────────────────────────────────────────────────────────────────

@router.delete("/{dataset_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_dataset(
    dataset_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Permanently delete a dataset and all its rows."""
    dataset = _get_owned_dataset(dataset_id, current_user.id, db)
    db.delete(dataset)
    db.commit()


# ── Compute Statistic ─────────────────────────────────────────────────────────

@router.post("/{dataset_id}/compute", response_model=schemas.ComputeOut)
def compute_stat(
    dataset_id: int,
    payload: schemas.ComputeRequest,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """
    Compute min, max, or sum on a numeric column.

    Edge cases handled:
    - Column does not exist → 400
    - Non-numeric column → 400
    - No rows → result=null with message
    - All values null → result=null with message
    """
    dataset = _get_owned_dataset(dataset_id, current_user.id, db)

    if payload.operation not in ("min", "max", "sum"):
        raise HTTPException(status_code=400, detail="operation must be 'min', 'max', or 'sum'")

    rows = (
        db.query(models.DatasetRow)
        .filter(models.DatasetRow.dataset_id == dataset.id)
        .all()
    )

    # Edge case: no rows at all
    if not rows:
        return {"column": payload.column, "operation": payload.operation,
                "result": None, "message": "No data in column"}

    # Check column exists
    sample_keys = list(rows[0].data.keys())
    if payload.column not in sample_keys:
        raise HTTPException(
            status_code=400,
            detail=f"Column '{payload.column}' not found. Available: {sample_keys}",
        )

    # Extract values — treat float NaN (from pandas) as null
    def _is_null(v) -> bool:
        if v is None:
            return True
        try:
            return math.isnan(float(v))
        except (TypeError, ValueError):
            return False

    values = [r.data.get(payload.column) for r in rows]

    # Edge case: all null (or NaN)
    non_null = [v for v in values if not _is_null(v)]
    if not non_null:
        return {"column": payload.column, "operation": payload.operation,
                "result": None, "message": "All values are null", "error": None}

    # Edge case: non-numeric column
    try:
        numeric_values = [float(v) for v in non_null]
    except (ValueError, TypeError):
        return {
            "column": payload.column,
            "operation": payload.operation,
            "result": None,
            "error": f"Column '{payload.column}' is not numeric",
        }

    # Compute
    if payload.operation == "min":
        result = min(numeric_values)
    elif payload.operation == "max":
        result = max(numeric_values)
    else:
        result = sum(numeric_values)

    # Guard: if result is somehow NaN/inf, return null
    if isinstance(result, float) and not math.isfinite(result):
        return {"column": payload.column, "operation": payload.operation,
                "result": None, "message": "Result is not a finite number", "error": None}

    return {"column": payload.column, "operation": payload.operation, "result": result, "error": None}


# ── Plot Data ─────────────────────────────────────────────────────────────────

@router.get("/{dataset_id}/plot", response_model=schemas.PlotOut)
def plot_data(
    dataset_id: int,
    col1: str,
    col2: str,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Return first 30 values of two columns for ECharts plotting."""
    dataset = _get_owned_dataset(dataset_id, current_user.id, db)

    rows = (
        db.query(models.DatasetRow)
        .filter(models.DatasetRow.dataset_id == dataset.id)
        .order_by(models.DatasetRow.row_index)
        .limit(30)
        .all()
    )

    if not rows:
        raise HTTPException(status_code=404, detail="No data found in dataset")

    sample_keys = list(rows[0].data.keys())
    for col in (col1, col2):
        if col not in sample_keys:
            raise HTTPException(
                status_code=400,
                detail=f"Column '{col}' not found. Available: {sample_keys}",
            )

    data = [{"col1": r.data.get(col1), "col2": r.data.get(col2)} for r in rows]
    return {"col1": col1, "col2": col2, "data": data}


# ── Helper ────────────────────────────────────────────────────────────────────

def _get_owned_dataset(dataset_id: int, user_id: int, db: Session) -> models.Dataset:
    """Fetch a dataset and verify it belongs to the current user."""
    dataset = db.query(models.Dataset).filter(models.Dataset.id == dataset_id).first()
    if not dataset:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if dataset.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to access this dataset")
    return dataset
