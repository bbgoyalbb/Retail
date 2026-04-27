"""
Settlements router.
"""
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
from .models import SettlementRequest

router = APIRouter()

@router.get("/settlements/balances")
async def get_settlement_balances(name: Optional[str] = None, ref: Optional[str] = None, current_user: dict = Depends(get_current_user_dep)):
    import asyncio
    if not ref:
        return {"fabric": 0, "tailoring": 0, "embroidery": 0, "addon": 0, "advance": 0}

    _ns = {"$not": {"$regex": "^Settled"}}
    facet_pipeline = [{"$match": {"ref": ref}}, {"$facet": {
        "fab":  [{"$match": {"fabric_amount":     {"$gt": 0}, "fabric_pay_mode":     _ns}}, {"$group": {"_id": None, "t": {"$sum": "$fabric_pending"}}}],
        "tail": [{"$match": {"tailoring_amount":  {"$gt": 0}, "tailoring_pay_mode":  _ns}}, {"$group": {"_id": None, "t": {"$sum": "$tailoring_pending"}}}],
        "emb":  [{"$match": {"embroidery_amount": {"$gt": 0}, "embroidery_pay_mode": _ns}}, {"$group": {"_id": None, "t": {"$sum": "$embroidery_pending"}}}],
        "addon":[{"$match": {"addon_amount":      {"$gt": 0}, "addon_pay_mode":      _ns}}, {"$group": {"_id": None, "t": {"$sum": "$addon_pending"}}}],
    }}]
    pipeline_adv = [{"$match": {"ref": ref}}, {"$group": {"_id": None, "total": {"$sum": "$amount"}}}]

    items_res, adv = await asyncio.gather(
        db.items.aggregate(facet_pipeline).to_list(1),
        db.advances.aggregate(pipeline_adv).to_list(1),
    )

    r = items_res[0] if items_res else {}
    return {
        "fabric":    r["fab"][0]["t"]  if r.get("fab")  else 0,
        "tailoring": r["tail"][0]["t"] if r.get("tail") else 0,
        "embroidery":r["emb"][0]["t"]  if r.get("emb")  else 0,
        "addon":     r["addon"][0]["t"] if r.get("addon") else 0,
        "advance":   adv[0]["total"]   if adv           else 0,
    }

@router.post("/settlements/pay")
async def process_settlement(req: SettlementRequest, current_user: dict = Depends(get_current_user_dep)):
    modes_str = ", ".join(req.payment_modes) if req.payment_modes else "Cash"
    total_allocated = round_money(
        req.allot_fabric + req.allot_tailoring + req.allot_embroidery + req.allot_addon + req.allot_advance
    )
    fresh_payment = round_money(req.fresh_payment)

    if total_allocated <= 0:
        raise HTTPException(status_code=400, detail="Please allocate at least some amount")

    current_balances = await get_settlement_balances(ref=req.ref)

    available_advance = round_money(current_balances["advance"])
    advance_to_use = 0.0
    if req.use_advance:
        advance_to_use = min(available_advance, max(0.0, round_money(total_allocated - fresh_payment)))

    if fresh_payment + advance_to_use < total_allocated - 0.01:
        raise HTTPException(status_code=400,
            detail=f"Payment shortfall: allocated ₹{total_allocated:.2f} but only ₹{fresh_payment + advance_to_use:.2f} available")

    # Over-payment is allowed: excess is distributed pro-rata and pending goes negative.
    # Pool-match is validated on the frontend as a warning, not a hard block here.

    # Fetch items ONCE for all categories - prevents 4x database round trips
    all_items = await db.items.find({"ref": req.ref}, {"_id": 0}).to_list(500)
    
    async def apply_pro_rata(pay_mode_field, pay_date_field, received_field, pending_field, total_to_pay):
        amount_field = pending_field.replace("_pending", "_amount")
        eligible = [i for i in all_items if round_money(i.get(amount_field, 0)) > 0]
        if not eligible:
            return

        total_weight = sum(round_money(i.get(amount_field, 0)) for i in eligible)
        running_paid = 0
        bulk_ops = []

        for idx, item in enumerate(eligible):
            weight = round_money(item.get(amount_field, 0))
            bal = round_money(item.get(pending_field, 0))
            if idx == len(eligible) - 1:
                share = round_money(total_to_pay - running_paid)
            else:
                share = round_money((weight / total_weight) * total_to_pay) if total_weight > 0 else 0
                running_paid += share

            existing_received = round_money(item.get(received_field, 0))
            new_received = round_money(existing_received + share)
            new_balance = round_money(bal - share)
            update = {
                pay_date_field: req.payment_date,
                received_field: new_received,
                pending_field: new_balance,
                pay_mode_field: build_payment_mode_label(req.payment_modes, new_balance, new_received),
            }
            bulk_ops.append(UpdateOne({"id": item["id"]}, {"$set": update}))

        if bulk_ops:
            await db.items.bulk_write(bulk_ops, ordered=False)

    if req.allot_fabric > 0:
        await apply_pro_rata("fabric_pay_mode", "fabric_pay_date", "fabric_received", "fabric_pending", req.allot_fabric)
    if req.allot_tailoring > 0:
        await apply_pro_rata("tailoring_pay_mode", "tailoring_pay_date", "tailoring_received", "tailoring_pending", req.allot_tailoring)
    if req.allot_embroidery > 0:
        await apply_pro_rata("embroidery_pay_mode", "embroidery_pay_date", "embroidery_received", "embroidery_pending", req.allot_embroidery)
    if req.allot_addon > 0:
        await apply_pro_rata("addon_pay_mode", "addon_pay_date", "addon_received", "addon_pending", req.allot_addon)

    if req.allot_advance > 0:
        adv = {
            "id": str(uuid.uuid4()),
            "date": req.payment_date,
            "name": req.customer_name,
            "ref": req.ref,
            "amount": req.allot_advance,
            "mode": modes_str,
            "tally": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.advances.insert_one(adv)

    if advance_to_use > 0:
        adjustment = {
            "id": str(uuid.uuid4()),
            "date": req.payment_date,
            "name": req.customer_name,
            "ref": req.ref,
            "amount": -advance_to_use,
            "mode": "Adjusted",
            "tally": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.advances.insert_one(adjustment)

    return {"message": "Settlement processed successfully"}

# ==========================================
# DAYBOOK
# ==========================================

