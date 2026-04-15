# Retail Management

FastAPI + React retail and tailoring management app with billing, settlements,
job work tracking, labour payments, reporting, import/export, audit, and repair tools.

## Setup

### 1. Environment Variables

**Backend** – copy and edit:
```bash
cp backend/.env.example backend/.env
```

Required variables in `backend/.env`:
```
MONGO_URL=mongodb://localhost:27017
DB_NAME=retail_db
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
API_KEY=your-secret-key   # protects backup/restore/normalize/repair
```

**Frontend** – copy and edit:
```bash
cp frontend/.env.example frontend/.env
```

Required variable in `frontend/.env`:
```
REACT_APP_BACKEND_URL=http://127.0.0.1:8001
```

### 2. Backend

**Linux / macOS**:
```bash
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --host 127.0.0.1 --port 8001
```

**Windows**:
```powershell
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
uvicorn server:app --host 127.0.0.1 --port 8001
```

### 3. Frontend

```bash
cd frontend
yarn install
yarn start
```

The frontend defaults to `http://127.0.0.1:8001` if `REACT_APP_BACKEND_URL` is not set.

## Regression Suite

Run the local regression checks against a running backend:

**Linux / macOS**:
```bash
python tests/local_regression_suite.py
# Optional custom base URL:
python tests/local_regression_suite.py http://127.0.0.1:8001/api
```

**Windows**:
```powershell
python tests\local_regression_suite.py
```

## Data Quality Tools

Open **Data Manager** in the UI for:

- Excel import/export
- backup/restore (requires `X-API-Key` header when `API_KEY` is set)
- data audit
- low-risk normalization (requires `X-API-Key` header when `API_KEY` is set)
- repair of remaining overpayment anomalies (requires `X-API-Key` header when `API_KEY` is set)

Backend endpoints:

- `GET /api/db/audit`
- `POST /api/db/normalize`
- `POST /api/db/repair`
- `GET /api/backup`
- `POST /api/restore`

When `API_KEY` is configured, all mutating data-management endpoints require the header:
```
X-API-Key: your-secret-key
```