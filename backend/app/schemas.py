from pydantic import BaseModel, EmailStr
from datetime import datetime
from typing import Optional, Any


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserRegister(BaseModel):
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class TokenData(BaseModel):
    user_id: Optional[int] = None


# ── Dataset ───────────────────────────────────────────────────────────────────

class DatasetOut(BaseModel):
    id: int
    name: str
    row_count: int
    created_at: datetime

    class Config:
        from_attributes = True


class DatasetListOut(BaseModel):
    datasets: list[DatasetOut]
    total: int
    page: int
    limit: int
    total_pages: int


class PreviewOut(BaseModel):
    columns: list[str]
    rows: list[dict[str, Any]]


class ComputeRequest(BaseModel):
    column: str
    operation: str  # "min" | "max" | "sum"


class ComputeOut(BaseModel):
    column: str
    operation: str
    result: Optional[float] = None
    message: Optional[str] = None
    error: Optional[str] = None


class PlotOut(BaseModel):
    col1: str
    col2: str
    data: list[dict[str, Any]]
