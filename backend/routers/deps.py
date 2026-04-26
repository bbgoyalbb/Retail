"""
Shared dependencies injected into every router.
Import `db` and `get_current_user_dep` from here.
"""
from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials
import auth as auth_module

# db is set once at startup by server.py
db = None  # type: ignore

def set_db(database):
    global db
    db = database


async def get_current_user_dep(
    credentials: HTTPAuthorizationCredentials = Depends(auth_module.security),
):
    return await auth_module.get_current_user(credentials, db)
