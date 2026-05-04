"""
Orders router.
"""
import asyncio
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
    pipeline = [
        {"$match": query},
        {"$group": {
            "_id": "$order_no",
            "customers":           {"$addToSet": "$name"},
            "refs":                {"$addToSet": "$ref"},
            "item_count":          {"$sum": 1},
            "tailoring_pending":   {"$sum": {"$cond": [{"$eq": ["$tailoring_status",  "Pending"]},     1, 0]}},
            "tailoring_stitched":  {"$sum": {"$cond": [{"$eq": ["$tailoring_status",  "Stitched"]},    1, 0]}},
            "tailoring_delivered": {"$sum": {"$cond": [{"$eq": ["$tailoring_status",  "Delivered"]},   1, 0]}},
            "emb_required":        {"$sum": {"$cond": [{"$eq": ["$embroidery_status", "Required"]},    1, 0]}},
            "emb_in_progress":     {"$sum": {"$cond": [{"$eq": ["$embroidery_status", "In Progress"]}, 1, 0]}},
            "emb_finished":        {"$sum": {"$cond": [{"$eq": ["$embroidery_status", "Finished"]},    1, 0]}},
            "order_total":         {"$sum": {"$add": ["$fabric_amount", "$tailoring_amount", "$embroidery_amount", "$addon_amount"]}},
            "latest_bill_date":    {"$max": "$date"},
            "latest_delivery_date":{"$max": {"$cond": [{"$not": [{"$in": ["$delivery_date", ["N/A", "", None]]}]}, "$delivery_date", None]}},
        }},
        {"$sort": {"latest_bill_date": -1}},
        {"$limit": limit},
    ]
    rows = await db.items.aggregate(pipeline).to_list(limit)
    return [
        {
            "order_no":            r["_id"],
            "customers":           sorted(r["customers"]),
            "refs":                sorted(r["refs"]),
            "item_count":          r["item_count"],
            "tailoring_pending":   r["tailoring_pending"],
            "tailoring_stitched":  r["tailoring_stitched"],
            "tailoring_delivered": r["tailoring_delivered"],
            "emb_required":        r["emb_required"],
            "emb_in_progress":     r["emb_in_progress"],
            "emb_finished":        r["emb_finished"],
            "order_total":         r["order_total"],
            "latest_bill_date":    r.get("latest_bill_date") or "",
            "latest_delivery_date":r.get("latest_delivery_date") or "",
        }
        for r in rows
    ]

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
    await audit_log(db, "update", current_user, "items",
        order_no, {"note": f"Marked as Delivered ({result.modified_count} items)"})
    return {"modified": result.modified_count}

