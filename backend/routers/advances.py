"""
Advances router.
"""
from fastapi import APIRouter, HTTPException, Query, Depends, Request
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, date
import uuid
import re
from bson import ObjectId
from .deps import db, get_current_user_dep
from data_quality import round_money, determine_payment_status, build_payment_mode_label
import auth as auth_module
from auth import audit_log
from .models import AdvanceCreateRequest, AdvanceUpdateRequest

router = APIRouter()

@router.get("/advances")
async def get_advances(name: Optional[str] = None, ref: Optional[str] = None, current_user: dict = Depends(get_current_user_dep)):
    query = {}
    if name:
        query["name"] = name
    if ref:
        query["ref"] = ref
    advances = await db.advances.find(query, {"_id": 0}).sort("date", -1).to_list(500)
    return advances

class AdvanceCreateRequest(BaseModel):
    ref: str
    name: str
    amount: float
    date: str
    mode: Optional[str] = "Cash"

class AdvanceUpdateRequest(BaseModel):
    ref: Optional[str] = None
    name: Optional[str] = None
    amount: Optional[float] = None
    date: Optional[str] = None
    mode: Optional[str] = None
    tally: Optional[bool] = None

@router.post("/advances")
async def create_advance(req: AdvanceCreateRequest, current_user: dict = Depends(get_current_user_dep)):
    adv = {"id": str(uuid.uuid4()), "ref": req.ref, "name": req.name, "amount": req.amount, "date": req.date, "mode": req.mode or "Cash", "tally": False, "created_at": datetime.now(timezone.utc).isoformat()}
    await db.advances.insert_one(adv)
    await audit_log(db, "create", current_user, "advance", adv["id"], {"ref": req.ref, "amount": req.amount})
    adv.pop("_id", None)
    return adv

@router.put("/advances/{advance_id}")
async def update_advance(advance_id: str, req: AdvanceUpdateRequest, current_user: dict = Depends(get_current_user_dep)):
    update = {k: v for k, v in req.model_dump().items() if v is not None}  # None = not provided; False/0 are valid values
    if not update:
        return {"message": "Nothing to update"}
    result = await db.advances.update_one({"id": advance_id}, {"$set": update})
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Advance not found")
    await audit_log(db, "update", current_user, "advance", advance_id, {"fields": list(update.keys())})
    return {"message": "Advance updated"}

@router.delete("/advances/{advance_id}")
async def delete_advance(advance_id: str, current_user: dict = Depends(get_current_user_dep)):
    result = await db.advances.delete_one({"id": advance_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Advance not found")
    await audit_log(db, "delete", current_user, "advance", advance_id, {})
    return {"message": "Advance deleted"}

# ==========================================
# ORDER NUMBERS
# ==========================================

