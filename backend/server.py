from fastapi import FastAPI, APIRouter, HTTPException, Query
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime, timezone, date
from bson import ObjectId

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

app = FastAPI()
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ==========================================
# MODELS
# ==========================================

ARTICLE_TYPES = ["Shirt", "Pant", "Gurkha Pant", "Kurta", "Pajama", "Blazer", "Safari Shirt", "Indo", "Sherwani", "Jacket", "W Coat"]

TAILORING_RATES = {
    "Shirt": (500, 400), "Kurta": (500, 400),
    "Pant": (700, 500), "Pajama": (700, 500),
    "Gurkha Pant": (900, 600),
    "Blazer": (3500, 2150),
    "Safari Shirt": (1000, 600),
    "Indo": (4200, 2750), "Sherwani": (4200, 2750),
    "Jacket": (1700, 1100),
    "W Coat": (600, 600),
}

ADDON_ITEMS = ["Bow", "Tie", "Cufflinks", "Stall", "Buttons", "Saffa", "Dye", "Malla", "Kalangi"]

PAYMENT_MODES = ["Cash", "PhonePe", "Google Pay [E]", "Google Pay [S]", "Bank Transfer"]

class BillLineItem(BaseModel):
    barcode: str
    qty: float
    price: float
    discount: float = 0

class CreateBillRequest(BaseModel):
    customer_name: str
    date: str
    payment_date: str
    items: List[BillLineItem]
    payment_modes: List[str] = ["Cash"]
    amount_paid: float = 0
    is_settled: bool = False
    needs_tailoring: bool = False

class TailoringOrderRequest(BaseModel):
    item_ids: List[str]
    order_no: str
    delivery_date: str
    assignments: List[dict]  # [{item_id, article_type, embroidery_status, split_data?}]

class AddOnRequest(BaseModel):
    item_id: str
    addons: List[dict]  # [{name, price}]

class StatusUpdateRequest(BaseModel):
    item_ids: List[str]
    new_status: str
    karigar: Optional[str] = None

class SettlementRequest(BaseModel):
    customer_name: str
    ref: str
    payment_date: str
    payment_modes: List[str]
    fresh_payment: float = 0
    use_advance: bool = False
    allot_fabric: float = 0
    allot_tailoring: float = 0
    allot_embroidery: float = 0
    allot_addon: float = 0
    allot_advance: float = 0

class TallyRequest(BaseModel):
    entry_ids: List[str]
    category: str
    action: str  # "tally" or "untally"

class LabourPaymentRequest(BaseModel):
    item_ids: List[str]
    labour_type: str  # "tailoring" or "embroidery"
    payment_date: str
    payment_modes: List[str]

# ==========================================
# HELPERS
# ==========================================

def make_ref(seq: int, date_str: str) -> str:
    try:
        parts = date_str.split("-")
        if len(parts) == 3:
            d, m, y = parts
            return f"{seq:02d}/{d}{m}{y[2:]}"
    except Exception:
        pass
    return f"{seq:02d}/000000"

def serialize_doc(doc):
    if doc is None:
        return None
    doc["_id"] = str(doc["_id"])
    return doc

def serialize_docs(docs):
    return [serialize_doc(d) for d in docs]

# ==========================================
# SEED DATA
# ==========================================

@api_router.post("/seed")
async def seed_data():
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

@api_router.get("/dashboard")
async def get_dashboard():
    total_items = await db.items.count_documents({})
    total_advances = await db.advances.count_documents({})

    pipeline_fabric_pending = [
        {"$match": {"fabric_pay_mode": "Pending"}},
        {"$group": {"_id": None, "total": {"$sum": "$fabric_pending"}}}
    ]
    fab_pending = await db.items.aggregate(pipeline_fabric_pending).to_list(1)

    pipeline_tail_pending = [
        {"$match": {"tailoring_pay_mode": "Pending"}},
        {"$group": {"_id": None, "total": {"$sum": "$tailoring_pending"}}}
    ]
    tail_pending = await db.items.aggregate(pipeline_tail_pending).to_list(1)

    pipeline_emb_pending = [
        {"$match": {"embroidery_pay_mode": "Pending"}},
        {"$group": {"_id": None, "total": {"$sum": "$embroidery_pending"}}}
    ]
    emb_pending = await db.items.aggregate(pipeline_emb_pending).to_list(1)

    tailoring_pending_count = await db.items.count_documents({"tailoring_status": "Pending"})
    tailoring_stitched_count = await db.items.count_documents({"tailoring_status": "Stitched"})
    emb_required = await db.items.count_documents({"embroidery_status": "Required"})
    emb_inprogress = await db.items.count_documents({"embroidery_status": "In Progress"})

    unique_customers = await db.items.distinct("name")

    pipeline_revenue = [
        {"$group": {"_id": None, "total": {"$sum": "$fabric_received"}}}
    ]
    revenue = await db.items.aggregate(pipeline_revenue).to_list(1)

    pipeline_adv_total = [
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]
    adv_total = await db.advances.aggregate(pipeline_adv_total).to_list(1)

    recent_items = await db.items.find({}, {"_id": 0}).sort("date", -1).limit(10).to_list(10)

    return {
        "total_items": total_items,
        "total_advances": total_advances,
        "fabric_pending_amount": fab_pending[0]["total"] if fab_pending else 0,
        "tailoring_pending_amount": tail_pending[0]["total"] if tail_pending else 0,
        "embroidery_pending_amount": emb_pending[0]["total"] if emb_pending else 0,
        "tailoring_pending_count": tailoring_pending_count,
        "tailoring_stitched_count": tailoring_stitched_count,
        "embroidery_required_count": emb_required,
        "embroidery_inprogress_count": emb_inprogress,
        "unique_customers": len(unique_customers),
        "total_revenue": revenue[0]["total"] if revenue else 0,
        "total_advances_amount": adv_total[0]["total"] if adv_total else 0,
        "recent_items": recent_items,
    }

# ==========================================
# CUSTOMERS
# ==========================================

@api_router.get("/customers")
async def get_customers():
    customers = await db.items.distinct("name")
    return sorted([c for c in customers if c and c != "N/A"])

# ==========================================
# ITEMS CRUD
# ==========================================

@api_router.get("/items")
async def get_items(
    name: Optional[str] = None,
    ref: Optional[str] = None,
    date: Optional[str] = None,
    tailoring_status: Optional[str] = None,
    embroidery_status: Optional[str] = None,
    order_no: Optional[str] = None,
    limit: int = 500,
    skip: int = 0,
):
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

    items = await db.items.find(query, {"_id": 0}).sort("date", -1).skip(skip).limit(limit).to_list(limit)
    total = await db.items.count_documents(query)
    return {"items": items, "total": total}

@api_router.get("/items/{item_id}")
async def get_item(item_id: str):
    item = await db.items.find_one({"id": item_id}, {"_id": 0})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return item

@api_router.get("/refs")
async def get_refs(name: Optional[str] = None):
    query = {}
    if name:
        query["name"] = name
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

@api_router.post("/bills")
async def create_bill(req: CreateBillRequest):
    existing = await db.items.find({"date": req.date}).distinct("ref")
    max_seq = 0
    try:
        parts = req.date.split("-")
        date_suffix = f"{parts[2]}{parts[1]}{parts[0][2:]}"
    except Exception:
        date_suffix = "000000"

    for r in existing:
        try:
            seq = int(r.split("/")[0])
            if seq > max_seq:
                max_seq = seq
        except Exception:
            pass

    ref = f"{max_seq + 1:02d}/{date_suffix}"
    modes_str = ", ".join(req.payment_modes) if req.payment_modes else "Cash"
    tailoring_status = "Awaiting Order" if req.needs_tailoring else "N/A"

    grand_total = 0
    for item in req.items:
        discounted_price = round(item.price - (item.price * item.discount / 100), 0)
        grand_total += round(discounted_price * item.qty, 0)

    items_to_insert = []
    running_paid = 0
    running_discount = 0

    for idx, item in enumerate(req.items):
        discounted_price = round(item.price - (item.price * item.discount / 100), 0)
        item_total = round(discounted_price * item.qty, 0)

        if req.is_settled:
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
                "tailoring_status": tailoring_status,
                "article_type": "N/A",
                "order_no": "N/A",
                "delivery_date": "N/A",
                "tailoring_amount": 0,
                "embroidery_status": "N/A",
                "embroidery_amount": 0,
                "addon_desc": "N/A",
                "addon_amount": 0,
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
                "addon_pay_mode": "N/A",
                "addon_pay_date": "N/A",
                "addon_received": 0,
                "addon_pending": 0,
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
                "tailoring_status": tailoring_status,
                "article_type": "N/A",
                "order_no": "N/A",
                "delivery_date": "N/A",
                "tailoring_amount": 0,
                "embroidery_status": "N/A",
                "embroidery_amount": 0,
                "addon_desc": "N/A",
                "addon_amount": 0,
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
                "addon_pay_mode": "N/A",
                "addon_pay_date": "N/A",
                "addon_received": 0,
                "addon_pending": 0,
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

    return {"message": "Bill created", "ref": ref, "items_count": len(items_to_insert), "grand_total": grand_total}

# ==========================================
# TAILORING ORDERS
# ==========================================

@api_router.get("/tailoring/awaiting")
async def get_awaiting_orders():
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

@api_router.post("/tailoring/assign")
async def assign_tailoring(req: TailoringOrderRequest):
    updated = 0
    for assignment in req.assignments:
        item_id = assignment.get("item_id")
        article_type = assignment.get("article_type", "Shirt")
        emb_status = assignment.get("embroidery_status", "Not Required")

        rates = TAILORING_RATES.get(article_type, (0, 0))
        tail_amt, labour_amt = rates

        update = {
            "$set": {
                "tailoring_status": "Pending",
                "article_type": article_type,
                "order_no": req.order_no,
                "delivery_date": req.delivery_date,
                "tailoring_amount": tail_amt,
                "labour_amount": labour_amt,
                "tailoring_pending": tail_amt,
                "tailoring_pay_mode": "Pending",
                "embroidery_status": emb_status,
            }
        }
        if emb_status == "Required":
            update["$set"]["embroidery_pay_mode"] = "Pending"

        result = await db.items.update_one({"id": item_id}, update)
        if result.modified_count > 0:
            updated += 1

    return {"message": f"{updated} items assigned to order {req.order_no}"}

# ==========================================
# ADDONS
# ==========================================

@api_router.post("/addons")
async def add_addons(req: AddOnRequest):
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

    await db.items.update_one({"id": req.item_id}, {"$set": {
        "addon_desc": new_desc,
        "addon_amount": new_total,
        "addon_pay_mode": "Pending",
        "addon_pending": new_total,
    }})
    return {"message": "Add-ons saved", "addon_desc": new_desc, "addon_amount": new_total}

# ==========================================
# JOB WORK (Status Updates)
# ==========================================

@api_router.get("/jobwork")
async def get_jobwork(
    tab: str = "tailoring",
    order_no: Optional[str] = None,
    date_filter: Optional[str] = None,
    delivery_filter: Optional[str] = None,
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

@api_router.post("/jobwork/move")
async def move_jobwork(req: StatusUpdateRequest):
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

@api_router.get("/jobwork/filters")
async def get_jobwork_filters():
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

@api_router.get("/settlements/balances")
async def get_settlement_balances(name: Optional[str] = None, ref: Optional[str] = None):
    if not ref:
        return {"fabric": 0, "tailoring": 0, "embroidery": 0, "addon": 0, "advance": 0}

    pipeline_fab = [
        {"$match": {"ref": ref, "fabric_pay_mode": "Pending"}},
        {"$group": {"_id": None, "total": {"$sum": "$fabric_pending"}}}
    ]
    pipeline_tail = [
        {"$match": {"ref": ref, "tailoring_pay_mode": "Pending"}},
        {"$group": {"_id": None, "total": {"$sum": "$tailoring_pending"}}}
    ]
    pipeline_emb = [
        {"$match": {"ref": ref, "embroidery_pay_mode": "Pending"}},
        {"$group": {"_id": None, "total": {"$sum": "$embroidery_pending"}}}
    ]
    pipeline_addon = [
        {"$match": {"ref": ref, "addon_pay_mode": "Pending"}},
        {"$group": {"_id": None, "total": {"$sum": "$addon_pending"}}}
    ]
    pipeline_adv = [
        {"$match": {"ref": ref}},
        {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
    ]

    fab = await db.items.aggregate(pipeline_fab).to_list(1)
    tail = await db.items.aggregate(pipeline_tail).to_list(1)
    emb = await db.items.aggregate(pipeline_emb).to_list(1)
    addon = await db.items.aggregate(pipeline_addon).to_list(1)
    adv = await db.advances.aggregate(pipeline_adv).to_list(1)

    return {
        "fabric": fab[0]["total"] if fab else 0,
        "tailoring": tail[0]["total"] if tail else 0,
        "embroidery": emb[0]["total"] if emb else 0,
        "addon": addon[0]["total"] if addon else 0,
        "advance": adv[0]["total"] if adv else 0,
    }

@api_router.post("/settlements/pay")
async def process_settlement(req: SettlementRequest):
    modes_str = ", ".join(req.payment_modes) if req.payment_modes else "Cash"

    async def apply_pro_rata(ref, pay_mode_field, pay_date_field, received_field, pending_field, total_to_pay):
        items = await db.items.find({
            "ref": ref,
            pay_mode_field: "Pending"
        }, {"_id": 0}).to_list(500)

        pending_items = [i for i in items if i.get(pending_field, 0) > 0]
        if not pending_items:
            return

        total_pending = sum(i.get(pending_field, 0) for i in pending_items)
        running_paid = 0

        for idx, item in enumerate(pending_items):
            bal = item.get(pending_field, 0)
            if idx == len(pending_items) - 1:
                share = total_to_pay - running_paid
            else:
                share = round((bal / total_pending) * total_to_pay, 0) if total_pending > 0 else 0
                running_paid += share

            new_balance = bal - share
            update = {
                pay_date_field: req.payment_date,
                received_field: share,
                pending_field: new_balance,
                pay_mode_field: f"Settled - {modes_str}",
            }
            await db.items.update_one({"id": item["id"]}, {"$set": update})

    if req.allot_fabric > 0:
        await apply_pro_rata(req.ref, "fabric_pay_mode", "fabric_pay_date", "fabric_received", "fabric_pending", req.allot_fabric)
    if req.allot_tailoring > 0:
        await apply_pro_rata(req.ref, "tailoring_pay_mode", "tailoring_pay_date", "tailoring_received", "tailoring_pending", req.allot_tailoring)
    if req.allot_embroidery > 0:
        await apply_pro_rata(req.ref, "embroidery_pay_mode", "embroidery_pay_date", "embroidery_received", "embroidery_pending", req.allot_embroidery)
    if req.allot_addon > 0:
        await apply_pro_rata(req.ref, "addon_pay_mode", "addon_pay_date", "addon_received", "addon_pending", req.allot_addon)

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

    if req.use_advance:
        pipeline = [
            {"$match": {"ref": req.ref}},
            {"$group": {"_id": None, "total": {"$sum": "$amount"}}}
        ]
        adv_total_result = await db.advances.aggregate(pipeline).to_list(1)
        adv_available = adv_total_result[0]["total"] if adv_total_result else 0

        if adv_available > 0:
            adjustment = {
                "id": str(uuid.uuid4()),
                "date": req.payment_date,
                "name": req.customer_name,
                "ref": req.ref,
                "amount": -adv_available,
                "mode": "Adjusted",
                "tally": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.advances.insert_one(adjustment)

    return {"message": "Settlement processed successfully"}

# ==========================================
# DAYBOOK
# ==========================================

@api_router.get("/daybook")
async def get_daybook(date_filter: Optional[str] = None):
    result = {"pending": {}, "reconciled": {}}

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
        ("fabric", "fabric_pay_date", "fabric_received", "fabric_pay_mode", "tally_fabric"),
        ("tailoring", "tailoring_pay_date", "tailoring_received", "tailoring_pay_mode", "tally_tailoring"),
        ("embroidery", "embroidery_pay_date", "embroidery_received", "embroidery_pay_mode", "tally_embroidery"),
        ("addon", "addon_pay_date", "addon_received", "addon_pay_mode", "tally_addon"),
    ]

    for item in items:
        for cat_name, date_field, received_field, mode_field, tally_field in categories:
            pay_date = item.get(date_field, "N/A")
            received = item.get(received_field, 0)
            if pay_date == "N/A" or received == 0:
                continue

            if date_filter and date_filter != "All" and pay_date != date_filter:
                continue

            ref = item.get("ref", "")
            is_tallied = item.get(tally_field, False)
            bucket = "reconciled" if is_tallied else "pending"

            if ref not in result[bucket]:
                result[bucket][ref] = {
                    "ref": ref,
                    "name": item.get("name", ""),
                    "fabric": 0, "tailoring": 0, "embroidery": 0, "addon": 0, "advance": 0, "total": 0,
                    "modes": {"fabric": "", "tailoring": "", "embroidery": "", "addon": ""},
                }

            result[bucket][ref][cat_name] += received
            result[bucket][ref]["total"] += received
            mode = item.get(mode_field, "")
            if mode and mode not in result[bucket][ref]["modes"][cat_name]:
                result[bucket][ref]["modes"][cat_name] = mode

    adv_query = {}
    if date_filter and date_filter != "All":
        adv_query["date"] = date_filter

    advances = await db.advances.find(adv_query, {"_id": 0}).to_list(500)
    for adv in advances:
        if adv.get("amount", 0) == 0:
            continue
        ref = adv.get("ref", "")
        is_tallied = adv.get("tally", False)
        bucket = "reconciled" if is_tallied else "pending"

        if ref not in result[bucket]:
            result[bucket][ref] = {
                "ref": ref,
                "name": adv.get("name", ""),
                "fabric": 0, "tailoring": 0, "embroidery": 0, "addon": 0, "advance": 0, "total": 0,
                "modes": {"fabric": "", "tailoring": "", "embroidery": "", "addon": ""},
            }
        result[bucket][ref]["advance"] += adv.get("amount", 0)
        result[bucket][ref]["total"] += adv.get("amount", 0)

    return {
        "pending": list(result["pending"].values()),
        "reconciled": list(result["reconciled"].values()),
    }

@api_router.get("/daybook/dates")
async def get_daybook_dates():
    dates = set()
    for field in ["fabric_pay_date", "tailoring_pay_date", "embroidery_pay_date", "addon_pay_date"]:
        vals = await db.items.distinct(field)
        for v in vals:
            if v and v != "N/A":
                dates.add(v)

    adv_dates = await db.advances.distinct("date")
    for v in adv_dates:
        if v:
            dates.add(v)

    return sorted(list(dates), reverse=True)

@api_router.post("/daybook/tally")
async def tally_entries(req: TallyRequest):
    tally_value = req.action == "tally"

    if req.category == "advance":
        for entry_ref in req.entry_ids:
            await db.advances.update_many({"ref": entry_ref}, {"$set": {"tally": tally_value}})
    else:
        field_map = {
            "fabric": "tally_fabric",
            "tailoring": "tally_tailoring",
            "embroidery": "tally_embroidery",
            "addon": "tally_addon",
            "all": None,
        }

        for entry_ref in req.entry_ids:
            if req.category == "all":
                update = {
                    "tally_fabric": tally_value,
                    "tally_tailoring": tally_value,
                    "tally_embroidery": tally_value,
                    "tally_addon": tally_value,
                }
                await db.items.update_many({"ref": entry_ref}, {"$set": update})
                await db.advances.update_many({"ref": entry_ref}, {"$set": {"tally": tally_value}})
            elif req.category in field_map:
                field = field_map[req.category]
                await db.items.update_many({"ref": entry_ref}, {"$set": {field: tally_value}})

    return {"message": f"{len(req.entry_ids)} entries {req.action}ed"}

# ==========================================
# LABOUR PAYMENTS
# ==========================================

@api_router.get("/labour")
async def get_labour_items(filter_type: str = "All", filter_karigar: str = "All"):
    items = []

    if filter_type in ("All", "Tailoring Labour"):
        query = {
            "tailoring_status": {"$in": ["Stitched", "Delivered"]},
            "labour_paid": {"$in": ["N/A", "", None]},
            "labour_amount": {"$gt": 0},
        }
        tail_items = await db.items.find(query, {"_id": 0}).to_list(500)
        for item in tail_items:
            if filter_karigar == "All":
                items.append({**item, "labour_type": "Tailoring"})

    if filter_type in ("All", "Embroidery Labour"):
        query = {
            "embroidery_status": "Finished",
            "embroidery_amount": {"$gt": 0},
        }
        emb_items = await db.items.find(query, {"_id": 0}).to_list(500)
        for item in emb_items:
            emb_labour_paid = item.get("emb_labour_paid", "N/A")
            if emb_labour_paid in ("N/A", "", None):
                karigar = item.get("karigar", "N/A")
                if filter_karigar == "All" or karigar == filter_karigar:
                    items.append({**item, "labour_type": "Embroidery"})

    return items

@api_router.get("/labour/karigars")
async def get_karigars():
    karigars = await db.items.distinct("karigar", {"karigar": {"$nin": ["N/A", "", None]}})
    return sorted(karigars)

@api_router.post("/labour/pay")
async def pay_labour(req: LabourPaymentRequest):
    updated = 0
    for item_id in req.item_ids:
        if req.labour_type == "tailoring":
            update = {
                "labour_paid": "Yes",
                "labour_pay_date": req.payment_date,
            }
        else:
            update = {
                "emb_labour_paid": "Yes",
                "emb_labour_date": req.payment_date,
            }
        result = await db.items.update_one({"id": item_id}, {"$set": update})
        if result.modified_count > 0:
            updated += 1

    return {"message": f"{updated} labour payments processed"}

# ==========================================
# ADVANCES
# ==========================================

@api_router.get("/advances")
async def get_advances(name: Optional[str] = None, ref: Optional[str] = None):
    query = {}
    if name:
        query["name"] = name
    if ref:
        query["ref"] = ref
    advances = await db.advances.find(query, {"_id": 0}).sort("date", -1).to_list(500)
    return advances

# ==========================================
# ORDER NUMBERS
# ==========================================

@api_router.get("/orders")
async def get_order_numbers():
    orders = await db.items.distinct("order_no", {"order_no": {"$nin": ["N/A", "", None]}})
    return sorted([o for o in orders if o])

# ==========================================
# HEALTH
# ==========================================

@api_router.get("/")
async def root():
    return {"message": "Retail Management API", "status": "running"}

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
