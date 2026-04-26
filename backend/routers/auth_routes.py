"""
Auth Routes router.
"""
from fastapi import APIRouter, HTTPException, Query, Depends, Request
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, date
import uuid
import re
from bson import ObjectId
from .deps import db, get_current_user_dep
from data_quality import round_money, determine_payment_status, build_payment_mode_label
import auth as auth_module
from auth import audit_log
from .models import LoginRequest, UserCreateRequest
from fastapi import Header, status

router = APIRouter()

@router.get("/settings/public")
async def get_public_settings():
    settings = await db.settings.find_one({"key": "app_settings"}, {"_id": 0})
    merged = merge_settings(settings)
    return {"firm_name": merged.get("firm_name", "Retail Book")}

@router.get("/settings")
async def get_settings(current_user: dict = Depends(get_current_user_dep)):
    settings = await db.settings.find_one({"key": "app_settings"}, {"_id": 0})
    return merge_settings(settings)

@router.put("/settings")
async def update_settings(data: dict, current_user: dict = Depends(get_current_user_dep)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update settings")
    # Deduplicate list fields before saving
    for list_key in ("payment_modes", "addon_items", "article_types"):
        if isinstance(data.get(list_key), list):
            seen = set()
            data[list_key] = [x for x in data[list_key] if not (x.lower() in seen or seen.add(x.lower()))]
    data["key"] = "app_settings"
    await db.settings.update_one({"key": "app_settings"}, {"$set": data}, upsert=True)
    settings = await db.settings.find_one({"key": "app_settings"}, {"_id": 0})
    return merge_settings(settings)

# ==========================================
# LOGO UPLOAD
# ==========================================

@router.post("/upload/logo")
async def upload_logo(file: UploadFile = File(...), current_user: dict = Depends(get_current_user_dep)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Only image files allowed")
    if file.size and file.size > 1024 * 1024:
        raise HTTPException(status_code=400, detail="Image too large (max 1MB)")
    upload_dir = ROOT_DIR / "static" / "uploads"
    upload_dir.mkdir(parents=True, exist_ok=True)
    ext = file.filename.split(".")[-1].lower() if "." in file.filename else "png"
    safe_name = f"logo_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{os.urandom(4).hex()}.{ext}"
    file_path = upload_dir / safe_name
    contents = await file.read()
    with open(file_path, "wb") as f:
        f.write(contents)
    return {"url": f"/uploads/{safe_name}"}

# ==========================================
# AUTH ENDPOINTS
# ==========================================

@router.post("/auth/login")
async def login(req: LoginRequest, request: Request):
    client_ip = request.client.host if request.client else "unknown"
    _check_rate_limit(client_ip)
    user = await db.users.find_one({"username": req.username.lower().strip()})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not auth_module.verify_password(req.password, user.get("password_hash", "")):
        raise HTTPException(status_code=401, detail="Invalid username or password")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="User is disabled")
    _clear_rate_limit(client_ip)
    token = auth_module.create_access_token({"sub": user["username"]})
    await audit_log(db, "login", user, "user", user["username"], {"ip": client_ip})
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "username": user["username"],
            "full_name": user.get("full_name", ""),
            "role": user.get("role", "cashier"),
            "is_active": user.get("is_active", True),
            "allowed_pages": user.get("allowed_pages", []),
        }
    }

@router.post("/auth/logout")
async def logout(current_user: dict = Depends(get_current_user_dep)):
    return {"message": "Logged out"}

@router.get("/auth/me")
async def get_me(current_user: dict = Depends(get_current_user_dep)):
    return {
        "username": current_user["username"],
        "full_name": current_user.get("full_name", ""),
        "role": current_user.get("role", "cashier"),
        "is_active": current_user.get("is_active", True),
        "allowed_pages": current_user.get("allowed_pages", []),
    }

@router.post("/auth/register")
async def register_user(req: UserCreateRequest, current_user: dict = Depends(get_current_user_dep)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can create users")
    if len(req.username.strip()) < 3:
        raise HTTPException(status_code=400, detail="Username must be at least 3 characters")
    if len(req.password) < 8:
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
    if req.role not in ["admin", "manager", "cashier"]:
        raise HTTPException(status_code=400, detail="Role must be admin, manager, or cashier")
    existing = await db.users.find_one({"username": req.username.lower().strip()})
    if existing:
        raise HTTPException(status_code=400, detail="Username already exists")
    new_user = {
        "username": req.username,
        "password_hash": auth_module.get_password_hash(req.password),
        "full_name": req.full_name,
        "role": req.role,
        "is_active": True,
        "allowed_pages": req.allowed_pages,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    new_user["username"] = req.username.lower().strip()
    await db.users.insert_one(new_user)
    await audit_log(db, "create", current_user, "user", new_user["username"], {"full_name": req.full_name, "role": req.role})
    logger.info(f"User '{new_user['username']}' created by '{current_user['username']}'")
    return {"message": "User created successfully", "username": new_user["username"]}

@router.get("/auth/users")
async def list_users(current_user: dict = Depends(get_current_user_dep)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can list users")
    users = await db.users.find({}, {"password_hash": 0}).to_list(None)
    for u in users:
        u["_id"] = str(u["_id"])
    return users

@router.put("/auth/users/{username}")
async def update_user(username: str, data: dict, current_user: dict = Depends(get_current_user_dep)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can update users")
    if username == "admin" and current_user["username"] != "admin":
        raise HTTPException(status_code=403, detail="Cannot modify the admin account")
    update = {}
    if "full_name" in data: update["full_name"] = data["full_name"]
    if "role" in data: update["role"] = data["role"]
    if "is_active" in data: update["is_active"] = data["is_active"]
    if "allowed_pages" in data: update["allowed_pages"] = data["allowed_pages"]
    if "password" in data and data["password"]:
        if len(data["password"]) < 8:
            raise HTTPException(status_code=400, detail="Password must be at least 8 characters")
        update["password_hash"] = auth_module.get_password_hash(data["password"])
    if not update:
        raise HTTPException(status_code=400, detail="No fields to update")
    result = await db.users.update_one({"username": username}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    await audit_log(db, "update", current_user, "user", username, {"fields": list(update.keys())})
    logger.info(f"User '{username}' updated by '{current_user['username']}'")
    return {"message": "User updated successfully"}

@router.delete("/auth/users/{username}")
async def delete_user(username: str, current_user: dict = Depends(get_current_user_dep)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can delete users")
    if username == current_user["username"]:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")
    if username == "admin":
        raise HTTPException(status_code=400, detail="Cannot delete the admin account")
    result = await db.users.delete_one({"username": username})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    await audit_log(db, "delete", current_user, "user", username, {})
    logger.info(f"User '{username}' deleted by '{current_user['username']}'")
    return {"message": "User deleted successfully"}

# ==========================================
# AUDIT LOGS
# ==========================================

@router.get("/audit-logs")
async def list_audit_logs(
    limit: int = Query(50, ge=1, le=500),
    skip: int = Query(0, ge=0),
    user: str = Query(None, description="Filter by username"),
    action: str = Query(None, description="Filter by action type"),
    date_from: str = Query(None, description="Filter from date (YYYY-MM-DD)"),
    date_to: str = Query(None, description="Filter to date (YYYY-MM-DD)"),
    current_user: dict = Depends(get_current_user_dep),
):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view audit logs")
    
    # Build query filter with ReDoS protection
    query_filter = {}
    if user:
        escaped_user = re.escape(user.strip()) if user else ""
        query_filter["username"] = {"$regex": escaped_user, "$options": "i"}
    if action:
        escaped_action = re.escape(action.strip()) if action else ""
        query_filter["action"] = {"$regex": escaped_action, "$options": "i"}
    if date_from or date_to:
        date_filter = {}
        if date_from:
            date_filter["$gte"] = f"{date_from}T00:00:00"
        if date_to:
            date_filter["$lte"] = f"{date_to}T23:59:59"
        query_filter["timestamp"] = date_filter
    
    cursor = db.audit_logs.find(query_filter).sort("timestamp", -1).skip(skip).limit(limit)
    docs = await cursor.to_list(length=limit)
    for d in docs:
        d["_id"] = str(d["_id"])
    
    # Get total count for pagination
    total_count = await db.audit_logs.count_documents(query_filter)
    
    return {"logs": docs, "count": len(docs), "total": total_count}

# ==========================================
# APP SETUP
# ==========================================

app.include_router(api_router)

app.add_middleware(GZipMiddleware, minimum_size=500)

@app.middleware("http")
async def limit_upload_size(request: Request, call_next):
    if request.method in ("POST", "PUT", "PATCH"):
        content_length = request.headers.get("content-length")
        if content_length and int(content_length) > MAX_UPLOAD_SIZE:
            return JSONResponse(
                {"detail": f"Request body too large. Maximum allowed size is {MAX_UPLOAD_SIZE // (1024*1024)}MB."},
                status_code=413
            )
    return await call_next(request)

@app.get("/health", tags=["Health"])
async def health_check():
    try:
        await db.command("ping")
        return {"status": "ok", "database": "connected"}
    except Exception as e:
        return JSONResponse({"status": "error", "database": str(e)}, status_code=503)

# CORS configuration - fail loudly if not set in production
cors_origins = os.environ.get('CORS_ORIGINS')
if not cors_origins:
    # In production (when not in DEBUG mode), require explicit CORS origins
    if os.environ.get('DEBUG', '').lower() != 'true':
        raise RuntimeError(
            "CORS_ORIGINS environment variable not set. "
            "Please set it to your allowed origins (e.g., 'https://yourshop.com,https://192.168.1.100:8001'). "
            "For development, set DEBUG=true to allow all origins."
        )
    # In development, default to allow all
    cors_origins = '*'

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=cors_origins.split(',') if cors_origins != '*' else ['*'],
    allow_methods=["*"],
    allow_headers=["*"],
)

uploads_dir = ROOT_DIR / "static" / "uploads"
uploads_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=uploads_dir), name="uploads")

build_dir = ROOT_DIR / "frontend" / "build"
if build_dir.exists():
    app.mount("/static", StaticFiles(directory=build_dir / "static"), name="react-static")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def spa_fallback(full_path: str):
        index = build_dir / "index.html"
        return FileResponse(str(index))

@app.on_event("startup")
async def startup_db_client():
    from pymongo import ASCENDING, DESCENDING
    
    # Single field indexes
    await db.items.create_index("id", unique=True, background=True)
    await db.items.create_index("ref", background=True)
    await db.items.create_index("barcode", background=True)
    await db.items.create_index("name", background=True)
    await db.items.create_index("date", background=True)
    await db.items.create_index("order_no", background=True)
    await db.items.create_index("karigar", background=True)
    
    # Compound indexes for common query patterns (performance optimization)
    # Job Work queries: filter by tailoring_status and sort by date
    await db.items.create_index([("tailoring_status", ASCENDING), ("date", DESCENDING)], background=True)
    # Settlement balance queries: filter by ref and fabric_pay_mode
    await db.items.create_index([("ref", ASCENDING), ("fabric_pay_mode", ASCENDING)], background=True)
    # Customer pending refs: filter by name and fabric_pay_mode
    await db.items.create_index([("name", ASCENDING), ("fabric_pay_mode", ASCENDING)], background=True)
    # Daybook queries: filter by pay dates
    await db.items.create_index("fabric_pay_date", background=True)
    await db.items.create_index("tailoring_pay_date", background=True)
    await db.items.create_index("embroidery_pay_date", background=True)
    await db.items.create_index("addon_pay_date", background=True)
    # Labour queries: filter by tailoring_status and labour_paid
    await db.items.create_index([("tailoring_status", ASCENDING), ("labour_paid", ASCENDING)], background=True)
    # Counters collection — _id index is automatic in MongoDB, no explicit creation needed
    
    await db.advances.create_index("id", unique=True, background=True)
    await db.advances.create_index("ref", background=True)
    await db.advances.create_index("date", background=True)
    await db.settings.create_index("key", unique=True, background=True)
    logger.info("MongoDB indexes ensured.")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
