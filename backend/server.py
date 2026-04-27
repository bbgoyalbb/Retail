"""
Retail Management API — entry point.

All route logic lives in routers/. This file handles:
  - App + DB setup
  - Middleware
  - Static file serving
  - Startup / shutdown lifecycle
"""
from fastapi import FastAPI, Request
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware
from starlette.middleware.gzip import GZipMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os
import logging
from pathlib import Path

import auth as auth_module  # noqa: F401 — imported for side-effects (security obj)

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

# ==========================================
# DATABASE
# ==========================================
mongo_url = os.environ.get("MONGO_URL")
db_name = os.environ.get("DB_NAME")
if not mongo_url:
    raise RuntimeError(
        "MONGO_URL is not set. Add it to backend/.env before starting the server."
    )
if not db_name:
    raise RuntimeError(
        "DB_NAME is not set. Add it to backend/.env before starting the server."
    )

client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# Inject db into the shared deps module BEFORE any router is imported.
# We use importlib to load routers/deps.py in isolation — this avoids
# triggering routers/__init__.py (which imports all routers, each of which
# does `from .deps import db` at module level and would copy the None value).
import importlib, importlib.util, sys  # noqa: E402
_spec = importlib.util.spec_from_file_location(
    "routers.deps", ROOT_DIR / "routers" / "deps.py"
)
_deps = importlib.util.module_from_spec(_spec)
sys.modules["routers.deps"] = _deps  # register before routers load
_spec.loader.exec_module(_deps)
_deps.set_db(db)

# ==========================================
# APP
# ==========================================
_debug = os.environ.get("DEBUG", "false").lower() == "true"
app = FastAPI(
    title="Retail Management API",
    version="2.0.0",
    docs_url="/docs" if _debug else None,
    redoc_url=None,
    openapi_url="/openapi.json" if _debug else None,
)

# Max upload size: 50 MB
MAX_UPLOAD_SIZE = 50 * 1024 * 1024

# ==========================================
# LOGGING
# ==========================================
log_file = ROOT_DIR / "server.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(log_file, encoding="utf-8"),
    ],
)
logger = logging.getLogger(__name__)

# Suppress WinError 10054 noise (browser forcibly closes SSL on Windows)
logging.getLogger("asyncio").setLevel(logging.CRITICAL)

# ==========================================
# ROUTERS
# ==========================================
from routers import (  # noqa: E402
    bills_router, tailoring_router, jobwork_router,
    settlements_router, daybook_router, labour_router,
    advances_router, orders_router, items_router,
    reports_router, data_router, auth_router,
)

PREFIX = "/api"
app.include_router(bills_router,       prefix=PREFIX)
app.include_router(tailoring_router,   prefix=PREFIX)
app.include_router(jobwork_router,     prefix=PREFIX)
app.include_router(settlements_router, prefix=PREFIX)
app.include_router(daybook_router,     prefix=PREFIX)
app.include_router(labour_router,      prefix=PREFIX)
app.include_router(advances_router,    prefix=PREFIX)
app.include_router(orders_router,      prefix=PREFIX)
app.include_router(items_router,       prefix=PREFIX)
app.include_router(reports_router,     prefix=PREFIX)
app.include_router(data_router,        prefix=PREFIX)
app.include_router(auth_router,        prefix=PREFIX)

# ==========================================
# MIDDLEWARE
# ==========================================
app.add_middleware(GZipMiddleware, minimum_size=500)


@app.middleware("http")
async def limit_upload_size(request: Request, call_next):
    if request.method in ("POST", "PUT", "PATCH"):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_UPLOAD_SIZE:
            return JSONResponse(
                {"detail": f"Request body too large. Maximum allowed size is {MAX_UPLOAD_SIZE // (1024 * 1024)}MB."},
                status_code=413,
            )
    return await call_next(request)


# CORS — fail loudly if not configured in production
cors_origins = os.environ.get("CORS_ORIGINS")
if not cors_origins:
    if os.environ.get("DEBUG", "").lower() != "true":
        raise RuntimeError(
            "CORS_ORIGINS environment variable not set. "
            "Set it to your allowed origins (e.g. 'https://yourshop.com'). "
            "For development, set DEBUG=true to allow all origins."
        )
    cors_origins = "*"

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins.split(",") if cors_origins != "*" else ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# STATIC FILES & HEALTH
# ==========================================
uploads_dir = ROOT_DIR / "static" / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

build_dir = ROOT_DIR / "frontend" / "build"
if build_dir.exists():
    app.mount("/static", StaticFiles(directory=build_dir / "static"), name="react-static")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        return FileResponse(str(build_dir / "index.html"))


@app.get("/health", tags=["Health"])
async def health_check():
    try:
        await db.command("ping")
        return {"status": "ok", "database": "connected"}
    except Exception as exc:
        return JSONResponse({"status": "error", "database": str(exc)}, status_code=503)


# ==========================================
# LIFECYCLE
# ==========================================
@app.on_event("startup")
async def startup_db_client():
    from pymongo import ASCENDING, DESCENDING

    await db.items.create_index("id",      unique=True, background=True)
    await db.items.create_index("ref",     background=True)
    await db.items.create_index("barcode", background=True)
    await db.items.create_index("name",    background=True)
    await db.items.create_index("date",    background=True)
    await db.items.create_index("order_no", background=True)
    await db.items.create_index("karigar", background=True)

    await db.items.create_index([(  "tailoring_status", ASCENDING), ("date",            DESCENDING)], background=True)
    await db.items.create_index([(  "ref",              ASCENDING), ("fabric_pay_mode",  ASCENDING)], background=True)
    await db.items.create_index([(  "name",             ASCENDING), ("fabric_pay_mode",  ASCENDING)], background=True)
    await db.items.create_index([(  "tailoring_status", ASCENDING), ("labour_paid",      ASCENDING)], background=True)
    await db.items.create_index([(  "embroidery_status", ASCENDING), ("emb_labour_paid",  ASCENDING)], background=True)
    await db.items.create_index([(  "embroidery_status", ASCENDING), ("date",             DESCENDING)], background=True)
    await db.items.create_index("fabric_pay_mode",      background=True)
    await db.items.create_index("tailoring_pay_mode",   background=True)
    await db.items.create_index("embroidery_pay_mode",  background=True)
    await db.items.create_index("addon_pay_mode",       background=True)

    await db.items.create_index("fabric_pay_date",      background=True)
    await db.items.create_index("tailoring_pay_date",   background=True)
    await db.items.create_index("embroidery_pay_date",  background=True)
    await db.items.create_index("addon_pay_date",       background=True)

    # _id index is automatic — no explicit creation needed for counters
    await db.advances.create_index("id",  unique=True, background=True)
    await db.advances.create_index("ref", background=True)
    await db.advances.create_index("date", background=True)
    await db.settings.create_index("key", unique=True, background=True)
    await db.token_blocklist.create_index("jti", unique=True, background=True)
    await db.token_blocklist.create_index("created_at", expireAfterSeconds=86400, background=True)
    await db.counters.create_index("created_at", expireAfterSeconds=86400 * 90, background=True)
    logger.info("MongoDB indexes ensured.")


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
