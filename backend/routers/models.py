"""
Shared Pydantic models, constants, and pure helper functions.
No DB access here — no side effects on import.
"""
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime


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
    article_type: Optional[str] = None
    order_no: Optional[str] = None
    delivery_date: Optional[str] = None
    embroidery_status: Optional[str] = None
    addons: Optional[List[dict]] = None

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
    date: Optional[str] = None  # scope tally to a specific pay-date row

class LabourPaymentRequest(BaseModel):
    item_ids: List[str]
    labour_type: str  # "tailoring" or "embroidery"
    payment_date: str
    payment_modes: List[str]
    payment_id: Optional[str] = None

class ItemUpdateRequest(BaseModel):
    barcode: Optional[str] = None
    price: Optional[float] = None
    qty: Optional[float] = None
    discount: Optional[float] = None
    fabric_amount: Optional[float] = None
    ref: Optional[str] = None
    name: Optional[str] = None
    date: Optional[str] = None
    tailoring_status: Optional[str] = None
    article_type: Optional[str] = None
    order_no: Optional[str] = None
    delivery_date: Optional[str] = None
    tailoring_amount: Optional[float] = None
    embroidery_status: Optional[str] = None
    embroidery_amount: Optional[float] = None
    addon_desc: Optional[str] = None
    addon_amount: Optional[float] = None
    addon_received: Optional[float] = None
    addon_pending: Optional[float] = None
    addon_pay_mode: Optional[str] = None
    addon_pay_date: Optional[str] = None
    fabric_pay_mode: Optional[str] = None
    fabric_pay_date: Optional[str] = None
    fabric_pending: Optional[float] = None
    fabric_received: Optional[float] = None
    tailoring_pay_mode: Optional[str] = None
    tailoring_pay_date: Optional[str] = None
    tailoring_pending: Optional[float] = None
    tailoring_received: Optional[float] = None
    embroidery_pay_mode: Optional[str] = None
    embroidery_pay_date: Optional[str] = None
    embroidery_pending: Optional[float] = None
    embroidery_received: Optional[float] = None
    karigar: Optional[str] = None
    labour_amount: Optional[float] = None
    labour_paid: Optional[str] = None
    labour_pay_date: Optional[str] = None
    labour_payment_mode: Optional[str] = None
    emb_labour_amount: Optional[float] = None
    emb_labour_paid: Optional[str] = None
    emb_labour_date: Optional[str] = None
    emb_labour_payment_mode: Optional[str] = None
    tally_fabric: Optional[bool] = None
    tally_tailoring: Optional[bool] = None
    tally_embroidery: Optional[bool] = None
    tally_addon: Optional[bool] = None
    cancelled: Optional[bool] = None
    cancelled_at: Optional[str] = None
    cancelled_ref: Optional[str] = None


class ItemCreateRequest(BaseModel):
    ref: str
    name: str
    date: str
    barcode: Optional[str] = None
    price: Optional[float] = None
    qty: Optional[float] = None
    discount: Optional[float] = None
    fabric_amount: Optional[float] = None
    fabric_received: Optional[float] = None
    fabric_pending: Optional[float] = None
    fabric_pay_date: Optional[str] = None
    fabric_pay_mode: Optional[str] = None
    tailoring_status: Optional[str] = None
    article_type: Optional[str] = None
    order_no: Optional[str] = None
    delivery_date: Optional[str] = None
    tailoring_amount: Optional[float] = None
    tailoring_received: Optional[float] = None
    tailoring_pending: Optional[float] = None
    tailoring_pay_date: Optional[str] = None
    tailoring_pay_mode: Optional[str] = None
    embroidery_status: Optional[str] = None
    karigar: Optional[str] = None
    embroidery_amount: Optional[float] = None
    embroidery_received: Optional[float] = None
    embroidery_pending: Optional[float] = None
    embroidery_pay_date: Optional[str] = None
    embroidery_pay_mode: Optional[str] = None
    addon_desc: Optional[str] = None
    addon_amount: Optional[float] = None
    addon_received: Optional[float] = None
    addon_pending: Optional[float] = None
    addon_pay_date: Optional[str] = None
    addon_pay_mode: Optional[str] = None
    labour_amount: Optional[float] = None
    labour_paid: Optional[str] = None
    labour_pay_date: Optional[str] = None
    labour_payment_mode: Optional[str] = None
    emb_labour_amount: Optional[float] = None
    emb_labour_paid: Optional[str] = None
    emb_labour_date: Optional[str] = None
    emb_labour_payment_mode: Optional[str] = None
    tally_fabric: Optional[bool] = None
    tally_tailoring: Optional[bool] = None
    tally_embroidery: Optional[bool] = None
    tally_addon: Optional[bool] = None

    # Ensure all frontend editable fields are covered
    # Items section: date, name, ref, barcode, price, qty, discount, fabric_received, fabric_pay_date, fabric_pay_mode, tally_fabric
    # Tailoring section: order_no, article_type, delivery_date, tailoring_status, tailoring_amount, tailoring_received, tailoring_pay_date, tailoring_pay_mode, labour_amount, labour_paid, labour_pay_date, labour_payment_mode, tally_tailoring
    # Embroidery section: embroidery_status, karigar, embroidery_amount, embroidery_received, embroidery_pay_date, embroidery_pay_mode, emb_labour_amount, emb_labour_paid, emb_labour_date, emb_labour_payment_mode, tally_embroidery
    # Addon section: addon_desc, addon_amount, addon_received, addon_pay_date, addon_pay_mode, tally_addon

# ==========================================
# HELPERS
# ==========================================

def validate_date(date_str: str, field_name: str = "date") -> str:
    """Validate date format and return the date string. Raises ValueError on invalid input."""
    if not date_str or not isinstance(date_str, str):
        raise ValueError(f"{field_name} is required")
    try:
        datetime.strptime(date_str, "%Y-%m-%d")
        return date_str
    except ValueError:
        raise ValueError(f"Invalid {field_name} format: {date_str}. Expected YYYY-MM-DD")

def serialize_doc(doc):
    if doc is None:
        return None
    doc["_id"] = str(doc["_id"])
    return doc


# ==========================================
# DEFAULT SETTINGS & MERGE HELPER
# ==========================================

DEFAULT_SETTINGS = {
    "article_types": ARTICLE_TYPES,
    "tailoring_rates": {k: {"tailoring": v[0], "labour": v[1]} for k, v in TAILORING_RATES.items()},
    "payment_modes": PAYMENT_MODES,
    "addon_items": ADDON_ITEMS,
    "gst_rate": 5.0,
    "firm_name": "Narwana Agencies",
    "firm_address": "Jasmeet Nagar, Near Kalka Chowk, Ambala City, Pin: 134003, Haryana",
    "firm_phones": "9467902343, 7056212655",
    "firm_gstin": "06ADMPG9353K1Z4",
    "firm_logo": None,
    "firm_name_color": "#C86B4D",
    "firm_name_size": "16",
    "firm_name_case": "uppercase",
}

def merge_settings(stored_settings: Optional[dict] = None) -> dict:
    merged = dict(DEFAULT_SETTINGS)
    if stored_settings:
        merged.update({k: v for k, v in stored_settings.items() if k != "key"})
    for list_key in ("payment_modes", "addon_items", "article_types"):
        if isinstance(merged.get(list_key), list):
            seen: set = set()
            merged[list_key] = [x for x in merged[list_key] if not (x.lower() in seen or seen.add(x.lower()))]
    return merged


# ==========================================
# ADDITIONAL MODELS (extracted from server.py)
# ==========================================

# --- LoginRequest ---
class LoginRequest(BaseModel):
    username: str
    password: str


# --- UserCreateRequest ---
class UserCreateRequest(BaseModel):
    username: str
    password: str
    full_name: str
    role: str = "cashier"
    allowed_pages: List[str] = []

# --- Rate limiting ---

# --- SplitItem ---
class SplitItem(BaseModel):
    article_type: str
    qty: float
    embroidery_status: str = "Not Required"


# --- SplitTailoringRequest ---
class SplitTailoringRequest(BaseModel):
    item_id: str
    order_no: str
    delivery_date: str
    splits: List[SplitItem]


# --- MoveBackRequest ---
class MoveBackRequest(BaseModel):
    item_ids: List[str]
    current_status: str


# --- EmbMoveRequest ---
class EmbMoveRequest(BaseModel):
    item_ids: List[str]
    new_status: str
    emb_labour_amount: Optional[float] = None
    emb_customer_amount: Optional[float] = None


# --- EmbEditRequest ---
class EmbEditRequest(BaseModel):
    item_id: str
    karigar: Optional[str] = None
    emb_labour_amount: Optional[float] = None
    emb_customer_amount: Optional[float] = None


# --- LabourDeleteRequest ---
class LabourDeleteRequest(BaseModel):
    payment_id: Optional[str] = None
    item_ids: List[str]
    labour_type: str


# --- AdvanceCreateRequest ---
class AdvanceCreateRequest(BaseModel):
    ref: str
    name: str
    amount: float
    date: str
    mode: Optional[str] = "Cash"


# --- AdvanceUpdateRequest ---
class AdvanceUpdateRequest(BaseModel):
    ref: Optional[str] = None
    name: Optional[str] = None
    amount: Optional[float] = None
    date: Optional[str] = None
    mode: Optional[str] = None
    tally: Optional[bool] = None

