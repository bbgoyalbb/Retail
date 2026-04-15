# Retail Management

FastAPI + React retail and tailoring management app with billing, settlements,
job work tracking, labour payments, reporting, import/export, audit, and repair tools.

## Local Run

Backend:

```powershell
cd D:\Retail Code\Retail\backend
venv\Scripts\python.exe -m uvicorn server:app --host 127.0.0.1 --port 8001
```

Frontend:

```powershell
cd D:\Retail Code\Retail\frontend
yarn start
```

The frontend is configured for local development against:

```text
http://127.0.0.1:8001
```

## Regression Suite

Run the local regression checks against a running backend:

```powershell
cd D:\Retail Code\Retail
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
