"""
Integration tests for POST /dataset/{id}/compute

Covers the three edge cases required by the spec:
  1. Empty column (no rows at all)
  2. All-null column
  3. Non-numeric column requested as numeric

Plus three happy-path cases for min, max, sum.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, get_db
from app.auth import hash_password, create_access_token
from app import models

# ── In-memory SQLite DB for tests (no RDS needed) ────────────────────────────
SQLITE_URL = "sqlite:///./test_databoard.db"

engine = create_engine(SQLITE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


@pytest.fixture(autouse=True)
def setup_db():
    """Create tables before each test, drop after."""
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def auth_headers(client):
    """Register a test user and return auth headers."""
    client.post("/auth/register", json={"email": "test@example.com", "password": "testpass123"})
    resp = client.post("/auth/login", json={"email": "test@example.com", "password": "testpass123"})
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def dataset_with_rows(auth_headers, client):
    """Upload a sample CSV and return the dataset id."""
    csv_content = "name,age,score\nAlice,30,95.5\nBob,25,87.0\nCharlie,,\n"
    resp = client.post(
        "/dataset",
        headers=auth_headers,
        data={"name": "test_dataset"},
        files={"file": ("sample.csv", csv_content.encode(), "text/csv")},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


@pytest.fixture
def empty_dataset(auth_headers, client):
    """Upload a CSV with only a header row (no data rows)."""
    csv_content = "name,age,score\n"
    resp = client.post(
        "/dataset",
        headers=auth_headers,
        data={"name": "empty_dataset"},
        files={"file": ("empty.csv", csv_content.encode(), "text/csv")},
    )
    assert resp.status_code == 201, resp.text
    return resp.json()["id"]


# ── Edge Case 1: Empty column (dataset has no rows) ───────────────────────────

def test_compute_empty_dataset(client, auth_headers, empty_dataset):
    """When a dataset has no rows, result should be null with an informative message."""
    resp = client.post(
        f"/dataset/{empty_dataset}/compute",
        headers=auth_headers,
        json={"column": "score", "operation": "min"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["result"] is None
    assert "message" in body
    assert body["error"] is None


# ── Edge Case 2: All-null column ──────────────────────────────────────────────

def test_compute_all_null_column(client, auth_headers, dataset_with_rows):
    """When every value in a column is null, result should be null with a message."""
    # 'score' for Charlie is null, but Alice and Bob have values.
    # Use 'age' which has a null for Charlie — but two non-null values exist.
    # Instead, create a dataset where ALL score values are null.
    csv_content = "name,score\nAlice,\nBob,\n"
    resp = client.post(
        "/dataset",
        headers=auth_headers,
        data={"name": "all_null_dataset"},
        files={"file": ("nulls.csv", csv_content.encode(), "text/csv")},
    )
    ds_id = resp.json()["id"]

    resp = client.post(
        f"/dataset/{ds_id}/compute",
        headers=auth_headers,
        json={"column": "score", "operation": "sum"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["result"] is None
    assert "message" in body
    assert body["error"] is None


# ── Edge Case 3: Non-numeric column requested as numeric ──────────────────────

def test_compute_non_numeric_column(client, auth_headers, dataset_with_rows):
    """Requesting min/max/sum on a text column should return an error, not crash."""
    resp = client.post(
        f"/dataset/{dataset_with_rows}/compute",
        headers=auth_headers,
        json={"column": "name", "operation": "sum"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["result"] is None
    assert "error" in body
    assert "not numeric" in body["error"].lower()


# ── Happy Path: min ───────────────────────────────────────────────────────────

def test_compute_min(client, auth_headers, dataset_with_rows):
    resp = client.post(
        f"/dataset/{dataset_with_rows}/compute",
        headers=auth_headers,
        json={"column": "age", "operation": "min"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["result"] == 25.0
    assert body["error"] is None


# ── Happy Path: max ───────────────────────────────────────────────────────────

def test_compute_max(client, auth_headers, dataset_with_rows):
    resp = client.post(
        f"/dataset/{dataset_with_rows}/compute",
        headers=auth_headers,
        json={"column": "score", "operation": "max"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["result"] == 95.5
    assert body["error"] is None


# ── Happy Path: sum ───────────────────────────────────────────────────────────

def test_compute_sum(client, auth_headers, dataset_with_rows):
    resp = client.post(
        f"/dataset/{dataset_with_rows}/compute",
        headers=auth_headers,
        json={"column": "age", "operation": "sum"},
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["result"] == 55.0  # 30 + 25 (Charlie's age is null, skipped)
    assert body["error"] is None
