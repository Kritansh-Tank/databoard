from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.database import Base, engine
from app.routers import auth, dataset

# Create all tables on startup (idempotent — safe to run multiple times)
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="DataBoard API",
    description="Upload CSVs, compute stats, and visualise data.",
    version="1.0.0",
)

# ── CORS ──────────────────────────────────────────────────────────────────────
# Allow Angular dev server and the CloudFront domain in production
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:4200",          # Angular dev
        "http://databoard-frontend-kritansh.s3-website-us-east-1.amazonaws.com",  # S3
        "https://d2bnceyxxb14a6.cloudfront.net",  # Frontend CloudFront (HTTPS)
        "https://d1e2ji77wggvgr.cloudfront.net",   # Backend CloudFront self-reference
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ───────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(dataset.router)


@app.get("/health", tags=["health"])
def health_check():
    return {"status": "ok"}


@app.get("/", tags=["health"])
def root():
    return {"message": "DataBoard API is up 🚀", "docs": "/docs", "health": "/health"}
