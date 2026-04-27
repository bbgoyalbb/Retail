"""
Bills router.
"""
from fastapi import APIRouter, HTTPException, Query, Depends, Request
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, date
import uuid
import re
import os
import logging
logger = logging.getLogger(__name__)
from bson import ObjectId
from .deps import db, get_current_user_dep
from data_quality import round_money, determine_payment_status, build_payment_mode_label
import auth as auth_module
from auth import audit_log
from .models import ADDON_ITEMS, ARTICLE_TYPES, BillLineItem, CreateBillRequest, PAYMENT_MODES, TAILORING_RATES, validate_date

def safe_float(v):
    if v is None or str(v).strip() in ("N/A", "", "None"):
        return 0
    try:
        return float(v)
    except (ValueError, TypeError):
        return 0

def safe_str(v):
    if v is None:
        return "N/A"
    return str(v).strip()

router = APIRouter()

@router.post("/seed")
async def seed_data(current_user: dict = Depends(get_current_user_dep)):
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    count = await db.items.count_documents({})
    if count > 0:
        return {"message": "Data already seeded", "items_count": count}

    try:
        import openpyxl
        wb_path = "/tmp/retail_book.xlsm"
        if not os.path.exists(wb_path):
            return {"message": "Excel file not found at /tmp/retail_book.xlsm"}

        wb = openpyxl.load_workbook(wb_path, data_only=True)

        ws = wb['Item Details']
        items = []
        for row in ws.iter_rows(min_row=2, max_row=ws.max_row, values_only=True):
            if not row[0]:
                continue
            dt = row[0]
            date_str = dt.strftime("%Y-%m-%d") if hasattr(dt, 'strftime') else str(dt)[:10]

            fab_pay_date = ""
            if row[18] and hasattr(row[18], 'strftime'):
                fab_pay_date = row[18].strftime("%Y-%m-%d")

            delivery_date = ""
            if row[11] and hasattr(row[11], 'strftime'):
                delivery_date = row[11].strftime("%Y-%m-%d")

            tail_pay_date = ""
            if row[25] and hasattr(row[25], 'strftime'):
                tail_pay_date = row[25].strftime("%Y-%m-%d")

            emb_pay_date = ""
            if row[29] and hasattr(row[29], 'strftime'):
                emb_pay_date = row[29].strftime("%Y-%m-%d")

            addon_pay_date = ""
            if row[33] and hasattr(row[33], 'strftime'):
                addon_pay_date = row[33].strftime("%Y-%m-%d")

            labour_pay_date = ""
            if row[23] and hasattr(row[23], 'strftime'):
                labour_pay_date = row[23].strftime("%Y-%m-%d")

            item = {
                "id": str(uuid.uuid4()),
                "date": date_str,
                "name": safe_str(row[1]),
                "ref": safe_str(row[2]),
                "barcode": safe_str(row[3]),
                "price": safe_float(row[4]),
                "qty": safe_float(row[5]),
                "discount": safe_float(row[6]),
                "fabric_amount": safe_float(row[7]),
                "tailoring_status": safe_str(row[8]),
                "article_type": safe_str(row[9]),
                "order_no": safe_str(row[10]),
                "delivery_date": delivery_date if delivery_date else "N/A",
                "tailoring_amount": safe_float(row[12]),
                "embroidery_status": safe_str(row[13]),
                "embroidery_amount": safe_float(row[14]),
                "addon_desc": safe_str(row[15]),
                "addon_amount": safe_float(row[16]),
                "fabric_pay_mode": safe_str(row[17]),
                "fabric_pay_date": fab_pay_date if fab_pay_date else "N/A",
                "fabric_pending": safe_float(row[19]),
                "fabric_received": safe_float(row[20]),
                "labour_amount": safe_float(row[21]),
                "labour_paid": safe_str(row[22]),
                "labour_pay_date": labour_pay_date if labour_pay_date else "N/A",
                "tailoring_pay_mode": safe_str(row[24]),
                "tailoring_pay_date": tail_pay_date if tail_pay_date else "N/A",
                "tailoring_received": safe_float(row[26]),
                "tailoring_pending": safe_float(row[27]),
                "embroidery_pay_mode": safe_str(row[28]),
                "embroidery_pay_date": emb_pay_date if emb_pay_date else "N/A",
                "embroidery_received": safe_float(row[30]),
                "embroidery_pending": safe_float(row[31]),
                "addon_pay_mode": safe_str(row[32]),
                "addon_pay_date": addon_pay_date if addon_pay_date else "N/A",
                "addon_received": safe_float(row[34]),
                "addon_pending": safe_float(row[35]),
                "karigar": safe_str(row[36]) if len(row) > 36 else "N/A",
                "tally_fabric": False,
                "tally_tailoring": False,
                "tally_embroidery": False,
                "tally_addon": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            items.append(item)

        if items:
            await db.items.insert_many(items)

        ws2 = wb['Advances']
        advances = []
        for row in ws2.iter_rows(min_row=2, max_row=ws2.max_row, values_only=True):
            if not row[0]:
                continue
            dt = row[0]
            date_str = dt.strftime("%Y-%m-%d") if hasattr(dt, 'strftime') else str(dt)[:10]
            adv = {
                "id": str(uuid.uuid4()),
                "date": date_str,
                "name": str(row[1]).strip() if row[1] else "",
                "ref": str(row[2]).strip() if row[2] else "",
                "amount": float(row[3]) if row[3] else 0,
                "mode": str(row[4]).strip() if row[4] else "",
                "tally": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            advances.append(adv)

        if advances:
            await db.advances.insert_many(advances)

        return {"message": "Data seeded successfully", "items_count": len(items), "advances_count": len(advances)}
    except Exception as e:
        logger.error(f"Seed error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# ==========================================
# DASHBOARD
# ==========================================

@router.get("/dashboard")
async def get_dashboard(current_user: dict = Depends(get_current_user_dep)):
    import asyncio
    from datetime import date, timedelta

    _ns = {"$not": {"$regex": "^Settled"}}

    # Build 7-day date list for trend
    days = [(date.today() - timedelta(days=i)).isoformat() for i in range(6, -1, -1)]

    today = date.today().isoformat()

    # Single $facet aggregation covers all pending sums, status counts, revenue, trend — 1 DB round trip
    facet_pipeline = [{"$facet": {
        "fab_pending":  [{"$match": {"fabric_amount":     {"$gt": 0}, "fabric_pay_mode":     _ns}}, {"$group": {"_id": None, "t": {"$sum": "$fabric_pending"}}}],
        "tail_pending": [{"$match": {"tailoring_amount":  {"$gt": 0}, "tailoring_pay_mode":  _ns}}, {"$group": {"_id": None, "t": {"$sum": "$tailoring_pending"}}}],
        "emb_pending":  [{"$match": {"embroidery_amount": {"$gt": 0}, "embroidery_pay_mode": _ns}}, {"$group": {"_id": None, "t": {"$sum": "$embroidery_pending"}}}],
        "addon_pending":[{"$match": {"addon_amount":      {"$gt": 0}, "addon_pay_mode":      _ns}}, {"$group": {"_id": None, "t": {"$sum": "$addon_pending"}}}],
        "revenue":      [{"$group": {"_id": None, "t": {"$sum": "$fabric_received"}}}],
        "tail_pend_ct": [{"$match": {"tailoring_status": "Pending"}},     {"$count": "n"}],
        "tail_stit_ct": [{"$match": {"tailoring_status": "Stitched"}},    {"$count": "n"}],
        "emb_req_ct":   [{"$match": {"embroidery_status": "Required"}},   {"$count": "n"}],
        "emb_prog_ct":  [{"$match": {"embroidery_status": "In Progress"}},{"$count": "n"}],
        "trend":        [{"$match": {"date": {"$in": days}}}, {"$group": {"_id": "$date", "t": {"$sum": "$fabric_received"}}}],
        "customers":    [{"$group": {"_id": "$name"}}],
        "total_ct":     [{"$count": "n"}],
        "today_refs":   [{"$match": {"date": today}}, {"$group": {"_id": "$ref"}}],
        "today_collected": [{"$match": {"date": today}}, {"$group": {"_id": None,
            "t": {"$sum": {"$add": ["$fabric_received", "$tailoring_received", "$embroidery_received", "$addon_received"]}}
        }}],
        "overdue_orders": [{"$match": {"delivery_date": {"$lt": today, "$gt": ""}, "tailoring_status": {"$in": ["Pending", "Stitched"]}}}, {"$count": "n"}],
    }}]

    pipeline_recent = [
        {"$sort": {"date": -1, "ref": -1}},
        {"$group": {"_id": "$ref", "date": {"$first": "$date"}, "name": {"$first": "$name"},
            "total": {"$sum": {"$add": ["$fabric_amount", "$tailoring_amount", "$embroidery_amount", "$addon_amount"]}},
            "item_count": {"$sum": 1}}},
        {"$sort": {"date": -1}},
        {"$limit": 10},
        {"$project": {"_id": 0, "ref": "$_id", "date": 1, "name": 1, "total": 1, "item_count": 1}}
    ]
    pipeline_adv = [{"$facet": {
        "total_ct":  [{"$count": "n"}],
        "total_amt": [{"$group": {"_id": None, "t": {"$sum": "$amount"}}}],
    }}]

    # Run all 3 aggregations concurrently
    facet_res, recent_items, adv_res = await asyncio.gather(
        db.items.aggregate(facet_pipeline).to_list(1),
        db.items.aggregate(pipeline_recent).to_list(10),
        db.advances.aggregate(pipeline_adv).to_list(1),
    )

    f = facet_res[0] if facet_res else {}
    a = adv_res[0] if adv_res else {}

    trend_map = {r["_id"]: r["t"] for r in f.get("trend", [])}
    trend_data = [trend_map.get(d, 0) for d in days]

    return {
        "total_items":               f["total_ct"][0]["n"]   if f.get("total_ct")     else 0,
        "revenue_trend":             trend_data,
        "total_advances":            a["total_ct"][0]["n"]   if a.get("total_ct")     else 0,
        "fabric_pending_amount":     f["fab_pending"][0]["t"]  if f.get("fab_pending")  else 0,
        "tailoring_pending_amount":  f["tail_pending"][0]["t"] if f.get("tail_pending") else 0,
        "embroidery_pending_amount": f["emb_pending"][0]["t"]  if f.get("emb_pending")  else 0,
        "addon_pending_amount":      f["addon_pending"][0]["t"] if f.get("addon_pending") else 0,
        "tailoring_pending_count":   f["tail_pend_ct"][0]["n"] if f.get("tail_pend_ct") else 0,
        "tailoring_stitched_count":  f["tail_stit_ct"][0]["n"] if f.get("tail_stit_ct") else 0,
        "embroidery_required_count": f["emb_req_ct"][0]["n"]   if f.get("emb_req_ct")   else 0,
        "embroidery_inprogress_count":f["emb_prog_ct"][0]["n"] if f.get("emb_prog_ct")  else 0,
        "unique_customers":          len(f.get("customers", [])),
        "total_revenue":             f["revenue"][0]["t"]       if f.get("revenue")      else 0,
        "total_advances_amount":     a["total_amt"][0]["t"]    if a.get("total_amt")    else 0,
        "today_bills_count":         len(f.get("today_refs", [])),
        "today_collected":           f["today_collected"][0]["t"] if f.get("today_collected") else 0,
        "overdue_orders_count":      f["overdue_orders"][0]["n"]  if f.get("overdue_orders")  else 0,
        "recent_items":              recent_items,
    }

# ==========================================
# CUSTOMERS
# ==========================================

@router.get("/customers")
async def get_customers(pending_only: bool = False, current_user: dict = Depends(get_current_user_dep)):
    if pending_only:
        _ns = {"$not": {"$regex": "^Settled"}}
        pipeline = [
            {"$match": {"$or": [
                {"fabric_amount": {"$gt": 0}, "fabric_pay_mode": _ns},
                {"tailoring_amount": {"$gt": 0}, "tailoring_pay_mode": _ns},
                {"embroidery_amount": {"$gt": 0}, "embroidery_pay_mode": _ns},
                {"addon_amount": {"$gt": 0}, "addon_pay_mode": _ns},
            ]}},
            {"$group": {"_id": "$name"}},
        ]
        result = await db.items.aggregate(pipeline).to_list(1000)
        return sorted([r["_id"] for r in result if r["_id"] and r["_id"] != "N/A"])
    customers = await db.items.distinct("name")
    return sorted([c for c in customers if c and c != "N/A"])

# ==========================================
# ITEMS CRUD
# ==========================================

@router.get("/items")
async def get_items(
    name: Optional[str] = None,
    ref: Optional[str] = None,
    date: Optional[str] = None,
    tailoring_status: Optional[str] = None,
    embroidery_status: Optional[str] = None,
    order_no: Optional[str] = None,
    limit: int = 500,
    skip: int = 0,
    summary: bool = False,
    current_user: dict = Depends(get_current_user_dep),
):
    import asyncio
    query = {}
    if name:
        query["name"] = name
    if ref:
        query["ref"] = ref
    if date:
        query["date"] = date
    if tailoring_status:
        query["tailoring_status"] = tailoring_status
    if embroidery_status:
        query["embroidery_status"] = embroidery_status
    if order_no:
        query["order_no"] = order_no

    # summary=true returns only the fields needed for the ItemsManager grid rows
    projection = {"_id": 0}
    if summary:
        for f in ["id", "ref", "name", "date", "order_no", "cancelled",
                  "fabric_amount", "fabric_received", "fabric_pending", "fabric_pay_mode",
                  "tailoring_amount", "tailoring_received", "tailoring_pending", "tailoring_pay_mode",
                  "embroidery_amount", "embroidery_received", "embroidery_pending", "embroidery_pay_mode",
                  "addon_amount", "addon_received", "addon_pending", "addon_pay_mode",
                  "barcode", "price", "qty", "discount",
                  "article_type", "order_no", "delivery_date", "tailoring_status", "embroidery_status",
                  "addon_desc", "karigar"]:
            projection[f] = 1

    items, total = await asyncio.gather(
        db.items.find(query, projection).sort("date", -1).skip(skip).limit(limit).to_list(limit),
        db.items.count_documents(query),
    )
    return {"items": items, "total": total}

@router.get("/items/{item_id}")
async def get_item(item_id: str, current_user: dict = Depends(get_current_user_dep)):
    item = await db.items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@router.get("/refs")
async def get_refs(name: Optional[str] = None, pending_only: bool = False, current_user: dict = Depends(get_current_user_dep)):
    query = {}
    if name:
        query["name"] = name
    if pending_only:
        _ns = {"$not": {"$regex": "^Settled"}}
        query["$or"] = [
            {"fabric_amount": {"$gt": 0}, "fabric_pay_mode": _ns},
            {"tailoring_amount": {"$gt": 0}, "tailoring_pay_mode": _ns},
            {"embroidery_amount": {"$gt": 0}, "embroidery_pay_mode": _ns},
            {"addon_amount": {"$gt": 0}, "addon_pay_mode": _ns},
        ]
    pipeline = [
        {"$match": query},
        {"$group": {"_id": "$ref"}},
        {"$sort": {"_id": -1}}
    ]
    refs = await db.items.aggregate(pipeline).to_list(500)
    return [r["_id"] for r in refs if r["_id"] and r["_id"] != "N/A"]

# ==========================================
# NEW BILL
# ==========================================

@router.post("/bills")
async def create_bill(req: CreateBillRequest, current_user: dict = Depends(get_current_user_dep)):
    if not req.items:
        raise HTTPException(status_code=400, detail="At least one item is required")

    # Validate dates
    try:
        validate_date(req.date, "bill date")
        validate_date(req.payment_date, "payment date")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Use atomic counter to prevent race conditions on bill ref generation
    try:
        parts = req.date.split("-")
        date_suffix = f"{parts[2]}{parts[1]}{parts[0][2:]}"
    except Exception:
        date_suffix = "000000"

    counter_key = f"bill_seq_{req.date}"

    # Seed the counter from the actual DB max if this counter doc is missing.
    # This handles back-dated bills where no counter doc exists yet, preventing
    # collision with refs already created for that date (e.g. via Excel import).
    existing_counter = await db.counters.find_one({"_id": counter_key})
    if not existing_counter:
        # Find highest existing seq for this date suffix in items collection
        existing_refs = await db.items.distinct("ref", {"date": req.date})
        max_seq = 0
        for r in existing_refs:
            try:
                max_seq = max(max_seq, int(r.split("/")[0]))
            except (ValueError, IndexError):
                pass
        if max_seq > 0:
            # Pre-seed the counter so next increment starts after the existing max
            await db.counters.insert_one({"_id": counter_key, "seq": max_seq})

    counter_doc = await db.counters.find_one_and_update(
        {"_id": counter_key},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    seq = counter_doc.get("seq", 1) if counter_doc else 1
    ref = f"{seq:02d}/{date_suffix}"

    # Safety check: if ref still collides (race condition), keep incrementing
    while await db.items.find_one({"ref": ref}):
        counter_doc = await db.counters.find_one_and_update(
            {"_id": counter_key},
            {"$inc": {"seq": 1}},
            upsert=True,
            return_document=True
        )
        seq = counter_doc.get("seq", 1) if counter_doc else seq + 1
        ref = f"{seq:02d}/{date_suffix}"
    modes_str = ", ".join(req.payment_modes) if req.payment_modes else "Cash"
    tailoring_status = "Awaiting Order" if req.needs_tailoring else "N/A"

    grand_total = 0
    for item in req.items:
        discounted_price = round(item.price - (item.price * item.discount / 100), 0)
        grand_total += round(discounted_price * item.qty, 0)

    # No hard block: amount_paid may be less than, equal to, or greater than grand_total.
    # Any amount received marks the section as Settled; pending stores the actual difference.

    items_to_insert = []
    running_paid = 0
    running_discount = 0

    for idx, item in enumerate(req.items):
        discounted_price = round(item.price - (item.price * item.discount / 100), 0)
        item_total = round(discounted_price * item.qty, 0)

        # Resolve per-item tailoring fields sent from NewBill frontend
        item_article_type  = item.article_type    or "N/A"
        item_order_no      = item.order_no        or "N/A"
        item_delivery_date = item.delivery_date   or "N/A"
        item_emb_status    = item.embroidery_status or "N/A"

        # If an order_no was already set on the line, tailoring starts as Pending
        item_tailoring_status = "Pending" if item_order_no != "N/A" else tailoring_status

        # Resolve addon fields from line item
        item_addons = item.addons or []
        item_addon_amount   = round(sum(float(a.get("price", 0)) for a in item_addons), 0)
        item_addon_desc     = ", ".join(a.get("name", "") for a in item_addons) if item_addons else "N/A"
        item_addon_pay_mode = "Pending" if item_addon_amount > 0 else "N/A"
        item_addon_pending  = item_addon_amount if item_addon_amount > 0 else 0

        # is_settled=True with amount_paid=0 must NOT mark fabric as Settled —
        # doing so hides the bill from the Settlements page permanently.
        effective_settled = req.is_settled and req.amount_paid > 0

        if effective_settled:
            total_diff = grand_total - req.amount_paid
            if idx == len(req.items) - 1:
                item_discount = total_diff - running_discount
                item_paid = req.amount_paid - running_paid
            else:
                item_discount = round(item_total * (total_diff / grand_total), 0) if grand_total > 0 else 0
                item_paid = round(item_total * (req.amount_paid / grand_total), 0) if grand_total > 0 else 0
                running_discount += item_discount
                running_paid += item_paid

            doc = {
                "id": str(uuid.uuid4()),
                "date": req.date,
                "name": req.customer_name,
                "ref": ref,
                "barcode": item.barcode,
                "price": item.price,
                "qty": item.qty,
                "discount": item.discount,
                "fabric_amount": item_total,
                "tailoring_status": item_tailoring_status,
                "article_type": item_article_type,
                "order_no": item_order_no,
                "delivery_date": item_delivery_date,
                "tailoring_amount": 0,
                "embroidery_status": item_emb_status,
                "embroidery_amount": 0,
                "addon_desc": item_addon_desc,
                "addon_amount": item_addon_amount,
                "fabric_pay_mode": f"Settled - {modes_str}",
                "fabric_pay_date": req.payment_date,
                "fabric_pending": item_discount,
                "fabric_received": item_paid,
                "labour_amount": 0,
                "labour_paid": "N/A",
                "labour_pay_date": "N/A",
                "tailoring_pay_mode": "N/A",
                "tailoring_pay_date": "N/A",
                "tailoring_received": 0,
                "tailoring_pending": 0,
                "embroidery_pay_mode": "N/A",
                "embroidery_pay_date": "N/A",
                "embroidery_received": 0,
                "embroidery_pending": 0,
                "addon_pay_mode": item_addon_pay_mode,
                "addon_pay_date": "N/A",
                "addon_received": 0,
                "addon_pending": item_addon_pending,
                "karigar": "N/A",
                "tally_fabric": False,
                "tally_tailoring": False,
                "tally_embroidery": False,
                "tally_addon": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
        else:
            doc = {
                "id": str(uuid.uuid4()),
                "date": req.date,
                "name": req.customer_name,
                "ref": ref,
                "barcode": item.barcode,
                "price": item.price,
                "qty": item.qty,
                "discount": item.discount,
                "fabric_amount": item_total,
                "tailoring_status": item_tailoring_status,
                "article_type": item_article_type,
                "order_no": item_order_no,
                "delivery_date": item_delivery_date,
                "tailoring_amount": 0,
                "embroidery_status": item_emb_status,
                "embroidery_amount": 0,
                "addon_desc": item_addon_desc,
                "addon_amount": item_addon_amount,
                "fabric_pay_mode": "Pending",
                "fabric_pay_date": "N/A",
                "fabric_pending": item_total,
                "fabric_received": 0,
                "labour_amount": 0,
                "labour_paid": "N/A",
                "labour_pay_date": "N/A",
                "tailoring_pay_mode": "N/A",
                "tailoring_pay_date": "N/A",
                "tailoring_received": 0,
                "tailoring_pending": 0,
                "embroidery_pay_mode": "N/A",
                "embroidery_pay_date": "N/A",
                "embroidery_received": 0,
                "embroidery_pending": 0,
                "addon_pay_mode": item_addon_pay_mode,
                "addon_pay_date": "N/A",
                "addon_received": 0,
                "addon_pending": item_addon_pending,
                "karigar": "N/A",
                "tally_fabric": False,
                "tally_tailoring": False,
                "tally_embroidery": False,
                "tally_addon": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }

        items_to_insert.append(doc)

    if items_to_insert:
        await db.items.insert_many(items_to_insert)

    if not req.is_settled and req.amount_paid > 0:
        adv = {
            "id": str(uuid.uuid4()),
            "date": req.payment_date,
            "name": req.customer_name,
            "ref": ref,
            "amount": req.amount_paid,
            "mode": modes_str,
            "tally": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.advances.insert_one(adv)

    await audit_log(db, "create", current_user, "bill", ref, {"customer": req.customer_name, "items": len(items_to_insert), "total": grand_total})
    return {"message": "Bill created", "ref": ref, "items_count": len(items_to_insert), "grand_total": grand_total}

# ==========================================
# TAILORING ORDERS
# ==========================================

