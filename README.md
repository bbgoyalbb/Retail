# Retail Book — Fabric & Tailoring Management System

A full-featured retail management system for fabric shops and tailoring businesses.
Handles billing, settlements, tailoring order tracking, embroidery job work, labour payments,
daily reconciliation, reporting, and more.

## Features

- **Billing** — Create multi-item bills with fabric, tailoring, embroidery, and add-on charges
- **Settlements** — Allocate payments across categories; auto-distribute with advance support
- **Daybook** — Daily reconciliation with tally tracking and summary bar; defaults to today
- **Reports** — Revenue and customer analytics with date presets and Excel export
- **Order Status** — Status board grouped by order number; one-click Mark as Delivered
- **Tailoring Orders** — Assign order numbers, delivery dates, and split articles
- **Job Work** — Track embroidery through in-progress and finished stages
- **Labour Payments** — Pay karigars by type with date tracking
- **Search** — Full-text search across all bills with date presets and customer drill-down
- **Settings** — Configure article types, tailoring rates, payment modes, add-on items, firm details
- **Audit Log** — Complete action history for all users
- **Data Manager** — Excel import/export, backup/restore, audit and repair tools

## Keyboard Shortcuts

| Page | Shortcut | Action |
|---|---|---|
| New Bill | `Ctrl+S` | Save bill |
| Manage Orders | `Ctrl+F` | Focus customer filter |

## Stack

- **Backend:** Python 3, FastAPI, Motor (async MongoDB driver)

- **Frontend:** React 19, React Router 7, Axios, Tailwind CSS, shadcn/ui, Recharts

- **Database:** MongoDB



## Setup



### 1. Backend



Copy the example env file and fill in your values:



```bash

cp backend/.env.example backend/.env
# Windows (PowerShell)
copy backend\.env.example backend\.env

```



Required variables in `backend/.env`:



| Variable | Description |

|---|---|

| `MONGO_URL` | MongoDB connection string (e.g. `mongodb://localhost:27017`) |

| `DB_NAME` | MongoDB database name (e.g. `retail_db`) |

| `CORS_ORIGINS` | Comma-separated allowed origins (default: `*` — restrict in production) |

| `ADMIN_API_KEY` | API key protecting backup/restore endpoints (leave blank to disable auth) |

| `SEED_FILE_PATH` | Path to Excel seed file (default: `/tmp/retail_book.xlsm`) |



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



Copy the example env file and fill in your values:



```bash

cp frontend/.env.sample frontend/.env

```



Required variables in `frontend/.env`:



| Variable | Description |

|---|---|

| `REACT_APP_BACKEND_URL` | Backend URL without trailing slash (e.g. `http://127.0.0.1:8001`) |

| `REACT_APP_ENABLE_SEED` | Set to `true` to seed from Excel on first load (dev only, default: `false`) |



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

- Backup/restore (requires `ADMIN_API_KEY` header if configured)

- Data audit

- Low-risk normalization

- Repair of remaining overpayment anomalies



Backend endpoints:



- `GET /api/db/audit`

- `POST /api/db/normalize`

- `POST /api/db/repair`

- `GET /api/backup` — requires `X-Api-Key` header when `ADMIN_API_KEY` is set

- `POST /api/restore` — requires `X-Api-Key` header when `ADMIN_API_KEY` is set