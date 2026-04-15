# Retail Management

FastAPI + React retail and tailoring management app with billing, settlements,
job work tracking, labour payments, reporting, import/export, audit, and repair tools.

## Environment Setup

Copy the example files and fill in your values before running:

```powershell
# Backend
copy backend\.env.example backend\.env

# Frontend
copy frontend\.env.sample frontend\.env
```

### Backend environment variables (`backend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `MONGO_URL` | yes | — | MongoDB connection string |
| `DB_NAME` | no | `retail` | MongoDB database name |
| `CORS_ORIGINS` | no | `*` | Comma-separated allowed origins |
| `BACKUP_API_KEY` | no | _(disabled)_ | Secret key required in `X-Api-Key` header for backup/restore endpoints |

### Frontend environment variables (`frontend/.env`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `REACT_APP_BACKEND_URL` | yes | — | Base URL of the running FastAPI backend |

## Local Run

**Backend:**

```powershell
cd backend
venv\Scripts\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8001
```

**Frontend:**

```powershell
cd frontend
yarn start
```

The frontend `.env` should contain:

```text
REACT_APP_BACKEND_URL=http://127.0.0.1:8001
```

## Regression Suite

Run the local regression checks against a running backend:

```powershell
python tests\local_regression_suite.py
```

Optional custom base URL:

```powershell
python tests\local_regression_suite.py http://127.0.0.1:8001/api
```

## Data Quality Tools

Open `Data Manager` in the UI for:

- Excel import/export
- backup/restore
- data audit
- low-risk normalization
- repair of remaining overpayment anomalies

Backend endpoints:

- `GET /api/db/audit`
- `POST /api/db/normalize`
- `POST /api/db/repair`

## Seeding Initial Data

To import from an existing `.xlsm` workbook, call:

```
POST /api/seed?file_path=/path/to/retail_book.xlsm
```

The endpoint is a no-op if the database already contains items.

## Backup & Restore

`GET /api/backup` and `POST /api/restore` require an `X-Api-Key` header when
`BACKUP_API_KEY` is set in the backend environment. Leave `BACKUP_API_KEY` blank
to skip authentication (development only).