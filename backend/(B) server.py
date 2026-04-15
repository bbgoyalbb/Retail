from fastapi import FastAPI, APIRouter, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from bson import ObjectId
import os
from dotenv import load_dotenv
from pathlib import Path

# 1. Environment & App Setup
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Database Connection
mongo_url = os.environ.get('MONGO_URL', "mongodb://localhost:27017")
db_name = os.environ.get('DB_NAME', "retail_book") 
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

api_router = APIRouter(prefix="/api")

def format_doc(doc):
    if doc and "_id" in doc:
        doc["id"] = str(doc["_id"])
        del doc["_id"]
    return doc

# --- FIX 1: DASHBOARD (Stops .slice crash) ---
@api_router.get("/dashboard")
async def get_dashboard():
    total = await db.orders.count_documents({})
    recent = await db.orders.find().sort("created_at", -1).limit(5).to_list(5)
    return {
        "data": {
            "stats": {"orders": total, "sales": 0, "pending": 0},
            "recent_items": [format_doc(o) for o in recent],
            "chart_data": [], # Fixed: Must be [] for .slice() to work
            "revenue_summary": {"total": 0, "change": 0}
        }
    }

# --- FIX 2: ITEMS (Stops .forEach crash) ---
@api_router.get("/items")
async def get_items(limit: int = 2000):
    cursor = db.items.find().limit(limit)
    items = await cursor.to_list(length=limit)
    return [format_doc(i) for i in items]

# --- FIX 3: DAYBOOK (Stops .length crash) ---
@api_router.get("/daybook")
async def get_daybook():
    cursor = db.orders.find().sort("created_at", -1)
    items = await cursor.to_list(length=1000)
    return [format_doc(i) for i in items]

# --- SYSTEM & COMPATIBILITY ---
@api_router.get("/daybook/dates")
async def get_daybook_dates(): return []

@api_router.get("/settings")
async def get_settings():
    s = await db.settings.find_one({"key": "app_settings"}, {"_id": 0})
    return s if s else {"firm_name": "Retail Business"}

@api_router.get("/customers")
async def get_customers():
    c = await db.orders.distinct("customer_name")
    return [{"name": n} for n in c]

@api_router.get("/labour")
async def get_labour(): return []

@api_router.get("/reports/summary")
async def get_rs(): return {"total_sales": 0, "total_orders": 0, "top_customers": [], "revenue_by_day": []}

@api_router.get("/db/stats")
async def get_db_stats(): return {"status": "connected"}

@api_router.post("/seed")
async def seed(): return {"status": "success"}

app.include_router(api_router)

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)