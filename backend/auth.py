"""Authentication and audit utilities for the Retail API."""
import os
import secrets
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import JWTError, jwt
from passlib.context import CryptContext

from motor.motor_asyncio import AsyncIOMotorDatabase

# --- Config ---
# Load or generate a stable JWT secret that persists across server restarts.
def _load_or_create_secret() -> str:
    env_val = os.environ.get("JWT_SECRET_KEY")
    if env_val:
        return env_val
    env_file = Path(__file__).parent / ".env"
    # Try to read existing value from .env file
    if env_file.exists():
        for line in env_file.read_text().splitlines():
            if line.startswith("JWT_SECRET_KEY="):
                val = line.split("=", 1)[1].strip()
                if val:
                    return val
    # Generate a new stable secret and persist it
    new_secret = secrets.token_hex(32)
    with open(env_file, "a") as f:
        f.write(f"\nJWT_SECRET_KEY={new_secret}\n")
    return new_secret

SECRET_KEY = _load_or_create_secret()
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_DAYS = 1  # Reduced from 7 for security

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer(auto_error=False)



# --- Helpers ---
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(days=ACCESS_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
    db: AsyncIOMotorDatabase = None,  # injected by caller
):
    """Dependency to extract and validate the current user from a JWT token."""
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
            headers={"WWW-Authenticate": "Bearer"},
        )
    token = credentials.credentials
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    if db is None:
        raise HTTPException(status_code=500, detail="Database not available")

    user = await db.users.find_one({"username": username.lower().strip() if username else username}, {"password_hash": 0})
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.get("is_active", True):
        raise HTTPException(status_code=403, detail="User is disabled")

    return user



async def audit_log(db, action: str, user: dict, entity_type: str = "", entity_id: str = "", details: dict = None):
    """Record an audit log entry."""
    log = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "action": action,
        "username": user.get("username", "unknown") if user else "system",
        "full_name": user.get("full_name", "") if user else "",
        "entity_type": entity_type,
        "entity_id": entity_id,
        "details": details or {},
    }
    await db.audit_logs.insert_one(log)
