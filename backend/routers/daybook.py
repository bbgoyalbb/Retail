"""
Daybook router.
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
from .models import TallyRequest

router = APIRouter()

@router.get("/daybook")
async def get_daybook(date_filter: Optional[str] = None, current_user: dict = Depends(get_current_user_dep)):
    # Key: (date, ref) — each unique pay-date × ref combination is a separate row
    entries = {}

    def get_or_create(date, ref, name):
        key = (date, ref)
        if key not in entries:
            entries[key] = {
                "date": date,
                "ref": ref,
                "name": name,
                "fabric": 0, "tailoring": 0, "embroidery": 0, "addon": 0, "advance": 0, "total": 0,
                "modes": {"fabric": "", "tailoring": "", "embroidery": "", "addon": "", "advance": ""},
                "tally_status": {"fabric": False, "tailoring": False, "embroidery": False, "addon": False, "advance": False},
            }
        return entries[key]

    item_query = {}
    if date_filter and date_filter != "All":
        item_query["$or"] = [
            {"fabric_pay_date": date_filter},
            {"tailoring_pay_date": date_filter},
            {"embroidery_pay_date": date_filter},
            {"addon_pay_date": date_filter},
        ]

    items = await db.items.find(item_query if date_filter and date_filter != "All" else {}, {"_id": 0}).to_list(2000)

    categories = [
        ("fabric",     "fabric_pay_date",     "fabric_received",     "fabric_pay_mode",     "tally_fabric"),
        ("tailoring",  "tailoring_pay_date",  "tailoring_received",  "tailoring_pay_mode",  "tally_tailoring"),
        ("embroidery", "embroidery_pay_date", "embroidery_received", "embroidery_pay_mode", "tally_embroidery"),
        ("addon",      "addon_pay_date",      "addon_received",      "addon_pay_mode",      "tally_addon"),
    ]

    for item in items:
        ref  = item.get("ref", "")
        name = item.get("name", "")
        for cat_name, date_field, received_field, mode_field, tally_field in categories:
            pay_date = item.get(date_field, "N/A")
            received = item.get(received_field, 0)
            if pay_date == "N/A" or not received:
                continue
            if date_filter and date_filter != "All" and pay_date != date_filter:
                continue

            e = get_or_create(pay_date, ref, name)
            e[cat_name]  += received
            e["total"]   += received
            e["tally_status"][cat_name] = item.get(tally_field, False)
            mode = item.get(mode_field, "")
            if mode:
                e["modes"][cat_name] = mode

    adv_query = {}
    if date_filter and date_filter != "All":
        adv_query["date"] = date_filter

    advances = await db.advances.find(adv_query, {"_id": 0}).to_list(500)
    for adv in advances:
        amount = adv.get("amount", 0)
        if not amount:
            continue
        ref      = adv.get("ref", "")
        adv_date = adv.get("date", "")
        if not adv_date:
            continue
        if date_filter and date_filter != "All" and adv_date != date_filter:
            continue

        e = get_or_create(adv_date, ref, adv.get("name", ""))
        e["advance"] += amount
        e["total"]   += amount
        e["tally_status"]["advance"] = adv.get("tally", False)
        mode = adv.get("mode", "")
        if mode:
            e["modes"]["advance"] = mode

    return {"entries": list(entries.values())}

@router.get("/daybook/dates")
async def get_daybook_dates(current_user: dict = Depends(get_current_user_dep)):
    import asyncio
    # Single aggregation: project all 4 pay-date fields into an array, unwind, group distinct values
    pipeline = [
        {"$project": {"dates": ["$fabric_pay_date", "$tailoring_pay_date", "$embroidery_pay_date", "$addon_pay_date"]}},
        {"$unwind": "$dates"},
        {"$match": {"dates": {"$nin": [None, "", "N/A"]}}},
        {"$group": {"_id": "$dates"}},
    ]
    item_dates_res, adv_dates_res = await asyncio.gather(
        db.items.aggregate(pipeline).to_list(2000),
        db.advances.distinct("date"),
    )
    dates = set(r["_id"] for r in item_dates_res)
    for v in adv_dates_res:
        if v:
            dates.add(v)
    return sorted(list(dates), reverse=True)

@router.get("/daybook/pending-count")
async def get_daybook_pending_count(current_user: dict = Depends(get_current_user_dep)):
    """Return the number of untallied payment entries for today."""
    import asyncio
    today = date.today().isoformat()
    facet_pipeline = [{"$facet": {
        "fab":  [{"$match": {"fabric_pay_date":     today, "fabric_received":     {"$gt": 0}, "tally_fabric":     {"$ne": True}}}, {"$count": "n"}],
        "tail": [{"$match": {"tailoring_pay_date":  today, "tailoring_received":  {"$gt": 0}, "tally_tailoring":  {"$ne": True}}}, {"$count": "n"}],
        "emb":  [{"$match": {"embroidery_pay_date": today, "embroidery_received": {"$gt": 0}, "tally_embroidery": {"$ne": True}}}, {"$count": "n"}],
        "ao":   [{"$match": {"addon_pay_date":      today, "addon_received":      {"$gt": 0}, "tally_addon":      {"$ne": True}}}, {"$count": "n"}],
    }}]
    items_res, adv_count = await asyncio.gather(
        db.items.aggregate(facet_pipeline).to_list(1),
        db.advances.count_documents({"date": today, "tally": {"$ne": True}}),
    )
    f = items_res[0] if items_res else {}
    count = (
        (f["fab"][0]["n"]  if f.get("fab")  else 0) +
        (f["tail"][0]["n"] if f.get("tail") else 0) +
        (f["emb"][0]["n"]  if f.get("emb")  else 0) +
        (f["ao"][0]["n"]   if f.get("ao")   else 0) +
        adv_count
    )
    return {"count": count}

@router.post("/daybook/tally")
async def tally_entries(req: TallyRequest, current_user: dict = Depends(get_current_user_dep)):
    tally_value = req.action == "tally"

    date_field_map = {
        "fabric":     ("tally_fabric",     "fabric_pay_date"),
        "tailoring":  ("tally_tailoring",  "tailoring_pay_date"),
        "embroidery": ("tally_embroidery", "embroidery_pay_date"),
        "addon":      ("tally_addon",      "addon_pay_date"),
    }

    if req.category == "advance":
        for entry_ref in req.entry_ids:
            adv_query = {"ref": entry_ref}
            if req.date:
                adv_query["date"] = req.date
            await db.advances.update_many(adv_query, {"$set": {"tally": tally_value}})
    elif req.category == "all":
        for entry_ref in req.entry_ids:
            # Update each category scoped to its own pay_date
            for cat, (tally_field, pay_date_field) in date_field_map.items():
                item_query = {"ref": entry_ref}
                if req.date:
                    item_query[pay_date_field] = req.date
                await db.items.update_many(item_query, {"$set": {tally_field: tally_value}})
            adv_query = {"ref": entry_ref}
            if req.date:
                adv_query["date"] = req.date
            await db.advances.update_many(adv_query, {"$set": {"tally": tally_value}})
    elif req.category in date_field_map:
        tally_field, pay_date_field = date_field_map[req.category]
        for entry_ref in req.entry_ids:
            item_query = {"ref": entry_ref}
            if req.date:
                item_query[pay_date_field] = req.date
            await db.items.update_many(item_query, {"$set": {tally_field: tally_value}})

    return {"message": f"{len(req.entry_ids)} entries {req.action}ed"}

# ==========================================
# LABOUR PAYMENTS
# ==========================================

