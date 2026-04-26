"""
Auth Routes router.
"""
from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile, Header, status
from fastapi.responses import FileResponse, JSONResponse
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, date
import uuid
import re
from bson import ObjectId
from .deps import db, get_current_user_dep
from data_quality import round_money, determine_payment_status, build_payment_mode_label
import auth as auth_module
from auth import audit_log
from .models import LoginRequest, UserCreateRequest, DEFAULT_SETTINGS, merge_settings

# ==========================================
# RATE LIMITING
# TTLCache auto-expires entries — no manual cleanup needed.
# Falls back to plain dict if cachetools is not installed.
# ==========================================
_RATE_LIMIT_MAX = 5
_RATE_LIMIT_WINDOW = 900  # 15 minutes in seconds

try:
    from cachetools import TTLCache
    _login_attempts: dict = TTLCache(maxsize=1000, ttl=_RATE_LIMIT_WINDOW)
except ImportError:
    # cachetools not installed — use plain dict with manual expiry
    _login_attempts: dict = {}  # type: ignore

def _check_rate_limit(ip: str) -> None:
    """Raise 429 if this IP has exceeded the login attempt limit."""
    try:
        # TTLCache: entries auto-expire, just count them
        count = _login_attempts.get(ip, 0)
        if count >= _RATE_LIMIT_MAX:
            raise HTTPException(
                status_code=429,
                detail=f"Too many login attempts. Try again in {_RATE_LIMIT_WINDOW // 60} minutes."
            )
        _login_attempts[ip] = count + 1
    except HTTPException:
        raise
    except Exception:
        # If TTLCache is full or any other error, fail open (don't block legitimate users)
        pass

def _clear_rate_limit(ip: str) -> None:
    """Clear rate limit counter on successful login."""
    try:
        _login_attempts.pop(ip, None)
    except Exception:
        pass

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
