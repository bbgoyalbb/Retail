"""
Daybook router.
"""
import asyncio
import time
from fastapi import APIRouter, HTTPException, Query, Depends, Request
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, date, timedelta
import uuid
import re
from bson import ObjectId
from .deps import get_db, get_current_user_dep
from data_quality import round_money, determine_payment_status, build_payment_mode_label
import auth as auth_module
from auth import audit_log
from .models import TallyRequest

router = APIRouter()

_daybook_dates_cache: list = []
_daybook_dates_cache_time: float = 0.0
_DAYBOOK_DATES_TTL: float = 60.0

async def _build_daybook_entries(db, date_filter: Optional[str] = None):
    """Helper function to build daybook entries - shared between endpoints."""
    # Default to last 12 months when no date filter specified (prevents unbounded scans)
    if not date_filter or date_filter == "All":
        twelve_months_ago = (datetime.now(timezone.utc) - timedelta(days=365)).strftime("%Y-%m-%d")
    else:
        twelve_months_ago = None
    
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

    item_query = {"cancelled": {"$ne": True}}
    if date_filter and date_filter != "All":
        item_query["$or"] = [
            {"fabric_pay_date": date_filter},
            {"tailoring_pay_date": date_filter},
            {"embroidery_pay_date": date_filter},
            {"addon_pay_date": date_filter},
        ]
    elif twelve_months_ago:
        # Restrict to last 12 months of payment dates
        item_query["$or"] = [
            {"fabric_pay_date": {"$gte": twelve_months_ago}},
            {"tailoring_pay_date": {"$gte": twelve_months_ago}},
            {"embroidery_pay_date": {"$gte": twelve_months_ago}},
            {"addon_pay_date": {"$gte": twelve_months_ago}},
        ]

    _DAYBOOK_PROJ = {
        "_id": 0, "ref": 1, "name": 1,
        "fabric_pay_date": 1,     "fabric_received": 1,     "fabric_pay_mode": 1,     "tally_fabric": 1,
        "tailoring_pay_date": 1,  "tailoring_received": 1,  "tailoring_pay_mode": 1,  "tailoring_tailoring": 1,
        "embroidery_pay_date": 1, "embroidery_received": 1, "embroidery_pay_mode": 1, "tally_embroidery": 1,
        "addon_pay_date": 1,      "addon_received": 1,      "addon_pay_mode": 1,      "tally_addon": 1,
    }
    items = await db.items.find(item_query if (date_filter and date_filter != "All") or twelve_months_ago else {}, _DAYBOOK_PROJ).to_list(2000)

    categories = [
        ("fabric",     "fabric_pay_date",     "fabric_received",     "fabric_pay_mode",     "tally_fabric"),
        ("tailoring",  "tailoring_pay_date",  "tailoring_received",  "tailoring_pay_mode",  "tailoring"),
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

    return list(entries.values())

@router.get("/daybook")
async def get_daybook(db = Depends(get_db), date_filter: Optional[str] = None, current_user: dict = Depends(get_current_user_dep)):
    entries = await _build_daybook_entries(db, date_filter)
    
    # Debug: log entries with untallied tailoring for specific refs
    debug_refs = ["07/120426", "03/010426", "01/040426"]
    for e in entries:
        if e["ref"] in debug_refs and e["tailoring"] > 0:
            print(f"DEBUG DAYBOOK: date={e['date']}, ref={e['ref']}, tailoring={e['tailoring']}, tally_tailoring={e['tally_status']['tailoring']}, date_filter={date_filter}")
    
    return {"entries": entries}

@router.get("/daybook/dates")
async def get_daybook_dates(db = Depends(get_db), current_user: dict = Depends(get_current_user_dep)):
    global _daybook_dates_cache, _daybook_dates_cache_time
    if _daybook_dates_cache and (time.monotonic() - _daybook_dates_cache_time) < _DAYBOOK_DATES_TTL:
        return _daybook_dates_cache
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
    result = sorted(list(dates), reverse=True)
    _daybook_dates_cache = result
    _daybook_dates_cache_time = time.monotonic()
    return result

@router.get("/daybook/pending-count")
async def get_daybook_pending_count(db = Depends(get_db), current_user: dict = Depends(get_current_user_dep)):
    """Return the number of untallied payment entries across all dates.
    Uses the exact same logic as the daybook endpoint and frontend isFullyTallied.
    """
    # Get ALL entries (no date filter)
    entries = await _build_daybook_entries(db, date_filter=None)
    
    # Apply the exact same logic as frontend isFullyTallied
    count = 0
    for entry in entries:
        ts = entry.get("tally_status", {})
        # Check each category - if amount > 0 and not tallied, entry is pending
        if (entry.get("fabric", 0) > 0 and not ts.get("fabric")) or \
           (entry.get("tailoring", 0) > 0 and not ts.get("tailoring")) or \
           (entry.get("embroidery", 0) > 0 and not ts.get("embroidery")) or \
           (entry.get("addon", 0) > 0 and not ts.get("addon")) or \
           (entry.get("advance", 0) != 0 and not ts.get("advance")):
            count += 1
    
    return {"count": count}

@router.post("/daybook/tally")
async def tally_entries(req: TallyRequest, db = Depends(get_db), current_user: dict = Depends(get_current_user_dep)):
    tally_value = req.action == "tally"

    date_field_map = {
        "fabric":     ("tally_fabric",     "fabric_pay_date"),
        "tailoring":  ("tally_tailoring",  "tailoring_pay_date"),
        "embroidery": ("tally_embroidery", "embroidery_pay_date"),
        "addon":      ("tally_addon",      "addon_pay_date"),
    }

    refs = req.entry_ids
    
    # Debug logging
    print(f"DEBUG TALLY: action={req.action}, category={req.category}, date={req.date}, refs={refs}")
    
    # CRITICAL: Date is REQUIRED to prevent accidental mass tally/untally across all dates
    if not req.date:
        raise HTTPException(status_code=400, detail="Date is required for tally operations to prevent accidental mass updates")
    
    if req.category == "advance":
        adv_query = {"ref": {"$in": refs}, "date": req.date}
        await db.advances.update_many(adv_query, {"$set": {"tally": tally_value}})
    elif req.category == "all":
        coros = []
        for cat, (tally_field, pay_date_field) in date_field_map.items():
            item_query = {"ref": {"$in": refs}, pay_date_field: req.date}
            coros.append(db.items.update_many(item_query, {"$set": {tally_field: tally_value}}))
        adv_query = {"ref": {"$in": refs}, "date": req.date}
        coros.append(db.advances.update_many(adv_query, {"$set": {"tally": tally_value}}))
        await asyncio.gather(*coros)
    elif req.category in date_field_map:
        tally_field, pay_date_field = date_field_map[req.category]
        item_query = {"ref": {"$in": refs}, pay_date_field: req.date}
        
        # Debug: log current database state before update
        current_items = await db.items.find(item_query, {"_id": 0, "ref": 1, tally_field: 1, pay_date_field: 1}).to_list(10)
        print(f"DEBUG TALLY BEFORE: category={req.category}, date={req.date}, refs={refs}")
        for item in current_items:
            print(f"  ref={item['ref']}, {pay_date_field}={item.get(pay_date_field)}, {tally_field}={item.get(tally_field)}")
        
        result = await db.items.update_many(item_query, {"$set": {tally_field: tally_value}})
        print(f"DEBUG TALLY RESULT: matched={result.matched_count}, modified={result.modified_count}")

    # Audit log the tally action
    await audit_log(db, req.action, current_user, "daybook", ",".join(req.entry_ids[:10]),  # Limit to first 10 refs
                    {"category": req.category, "date": req.date, "count": len(req.entry_ids)})

    return {"message": f"{len(req.entry_ids)} entries {req.action}ed"}

# ==========================================
# LABOUR PAYMENTS
# ==========================================

