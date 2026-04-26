"""
Orders router.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, date
import uuid
import re
from bson import ObjectId
from .deps import db, get_current_user_dep
from data_quality import round_money, determine_payment_status, build_payment_mode_label
import auth as auth_module
from auth import audit_log

router = APIRouter()

@router.get("/orders")
async def get_order_numbers(pending_only: bool = False, current_user: dict = Depends(get_current_user_dep)):
    if pending_only:
        _ns = {"$not": {"$regex": "^Settled"}}
        pipeline = [
            {"$match": {"order_no": {"$nin": ["N/A", "", None]}, "$or": [
                {"fabric_amount": {"$gt": 0}, "fabric_pay_mode": _ns},
                {"tailoring_amount": {"$gt": 0}, "tailoring_pay_mode": _ns},
                {"embroidery_amount": {"$gt": 0}, "embroidery_pay_mode": _ns},
                {"addon_amount": {"$gt": 0}, "addon_pay_mode": _ns},
            ]}},
            {"$group": {"_id": "$order_no"}},
        ]
        result = await db.items.aggregate(pipeline).to_list(1000)
        return sorted([r["_id"] for r in result if r["_id"]])
    orders = await db.items.distinct("order_no", {"order_no": {"$nin": ["N/A", "", None]}})
    return sorted([o for o in orders if o])

@router.get("/orders/status")
async def get_order_status(
    customer: Optional[str] = None,
    order_no: Optional[str] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    limit: int = Query(400, le=2000),
    current_user: dict = Depends(get_current_user_dep),
):
    query = {"order_no": {"$nin": ["N/A", "", None]}}
    if customer:
        query["name"] = customer
    if order_no:
        escaped_order_no = re.escape(order_no.strip()) if order_no else ""
        query["order_no"] = {"$regex": escaped_order_no, "$options": "i"}
    if date_from:
        query.setdefault("date", {})["$gte"] = date_from
    if date_to:
        query.setdefault("date", {})["$lte"] = date_to
    items = await db.items.find(query, {"_id": 0}).to_list(limit)
    grouped: dict = {}
    for item in items:
        ono = item.get("order_no", "")
        if ono not in grouped:
            grouped[ono] = {
                "order_no": ono,
                "customers": set(),
                "refs": set(),
                "item_count": 0,
                "tailoring_pending": 0,
                "tailoring_stitched": 0,
                "tailoring_delivered": 0,
                "emb_required": 0,
                "emb_in_progress": 0,
                "emb_finished": 0,
                "order_total": 0,
                "latest_bill_date": "",
                "latest_delivery_date": "",
            }
        g = grouped[ono]
        g["customers"].add(item.get("name", ""))
        g["refs"].add(item.get("ref", ""))
        g["item_count"] += 1
        ts = item.get("tailoring_status", "N/A")
        if ts == "Pending": g["tailoring_pending"] += 1
        elif ts == "Stitched": g["tailoring_stitched"] += 1
        elif ts == "Delivered": g["tailoring_delivered"] += 1
        es = item.get("embroidery_status", "N/A")
        if es == "Required": g["emb_required"] += 1
        elif es == "In Progress": g["emb_in_progress"] += 1
        elif es == "Finished": g["emb_finished"] += 1
        g["order_total"] += float(item.get("fabric_amount", 0))
        d = item.get("date", "")
        if d and d > g["latest_bill_date"]: g["latest_bill_date"] = d
        dd = item.get("delivery_date", "")
        if dd and dd not in ("N/A", "", None) and dd > g["latest_delivery_date"]: g["latest_delivery_date"] = dd
    result = []
    for g in grouped.values():
        g["customers"] = sorted(g["customers"])
        g["refs"] = sorted(g["refs"])
        result.append(g)
    result.sort(key=lambda x: x.get("latest_bill_date", ""), reverse=True)
    return result

@router.post("/orders/deliver")
async def mark_order_delivered(
    payload: dict,
    request: Request,
    current_user: dict = Depends(get_current_user_dep),
):
    """Mark all Pending/Stitched items in an order as Delivered."""
    order_no = payload.get("order_no", "").strip()
    if not order_no:
        raise HTTPException(status_code=400, detail="order_no is required")
    result = await db.items.update_many(
        {"order_no": order_no, "tailoring_status": {"$in": ["Pending", "Stitched"]}},
        {"$set": {"tailoring_status": "Delivered"}},
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="No items updated — order may not exist or is already delivered")
    await audit_log(db, current_user["username"], "update", "items",
        f"Mark order {order_no} as Delivered ({result.modified_count} items)", request)
    return {"modified": result.modified_count}

# ==========================================
# ITEM EDIT & DELETE
# ==========================================

