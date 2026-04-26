"""
Jobwork router.
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
from .models import AddOnRequest, EmbEditRequest, EmbMoveRequest, MoveBackRequest, StatusUpdateRequest

router = APIRouter()

@router.post("/addons")
async def add_addons(req: AddOnRequest, current_user: dict = Depends(get_current_user_dep)):
    item = await db.items.find_one({"id": req.item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    addon_names = []
    total_amount = 0
    for addon in req.addons:
        addon_names.append(f"{addon['name']}({addon['price']})")
        total_amount += float(addon['price'])

    new_desc = ", ".join(addon_names)
    existing_desc = item.get("addon_desc", "N/A")
    if existing_desc and existing_desc != "N/A":
        new_desc = f"{existing_desc} + {new_desc}"

    new_total = float(item.get("addon_amount", 0)) + total_amount

    existing_received = float(item.get("addon_received", 0))
    new_pending = round(new_total - existing_received, 2)
    new_mode = item.get("addon_pay_mode", "Pending")
    if existing_received > 0 and not str(new_mode).startswith("Settled"):
        new_mode = f"Settled - {new_mode.split(' - ', 1)[1]}" if " - " in str(new_mode) else "Settled"
    elif existing_received <= 0:
        new_mode = "Pending"
    await db.items.update_one({"id": req.item_id}, {"$set": {
        "addon_desc": new_desc,
        "addon_amount": new_total,
        "addon_pay_mode": new_mode,
        "addon_pending": new_pending,
    }})
    return {"message": "Add-ons saved", "addon_desc": new_desc, "addon_amount": new_total}

# ==========================================
# JOB WORK (Status Updates)
# ==========================================

@router.get("/jobwork")
async def get_jobwork(
    tab: str = "tailoring",
    order_no: Optional[str] = None,
    date_filter: Optional[str] = None,
    delivery_filter: Optional[str] = None,
    current_user: dict = Depends(get_current_user_dep),
):
    query = {}

    if tab == "tailoring":
        query["tailoring_status"] = {"$in": ["Pending", "Stitched", "Delivered"]}
    else:
        query["embroidery_status"] = {"$in": ["Required", "In Progress", "Finished"]}

    if order_no and order_no != "All":
        query["order_no"] = order_no
    if date_filter and date_filter != "All":
        query["date"] = date_filter
    if delivery_filter and delivery_filter != "All":
        query["delivery_date"] = delivery_filter

    items = await db.items.find(query, {"_id": 0}).sort("date", -1).to_list(500)

    if tab == "tailoring":
        pending = [i for i in items if i["tailoring_status"] == "Pending"]
        stitched = [i for i in items if i["tailoring_status"] == "Stitched"]
        delivered = [i for i in items if i["tailoring_status"] == "Delivered"]
        return {"pending": pending, "stitched": stitched, "delivered": delivered}
    else:
        required = [i for i in items if i["embroidery_status"] == "Required"]
        in_progress = [i for i in items if i["embroidery_status"] == "In Progress"]
        finished = [i for i in items if i["embroidery_status"] == "Finished"]
        return {"required": required, "in_progress": in_progress, "finished": finished}

@router.post("/jobwork/move")
async def move_jobwork(req: StatusUpdateRequest, current_user: dict = Depends(get_current_user_dep)):
    updated = 0
    for item_id in req.item_ids:
        update_fields = {}
        if req.new_status in ["Pending", "Stitched", "Delivered"]:
            update_fields["tailoring_status"] = req.new_status
        elif req.new_status in ["Required", "In Progress", "Finished"]:
            update_fields["embroidery_status"] = req.new_status
            if req.karigar:
                update_fields["karigar"] = req.karigar

        result = await db.items.update_one({"id": item_id}, {"$set": update_fields})
        if result.modified_count > 0:
            updated += 1

    return {"message": f"{updated} items moved to {req.new_status}"}

@router.post("/jobwork/move-back")
async def move_jobwork_back(req: MoveBackRequest, current_user: dict = Depends(get_current_user_dep)):
    TAILORING_PREV = {"Stitched": "Pending", "Delivered": "Stitched"}
    EMB_PREV = {"In Progress": "Required", "Finished": "In Progress"}
    updated = 0
    for item_id in req.item_ids:
        if req.current_status in TAILORING_PREV:
            update_fields = {"tailoring_status": TAILORING_PREV[req.current_status]}
        elif req.current_status in EMB_PREV:
            update_fields = {"embroidery_status": EMB_PREV[req.current_status]}
        else:
            continue
        result = await db.items.update_one({"id": item_id}, {"$set": update_fields})
        if result.modified_count > 0:
            updated += 1
    return {"message": f"{updated} items moved back"}

@router.post("/jobwork/move-emb")
async def move_embroidery(req: EmbMoveRequest, current_user: dict = Depends(get_current_user_dep)):
    updated = 0
    for item_id in req.item_ids:
        update_fields = {"embroidery_status": req.new_status}
        if req.emb_labour_amount is not None and req.emb_labour_amount > 0:
            update_fields["emb_labour_amount"] = req.emb_labour_amount
        if req.emb_customer_amount is not None and req.emb_customer_amount > 0:
            existing_emb_item = await db.items.find_one({"id": item_id}, {"_id": 0})
            existing_emb_received = float((existing_emb_item or {}).get("embroidery_received", 0))
            existing_emb_mode = (existing_emb_item or {}).get("embroidery_pay_mode", "Pending")
            emb_pending = round(req.emb_customer_amount - existing_emb_received, 2)
            emb_mode = existing_emb_mode if str(existing_emb_mode).startswith("Settled") else ("Pending" if existing_emb_received <= 0 else existing_emb_mode)
            update_fields["embroidery_amount"] = req.emb_customer_amount
            update_fields["embroidery_pending"] = emb_pending
            update_fields["embroidery_pay_mode"] = emb_mode
        result = await db.items.update_one({"id": item_id}, {"$set": update_fields})
        if result.modified_count > 0:
            updated += 1
    return {"message": f"{updated} embroidery items updated"}

@router.post("/jobwork/edit-emb")
async def edit_embroidery(req: EmbEditRequest, current_user: dict = Depends(get_current_user_dep)):
    update_fields = {}
    if req.karigar is not None:
        update_fields["karigar"] = req.karigar
    if req.emb_labour_amount is not None:
        update_fields["emb_labour_amount"] = req.emb_labour_amount
    if req.emb_customer_amount is not None:
        existing_edit_item = await db.items.find_one({"id": req.item_id}, {"_id": 0})
        existing_edit_received = float((existing_edit_item or {}).get("embroidery_received", 0))
        existing_edit_mode = (existing_edit_item or {}).get("embroidery_pay_mode", "Pending")
        edit_pending = round(req.emb_customer_amount - existing_edit_received, 2)
        edit_mode = existing_edit_mode if str(existing_edit_mode).startswith("Settled") else ("Pending" if existing_edit_received <= 0 else existing_edit_mode)
        update_fields["embroidery_amount"] = req.emb_customer_amount
        update_fields["embroidery_pending"] = edit_pending
        update_fields["embroidery_pay_mode"] = edit_mode
    if not update_fields:
        return {"message": "Nothing to update"}
    result = await db.items.update_one({"id": req.item_id}, {"$set": update_fields})
    return {"message": "Updated" if result.modified_count > 0 else "No change"}

@router.get("/jobwork/filters")
async def get_jobwork_filters(current_user: dict = Depends(get_current_user_dep)):
    order_nos = await db.items.distinct("order_no", {"order_no": {"$ne": "N/A"}})
    dates = await db.items.distinct("date")
    delivery_dates = await db.items.distinct("delivery_date", {"delivery_date": {"$ne": "N/A"}})
    return {
        "order_nos": sorted([o for o in order_nos if o]),
        "dates": sorted([d for d in dates if d], reverse=True),
        "delivery_dates": sorted([d for d in delivery_dates if d], reverse=True),
    }

# ==========================================
# SETTLEMENTS
# ==========================================

