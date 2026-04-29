"""
Labour router.
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
from .models import LabourDeleteRequest, LabourPaymentRequest

router = APIRouter()

@router.get("/labour")
async def get_labour_items(filter_type: str = "All", filter_karigar: str = "All", view_mode: str = "unpaid", current_user: dict = Depends(get_current_user_dep)):
    import asyncio
    paid = view_mode == "paid"

    tail_query = None
    if filter_type in ("All", "Tailoring Labour"):
        if paid:
            tail_query = {
                "tailoring_status": {"$in": ["Stitched", "Delivered"]},
                "labour_paid": "Yes",
                "labour_amount": {"$gt": 0},
            }
        else:
            tail_query = {
                "tailoring_status": {"$in": ["Stitched", "Delivered"]},
                "labour_paid": {"$in": ["N/A", "", None]},
                "labour_amount": {"$gt": 0},
            }

    emb_query = None
    if filter_type in ("All", "Embroidery Labour"):
        if paid:
            emb_query = {
                "embroidery_status": "Finished",
                "emb_labour_paid": "Yes",
                "emb_labour_amount": {"$gt": 0},
            }
        else:
            emb_query = {
                "embroidery_status": "Finished",
                "emb_labour_paid": {"$in": ["N/A", "", None]},
                "emb_labour_amount": {"$gt": 0},
            }
        if filter_karigar != "All":
            emb_query["karigar"] = filter_karigar

    coros = []
    order = []
    if tail_query is not None:
        coros.append(db.items.find(tail_query, {"_id": 0}).to_list(500))
        order.append("tail")
    if emb_query is not None:
        coros.append(db.items.find(emb_query, {"_id": 0}).to_list(500))
        order.append("emb")

    results = await asyncio.gather(*coros)
    result_map = dict(zip(order, results))

    items = []
    for item in result_map.get("tail", []):
        items.append({**item, "labour_type": "Tailoring"})
    for item in result_map.get("emb", []):
        items.append({**item, "labour_type": "Embroidery"})
    return items

@router.get("/labour/karigars")
async def get_karigars(current_user: dict = Depends(get_current_user_dep)):
    karigars = await db.items.distinct("karigar", {"karigar": {"$nin": ["N/A", "", None]}})
    return sorted(karigars)

@router.post("/labour/pay")
async def pay_labour(req: LabourPaymentRequest, current_user: dict = Depends(get_current_user_dep)):
    from pymongo import UpdateOne
    mode_str = ", ".join(req.payment_modes) if req.payment_modes else "Cash"
    if req.labour_type == "tailoring":
        update = {
            "labour_paid": "Yes",
            "labour_pay_date": req.payment_date,
            "labour_payment_mode": mode_str,
            "labour_payment_id": req.payment_id or "",
        }
    else:
        update = {
            "emb_labour_paid": "Yes",
            "emb_labour_date": req.payment_date,
            "emb_labour_payment_mode": mode_str,
            "emb_labour_payment_id": req.payment_id or "",
        }
    bulk_ops = [UpdateOne({"id": item_id}, {"$set": update}) for item_id in req.item_ids]
    result = await db.items.bulk_write(bulk_ops, ordered=False)
    return {"message": f"{result.modified_count} labour payments processed"}

@router.post("/labour/delete-payment")
async def delete_labour_payment(req: LabourDeleteRequest, current_user: dict = Depends(get_current_user_dep)):
    from pymongo import UpdateOne
    if req.labour_type == "tailoring":
        update = {"labour_paid": "N/A", "labour_pay_date": "N/A", "labour_payment_mode": "N/A", "labour_payment_id": ""}
    else:
        update = {"emb_labour_paid": "N/A", "emb_labour_date": "N/A", "emb_labour_payment_mode": "N/A", "emb_labour_payment_id": ""}
    bulk_ops = [UpdateOne({"id": item_id}, {"$set": update}) for item_id in req.item_ids]
    result = await db.items.bulk_write(bulk_ops, ordered=False)
    return {"message": f"{result.modified_count} items marked as unpaid"}

# ==========================================
# ADVANCES
# ==========================================

