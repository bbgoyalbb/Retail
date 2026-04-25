# Retail Management

FastAPI + React retail and tailoring management app with billing, settlements,
job work tracking, labour payments, reporting, import/export, audit, and repair tools.

## Stack

- **Backend:** Python 3, FastAPI, Motor (async MongoDB driver)
- **Frontend:** React 19, React Router 7, Axios, Tailwind CSS, shadcn/ui, Recharts
- **Database:** MongoDB

## Setup

### 1. Backend

Create a `backend/.env` file (auto-created on first run by batch scripts):

| Variable | Description |
|---|---|
| `MONGO_URL` | MongoDB connection string (e.g. `mongodb://localhost:27017`) |
| `DB_NAME` | MongoDB database name (e.g. `retail_db`) |
| `CORS_ORIGINS` | Comma-separated allowed origins (restrict in production) |
| `JWT_SECRET_KEY` | JWT signing key (auto-generated if missing) |

Install dependencies and start the server:

```bash
# macOS / Linux
cd backend
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn server:app --host 127.0.0.1 --port 8001 --reload
```

```powershell
# Windows
cd backend
python -m venv venv
venv\Scripts\Activate.ps1
pip install -r requirements.txt
uvicorn server:app --host 127.0.0.1 --port 8001 --reload
```

### 2. Frontend

No `.env` file is needed — the frontend auto-detects the backend URL based on the current port.

Install dependencies and start:

```bash
cd frontend
yarn install
yarn start
```

If Yarn is not installed, use npm:

```bash
cd frontend
npm install
npm start
```

## Regression Suite

Run the local regression checks against a running backend:

```bash
# macOS / Linux
python tests/local_regression_suite.py

# With custom base URL
python tests/local_regression_suite.py http://127.0.0.1:8001/api
```

```powershell
# Windows
python tests\local_regression_suite.py
python tests\local_regression_suite.py http://127.0.0.1:8001/api
```

## Data Quality Tools

Open **Data Manager** in the UI for:

- Excel import/export
- Backup/restore (admin role required)
- Data audit
- Low-risk normalization
- Repair of remaining overpayment anomalies

Backend endpoints:

- `GET /api/db/audit`
- `POST /api/db/normalize`
- `POST /api/db/repair`
- `GET /api/backup` — admin role required (JWT auth)
- `POST /api/restore` — admin role required (JWT auth)