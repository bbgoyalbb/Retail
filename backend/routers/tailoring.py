"""
Tailoring router.
"""
import asyncio
from fastapi import APIRouter, HTTPException, Query, Depends, Request
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, date
import uuid
import re
from bson import ObjectId
from pymongo import UpdateOne
from .deps import db, get_current_user_dep
from data_quality import round_money, determine_payment_status, build_payment_mode_label
import auth as auth_module
from auth import audit_log
from .models import AddOnRequest, TAILORING_RATES, TailoringOrderRequest, SplitItem, SplitTailoringRequest, merge_settings

router = APIRouter()

@router.get("/tailoring/awaiting")
async def get_awaiting_orders(current_user: dict = Depends(get_current_user_dep)):
    pipeline = [
        {"$match": {"tailoring_status": "Awaiting Order"}},
        {"$group": {
            "_id": {"name": "$name", "ref": "$ref"},
            "items": {"$push": {
                "id": "$id", "barcode": "$barcode", "price": "$price",
                "qty": "$qty", "article_type": "$article_type",
                "embroidery_status": "$embroidery_status"
            }},
            "date": {"$first": "$date"},
            "count": {"$sum": 1}
        }},
        {"$sort": {"date": -1}}
    ]
    result = await db.items.aggregate(pipeline).to_list(200)
    return [{"name": r["_id"]["name"], "ref": r["_id"]["ref"], "date": r["date"],
             "items": r["items"], "count": r["count"]} for r in result]

@router.post("/tailoring/assign")
async def assign_tailoring(req: TailoringOrderRequest, current_user: dict = Depends(get_current_user_dep)):
    item_ids = [a.get("item_id") for a in req.assignments]
    stored_settings, existing_items_list = await asyncio.gather(
        db.settings.find_one({"key": "app_settings"}, {"_id": 0}),
        db.items.find(
            {"id": {"$in": item_ids}},
            {"_id": 0, "id": 1, "tailoring_received": 1, "tailoring_pay_mode": 1}
        ).to_list(len(item_ids)),
    )
    settings = merge_settings(stored_settings)
    tailoring_rates = settings.get("tailoring_rates", {})
    item_map = {i["id"]: i for i in existing_items_list}

    bulk_ops = []
    for assignment in req.assignments:
        item_id = assignment.get("item_id")
        article_type = assignment.get("article_type", "Shirt")
        emb_status = assignment.get("embroidery_status", "Not Required")

        rate_data = tailoring_rates.get(article_type, {})
        if isinstance(rate_data, dict):
            tail_amt = rate_data.get("tailoring", 0)
            labour_amt = rate_data.get("labour", 0)
        else:
            tail_amt, labour_amt = TAILORING_RATES.get(article_type, (0, 0))

        existing_item = item_map.get(item_id, {})
        existing_tail_received = float(existing_item.get("tailoring_received", 0))
        existing_tail_mode = existing_item.get("tailoring_pay_mode", "Pending")
        tail_pending = round(tail_amt - existing_tail_received, 2)
        tail_mode = existing_tail_mode if str(existing_tail_mode).startswith("Settled") else ("Pending" if existing_tail_received <= 0 else existing_tail_mode)

        fields = {
            "tailoring_status": "Pending",
            "article_type": article_type,
            "order_no": req.order_no,
            "delivery_date": req.delivery_date,
            "tailoring_amount": tail_amt,
            "tailoring_pending": tail_pending,
            "tailoring_pay_mode": tail_mode,
            "labour_amount": labour_amt,
            "embroidery_status": emb_status,
        }
        if emb_status == "Required":
            fields["embroidery_pay_mode"] = "Pending"
        bulk_ops.append(UpdateOne({"id": item_id}, {"$set": fields}))

    if not bulk_ops:
        return {"message": "0 items assigned"}
    result = await db.items.bulk_write(bulk_ops, ordered=False)
    return {"message": f"{result.modified_count} items assigned to order {req.order_no}"}

@router.post("/tailoring/split")
async def split_and_assign(req: SplitTailoringRequest, current_user: dict = Depends(get_current_user_dep)):
    item = await db.items.find_one({"id": req.item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    # Fetch tailoring rates from settings instead of hardcoded values
    stored_settings = await db.settings.find_one({"key": "app_settings"}, {"_id": 0})
    settings = merge_settings(stored_settings)
    tailoring_rates = settings.get("tailoring_rates", {})

    original_qty = item.get("qty", 0)
    original_price = item.get("price", 0)
    original_discount = item.get("discount", 0)

    first_update = None
    new_docs = []
    for idx, split in enumerate(req.splits):
        rate_data = tailoring_rates.get(split.article_type, {})
        if isinstance(rate_data, dict):
            tail_amt = rate_data.get("tailoring", 0)
            labour_amt = rate_data.get("labour", 0)
        else:
            tail_amt, labour_amt = TAILORING_RATES.get(split.article_type, (0, 0))

        discounted_price = round(original_price - (original_price * original_discount / 100), 0)
        split_fabric_amt = round(discounted_price * split.qty, 0)

        if idx == 0:
            existing_tail_received = float(item.get("tailoring_received", 0))
            existing_tail_mode = item.get("tailoring_pay_mode", "Pending")
            tail_pending = round(tail_amt - existing_tail_received, 2)
            tail_mode = existing_tail_mode if str(existing_tail_mode).startswith("Settled") else ("Pending" if existing_tail_received <= 0 else existing_tail_mode)
            first_update = {
                "qty": split.qty,
                "fabric_amount": split_fabric_amt,
                "fabric_pending": split_fabric_amt if item.get("fabric_pay_mode") == "Pending" else item.get("fabric_pending", 0),
                "article_type": split.article_type,
                "tailoring_status": "Awaiting Order",
                "tailoring_amount": tail_amt,
                "tailoring_pending": tail_pending,
                "tailoring_pay_mode": tail_mode,
                "labour_amount": labour_amt,
                "embroidery_status": split.embroidery_status,
            }
            if split.embroidery_status == "Required":
                first_update["embroidery_pay_mode"] = "Pending"
        else:
            new_item = {**item}
            new_item.pop("_id", None)
            new_item["id"] = str(uuid.uuid4())
            new_item["qty"] = split.qty
            new_item["fabric_amount"] = split_fabric_amt
            orig_fabric_mode = item.get("fabric_pay_mode", "Pending")
            if str(orig_fabric_mode).startswith("Settled"):
                new_item["fabric_pending"] = 0
                new_item["fabric_received"] = 0
                new_item["fabric_pay_mode"] = "N/A"
            else:
                new_item["fabric_pending"] = split_fabric_amt
                new_item["fabric_received"] = 0
            new_item["article_type"] = split.article_type
            new_item["tailoring_status"] = "Awaiting Order"
            new_item["order_no"] = "N/A"
            new_item["delivery_date"] = "N/A"
            new_item["tailoring_amount"] = tail_amt
            new_item["labour_amount"] = labour_amt
            new_item["tailoring_pending"] = tail_amt
            new_item["tailoring_pay_mode"] = "Pending"
            new_item["embroidery_status"] = split.embroidery_status
            if split.embroidery_status == "Required":
                new_item["embroidery_pay_mode"] = "Pending"
            new_item["created_at"] = datetime.now(timezone.utc).isoformat()
            new_docs.append(new_item)

    ops = []
    if first_update:
        ops.append(db.items.update_one({"id": req.item_id}, {"$set": first_update}))
    if new_docs:
        ops.append(db.items.insert_many(new_docs))
    if ops:
        await asyncio.gather(*ops)

    return {"message": f"Item split into {len(req.splits)} pieces. Fill in order details to assign."}

# ==========================================
# ADDONS
# ==========================================

