# DataBoard — Setup & Deployment Guide

---

## Tech Stack

### Backend
| Library | Version | Purpose |
|---|---|---|
| Python | 3.11 | Runtime |
| FastAPI | 0.115.0 | REST API framework |
| Uvicorn | 0.30.6 | ASGI server |
| SQLAlchemy | 2.0.35 | ORM / database abstraction |
| psycopg2-binary | 2.9.9 | PostgreSQL driver |
| Pydantic | 2.9.2 | Request/response validation |
| pydantic-settings | 2.5.2 | `.env` config loading |
| python-jose | 3.3.0 | JWT creation & verification (HS256) |
| passlib | 1.7.4 | Password hashing (bcrypt backend) |
| bcrypt | 4.0.1 | Bcrypt implementation (pinned for passlib compat) |
| python-multipart | 0.0.12 | CSV file upload support |
| pandas | 2.2.3 | CSV parsing & statistics |
| python-dotenv | 1.0.1 | Load `.env` variables |
| httpx | 0.27.2 | Async HTTP client (used in tests) |
| pytest | 8.3.3 | Test runner |
| pytest-asyncio | 0.24.0 | Async test support |

### Frontend
| Library | Version | Purpose |
|---|---|---|
| Angular | 21.2.0 | SPA framework (standalone components) |
| Angular CLI | 21.2.19 | Build tooling |
| TypeScript | 5.9.2 | Language |
| Tailwind CSS | 3.4.19 | Utility-first CSS |
| @lucide/angular | 1.28.0 | SVG icon library |
| echarts | 6.1.0 | Chart rendering engine |
| ngx-echarts | 21.0.0 | Angular wrapper for ECharts |
| zone.js | 0.16.2 | Angular change detection |
| RxJS | 7.8.x | Reactive streams |
| Node.js | 24.10.0 | JavaScript runtime |
| npm | 10.9.4 | Package manager |

### Infrastructure
| Service | Config | Purpose |
|---|---|---|
| AWS RDS PostgreSQL | db.t4g.micro, 20 GiB gp2 | Database (Free tier) |
| AWS EC2 | t3.micro, Ubuntu 26.04 LTS, 8 GiB gp3 | Backend hosting (Free tier) |
| AWS S3 | us-east-1 | Frontend static hosting |
| AWS CloudFront | — | CDN + HTTPS for frontend |

---

## Prerequisites

| Tool | Required Version | Install |
|---|---|---|
| Python | ≥ 3.11 | python.org |
| Node.js | 24.10.0 (≥ 18) | nodejs.org |
| Angular CLI | ≥ 21 | `npm install -g @angular/cli@21` |
| AWS Account | Free tier | aws.amazon.com |

---

## 1. Database — AWS RDS PostgreSQL

### Create RDS Instance
1. AWS Console → **RDS** → **Create database**
2. Engine: **PostgreSQL** · Template: **Free tier**
3. DB identifier: `databoard-db`
4. Master username: `dbadmin` · Set a strong password
5. **Publicly accessible: Yes**
6. Click **Create** (takes ~5 min)

### Open Port 5432
- Go to RDS instance → **Connectivity & security** → click the VPC security group
- **Inbound rules** → **Edit** → Add rule:
  - Type: `PostgreSQL` · Port: `5432` · Source: `0.0.0.0/0`

### Get Connection String
```
postgresql://dbadmin:<password>@<your-endpoint>.rds.amazonaws.com:5432/databoard
```
> ⚠️ Use `databoard` (not `postgres`) — this is the **Initial database name** set during RDS creation.

**Example (project RDS):**
```
postgresql://dbadmin:<password>@databoard-db.cixyeakci7ph.us-east-1.rds.amazonaws.com:5432/databoard
```

---

## 2. Backend — Local Development

```powershell
cd k:\Web-apps\xVector\backend

# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Create .env from template
copy .env.example .env
# Edit .env — paste your RDS connection string and a random SECRET_KEY

# Start the API server (tables are auto-created on startup)
uvicorn app.main:app --reload
```

- API runs at: **http://localhost:8000**
- Auto-docs: **http://localhost:8000/docs**

### Generate a SECRET_KEY
```powershell
python -c "import secrets; print(secrets.token_hex(32))"
```
> Copy the output into `SECRET_KEY=` in `.env`. Do **not** use this value as a login password.

### bcrypt compatibility note
`requirements.txt` pins `bcrypt==4.0.1` explicitly alongside `passlib[bcrypt]==1.7.4`.
Newer bcrypt (5.x) removes `__about__` which breaks passlib — the pin prevents this.

> ⚠️ User account passwords must be **< 72 characters** (bcrypt hard limit).

---

## 3. Frontend — Local Development

```powershell
cd k:\Web-apps\xVector\frontend

# Install dependencies
npm install --legacy-peer-deps

# Start dev server
ng serve
```

- App runs at: **http://localhost:4200**
- Talks to backend at: `http://localhost:8000` (set in `src/environments/environment.ts`)

### Troubleshooting: blank screen / Zone.js error
If you see `NG0908: Angular requires Zone.js` or a blank page:
```powershell
# Clear the Vite build cache and restart
Remove-Item -Recurse -Force .angular
ng serve
```
`zone.js` is declared in `angular.json` under `polyfills` and installed as an npm package.

---

## 4. Run Tests

```powershell
cd k:\Web-apps\xVector\backend
.\venv\Scripts\activate
pytest tests/test_compute.py -v
```

Tests use **SQLite** (`test_databoard.db`) — no RDS connection required.
Tables are created fresh before each test and dropped after, so tests are fully isolated.

> A `test_databoard.db` file is created in the `backend/` directory after the first run — it is safe to delete and is covered by `.gitignore`.

**Expected output:**
```
PASSED tests/test_compute.py::test_compute_empty_dataset
PASSED tests/test_compute.py::test_compute_all_null_column
PASSED tests/test_compute.py::test_compute_non_numeric_column
PASSED tests/test_compute.py::test_compute_min
PASSED tests/test_compute.py::test_compute_max
PASSED tests/test_compute.py::test_compute_sum
6 passed, 3 warnings in ~10s
```

---

## 5. CSV Storage & Validation

### How CSV data is stored

The raw CSV file is **never stored on disk**. On upload it is:

1. Read into memory by `pandas.read_csv()`
2. NaN values replaced with `None` (so JSON stays valid)
3. Each row converted to a dict and saved as a `JSON` column in the `dataset_rows` table

```
Alice,30,95000  →  DatasetRow(data={"name":"Alice","age":30,"salary":95000})
Bob,25,null     →  DatasetRow(data={"name":"Bob","age":25,"salary":null})
```

Because the storage is schema-less JSON, **any column names and any mix of types** are accepted — the schema is inferred from the file itself.

### Validation & error handling

| Scenario | Backend response | Frontend display |
|---|---|---|
| Not a `.csv` file | `400 Only CSV files are supported` | Red alert under file picker |
| Unreadable / corrupt CSV | `400 Failed to parse CSV: <reason>` | Red alert with reason |
| CSV > 100,000 rows | `400 CSV too large: X rows. Max 100,000` | Red alert with row count |
| Column not found in compute | `400 Column 'X' not found. Available: [...]` | Error in compute panel |
| Non-numeric column in compute | `200 result=null, error="not numeric"` | Shown inline in stat card |
| All-null column in compute | `200 result=null, message="All values are null"` | Shown inline in stat card |
| Empty dataset | `200 result=null, message="No data in column"` | Shown inline in stat card |

All `400` errors from FastAPI carry a `{ "detail": "..." }` body. The Angular upload handler reads `err.error?.detail` and shows it directly in the UI — no additional frontend mapping needed.

---

## 6. JWT Authentication Strategy

- **Algorithm**: HS256
- **Expiry**: 1 hour (`ACCESS_TOKEN_EXPIRE_MINUTES=60` in `.env`)
- **Storage**: `localStorage` key `databoard_token`
- **Injection**: An Angular `HttpInterceptor` automatically adds `Authorization: Bearer <token>` to every API request
- **Re-login strategy**: When any API call returns HTTP 401 (expired or invalid token), the interceptor clears the token from localStorage and redirects the user to `/login`. There are no refresh tokens — the user simply logs in again. This is intentional for simplicity and is appropriate for a data analytics tool where sessions are typically short-lived.

---

## 7. AWS Production Deployment

### Step A — Backend on EC2

```powershell
# Launch EC2: Ubuntu 26.04 LTS, t3.micro, allow ports 22 + 8000 in security group
# SSH into it:
ssh -i your-key.pem ubuntu@<ec2-ip>
```

```bash
# On EC2:
sudo apt update && sudo apt install -y python3-pip python3-venv git

git clone https://github.com/Kritansh-Tank/databoard.git
cd databoard/backend

python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt

# Create .env with RDS values
nano .env

# Run (detached with nohup, or set up systemd)
nohup uvicorn app.main:app --host 0.0.0.0 --port 8000 &
```

### Step B — Frontend on S3 + CloudFront

```powershell
# Edit production API URL first
# k:\Web-apps\xVector\frontend\src\environments\environment.prod.ts
# Set apiUrl to: http://<your-ec2-ip>:8000

cd k:\Web-apps\xVector\frontend
ng build --configuration=production
# Output in: dist/frontend/browser/

# Create S3 bucket — name must be globally unique
# Use same region as your RDS (us-east-1)
aws s3 mb s3://databoard-frontend-<yourname> --region us-east-1
aws s3 website s3://databoard-frontend-<yourname> --index-document index.html --error-document index.html

# Upload build
# Note: --acl public-read is deprecated; use bucket policy for public access instead
aws s3 sync dist/frontend/browser/ s3://databoard-frontend-<yourname>

# Create CloudFront distribution pointing to S3
# → AWS Console → CloudFront → Create Distribution → Origin: your S3 bucket
# → Default root object: index.html
# → Error pages: 403/404 → /index.html (for Angular routing)
```

### Update CORS on Backend

In `backend/app/main.py`, update `allow_origins` with your CloudFront URL:
```python
allow_origins=[
    "http://localhost:4200",
    "https://<your-cloudfront-id>.cloudfront.net",
]
```

---

## 8. Sample Data

`sample_data.csv` (included in repo root) has **30 rows** with columns:
- `name` (text), `age` (numeric), `salary` (numeric), `department` (text),
- `years_experience` (numeric), `performance_score` (numeric), `is_remote` (text)

Use this to demo all features including pagination (upload it multiple times to create >1 page).

---

## 9. Project Constraints

> **README.md** and **ProjectSpec.md** have not been renamed, modified, or deleted as required.

---

## 10. Architecture Summary

```
Browser (Angular)
    │
    ├── CloudFront → S3   [production]
    └── localhost:4200    [development]
         │
         │  JWT Bearer token (every request)
         ▼
     FastAPI (Python)
     EC2 t2.micro / localhost:8000
         │
         │  SQLAlchemy + psycopg2
         ▼
     PostgreSQL
     AWS RDS db.t4g.micro
```
