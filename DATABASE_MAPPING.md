# Retail Book - Database Interaction Mapping

## Overview
This document maps how each page interacts with the MongoDB database, showing which fields are affected by which UI actions.

---

## 1. DATABASE COLLECTIONS

### 1.1 `items` Collection (Primary)
Stores all bill items with their complete lifecycle data.

| Field | Type | Description | Set By | Modified By |
|-------|------|-------------|--------|-------------|
| `id` | UUID | Unique identifier | New Bill | - |
| `date` | String (YYYY-MM-DD) | Bill creation date | New Bill | - |
| `name` | String | Customer name | New Bill | - |
| `ref` | String | Reference (XX/DDMMYY format) | New Bill | - |
| `barcode` | String | Product barcode | New Bill | - |
| `price` | Float | Unit price | New Bill | Edit Item |
| `qty` | Float | Quantity | New Bill | Tailoring Split |
| `discount` | Float | Discount % | New Bill | - |
| `fabric_amount` | Float | Calculated: price * qty * (1 - discount%) | New Bill | Edit Item |

### 1.2 TAILORING Fields (Order Lifecycle)

| Field | Type | Set By | Modified By | Values |
|-------|------|--------|-------------|--------|
| `tailoring_status` | String | New Bill | Tailoring Orders, Job Work | "Awaiting Order", "Pending", "Stitched", "Delivered", "N/A" |
| `article_type` | String | Tailoring Orders | - | "Shirt", "Pant", "Blazer", etc. |
| `order_no` | String | New Bill, Tailoring Orders | - | Order number |
| `delivery_date` | String | New Bill, Tailoring Orders | - | YYYY-MM-DD |
| `tailoring_amount` | Float | Tailoring Orders | - | From TAILORING_RATES |
| `tailoring_pending` | Float | Tailoring Orders | Settlements | Calculated |
| `tailoring_received` | Float | Settlements | Settlements | Accumulated |
| `tailoring_pay_mode` | String | Settlements | Settlements | "Pending", "Partially Settled - {modes}", "Settled - {modes}" |
| `tailoring_pay_date` | String | Settlements | Settlements | YYYY-MM-DD or "N/A" |

### 1.3 EMBROIDERY Fields

| Field | Type | Set By | Modified By | Values |
|-------|------|--------|-------------|--------|
| `embroidery_status` | String | New Bill, Tailoring Orders | Job Work | "Not Required", "Required", "In Progress", "Finished", "N/A" |
| `embroidery_amount` | Float | Job Work (move-emb) | Edit Embroidery | Customer charge |
| `embroidery_pending` | Float | Job Work | Settlements | Calculated |
| `embroidery_received` | Float | Settlements | Settlements | Accumulated |
| `embroidery_pay_mode` | String | Settlements | Settlements | Payment mode |
| `embroidery_pay_date` | String | Settlements | Settlements | YYYY-MM-DD |
| `emb_labour_amount` | Float | Job Work | Edit Embroidery, Labour Payments | Karigar payment amount |
| `emb_labour_paid` | String | Labour Payments | Labour Payments | "Yes", "N/A" |
| `emb_labour_date` | String | Labour Payments | Labour Payments | Payment date |
| `emb_labour_payment_mode` | String | Labour Payments | Labour Payments | Cash, PhonePe, etc. |
| `emb_labour_payment_id` | String | Labour Payments | Delete Payment | UUID for batching |
| `karigar` | String | Job Work | Edit Embroidery | Karigar name |

### 1.4 LABOUR PAYMENT Fields (Tailoring)

| Field | Type | Set By | Modified By |
|-------|------|--------|-------------|
| `labour_amount` | Float | Tailoring Orders | - | From TAILORING_RATES |
| `labour_paid` | String | Labour Payments | Delete Payment | "Yes", "N/A" |
| `labour_pay_date` | String | Labour Payments | Delete Payment | YYYY-MM-DD |
| `labour_payment_mode` | String | Labour Payments | Delete Payment | Cash, PhonePe, etc. |
| `labour_payment_id` | String | Labour Payments | Delete Payment | UUID for batching |

### 1.5 ADD-ON Fields

| Field | Type | Set By | Modified By |
|-------|------|--------|-------------|
| `addon_desc` | String | Add-ons | Add-ons | "Bow(100), Tie(50)" format |
| `addon_amount` | Float | Add-ons | Add-ons | Total add-on amount |
| `addon_pending` | Float | Add-ons | Settlements | Calculated |
| `addon_received` | Float | Settlements | Settlements | Accumulated |
| `addon_pay_mode` | String | Settlements | Settlements | Payment mode |
| `addon_pay_date` | String | Settlements | Settlements | YYYY-MM-DD |

### 1.6 FABRIC PAYMENT Fields

| Field | Type | Set By | Modified By |
|-------|------|--------|-------------|
| `fabric_pay_mode` | String | New Bill | Settlements | "Pending", "Partially Settled", "Settled" |
| `fabric_pay_date` | String | New Bill | Settlements | YYYY-MM-DD |
| `fabric_pending` | Float | New Bill | Settlements | Remaining balance |
| `fabric_received` | Float | New Bill | Settlements | Amount received |

### 1.7 TALLY Fields (Daybook)

| Field | Type | Set By | Modified By |
|-------|------|--------|-------------|
| `tally_fabric` | Boolean | - | Daybook | True when tallied |
| `tally_tailoring` | Boolean | - | Daybook | True when tallied |
| `tally_embroidery` | Boolean | - | Daybook | True when tallied |
| `tally_addon` | Boolean | - | Daybook | True when tallied |

### 1.8 `advances` Collection

| Field | Type | Description | Set By |
|-------|------|-------------|--------|
| `id` | UUID | Unique ID | System |
| `date` | String | Payment date | New Bill (advance), Settlements |
| `name` | String | Customer name | New Bill, Settlements |
| `ref` | String | Reference | New Bill, Settlements |
| `amount` | Float | Amount (positive for advance, negative for adjustment) | New Bill, Settlements |
| `mode` | String | Payment modes | New Bill, Settlements |
| `tally` | Boolean | Daybook tally status | Daybook |
| `created_at` | ISO Date | Timestamp | System |

---

## 2. PAGE-WISE DATABASE INTERACTIONS

### 2.1 NEW BILL (`/bills`)
**Endpoint:** `POST /api/bills`

| UI Action | Fields Affected | Logic |
|-----------|----------------|-------|
| Create Bill | All item fields | Inserts new items into `items` collection |
| Settled Bill | `fabric_pay_mode`, `fabric_pay_date`, `fabric_pending`, `fabric_received` | Sets as settled with payment distribution |
| Unsettled Bill with Advance | Creates advance record | Inserts into `advances` collection |
| Inline Tailoring | `tailoring_status`, `article_type`, `order_no`, `delivery_date`, `tailoring_amount`, `labour_amount`, `tailoring_pending` | Sets "Pending" status with calculated amounts |
| Inline Embroidery | `embroidery_status` | Sets "Required" or "Not Required" |
| Inline Add-ons | `addon_desc`, `addon_amount`, `addon_pending` | Formats and stores add-ons |

**Reference Generation:** `{sequence:02d}/{DD}{MM}{YY}` - Auto-incremented per date

---

### 2.2 TAILORING ORDERS (`/tailoring`)
**Endpoints:**
- `GET /api/tailoring/awaiting` - Items with status "Awaiting Order"
- `POST /api/tailoring/assign` - Assign to order
- `POST /api/tailoring/split` - Split items

| UI Action | Fields Affected | Logic |
|-----------|----------------|-------|
| Assign to Order | `tailoring_status` → "Pending", `article_type`, `order_no`, `delivery_date`, `tailoring_amount`, `labour_amount`, `tailoring_pending`, `tailoring_pay_mode` | Calculates from TAILORING_RATES |
| Split Item | Creates new items | First split updates original, subsequent splits create new items with new UUIDs |
| Assign Embroidery | `embroidery_status`, `embroidery_pay_mode` | Sets "Required" and pay mode "Pending" |

**TAILORING_RATES Mapping:**
```
Shirt/Kurta: (500, 400) - (customer_charge, labour_cost)
Pant/Pajama: (700, 500)
Gurkha Pant: (900, 600)
Blazer: (3500, 2150)
Safari Shirt: (1000, 600)
Indo/Sherwani: (4200, 2750)
Jacket: (1700, 1100)
W Coat: (600, 600)
```

---

### 2.3 ADD-ONS (`/addons`)
**Endpoint:** `POST /api/addons`

| UI Action | Fields Affected | Logic |
|-----------|----------------|-------|
| Add Add-ons | `addon_desc` (appends), `addon_amount` (adds), `addon_pending`, `addon_pay_mode` | Formats: "Name(Price), Name(Price)" |

---

### 2.4 JOB WORK (`/jobwork`)
**Endpoints:**
- `GET /api/jobwork?tab=tailoring|embroidery`
- `POST /api/jobwork/move`
- `POST /api/jobwork/move-back`
- `POST /api/jobwork/move-emb`
- `POST /api/jobwork/edit-emb`

#### TAILORING Workflow:
| UI Action | Fields Affected | Status Flow |
|-----------|----------------|-------------|
| Move to Pending | `tailoring_status` = "Pending" | Awaiting Order → Pending |
| Move to Stitched | `tailoring_status` = "Stitched" | Pending → Stitched |
| Move to Delivered | `tailoring_status` = "Delivered" | Stitched → Delivered |
| Move Back | `tailoring_status` | Stitched → Pending, Delivered → Stitched |

#### EMBROIDERY Workflow:
| UI Action | Fields Affected | Status Flow |
|-----------|----------------|-------------|
| Move to In Progress | `embroidery_status` = "In Progress", `karigar` | Required → In Progress |
| Move to Finished | `embroidery_status` = "Finished", `emb_labour_amount`, `embroidery_amount`, `embroidery_pending` | In Progress → Finished |
| Move Back | `embroidery_status`, clears amounts/karigar | In Progress → Required, Finished → In Progress |
| Edit Embroidery | `karigar`, `emb_labour_amount`, `embroidery_amount`, `embroidery_pending` | Updates amounts |

---

### 2.5 SETTLEMENTS (`/settlements`)
**Endpoints:**
- `GET /api/settlements/balances?name=&ref=`
- `POST /api/settlements/pay`

| UI Action | Fields Affected | Logic |
|-----------|----------------|-------|
| View Balances | Reads all category pending/received | Calculates fabric, tailoring, embroidery, addon, advance balances |
| Process Settlement | Updates all payment fields pro-rata | Distributes payment across items in a ref |
| Fabric Payment | `fabric_pay_date`, `fabric_received`, `fabric_pending`, `fabric_pay_mode` | Pro-rata distribution |
| Tailoring Payment | `tailoring_pay_date`, `tailoring_received`, `tailoring_pending`, `tailoring_pay_mode` | Pro-rata distribution |
| Embroidery Payment | `embroidery_pay_date`, `embroidery_received`, `embroidery_pending`, `embroidery_pay_mode` | Pro-rata distribution |
| Add-on Payment | `addon_pay_date`, `addon_received`, `addon_pending`, `addon_pay_mode` | Pro-rata distribution |
| Use Advance | Creates negative advance record | Inserts adjustment into `advances` |
| Create Advance | Creates advance record | Inserts into `advances` |

---

### 2.6 DAYBOOK (`/daybook`)
**Endpoints:**
- `GET /api/daybook?date_filter=`
- `GET /api/daybook/dates`
- `POST /api/daybook/tally`

| UI Action | Fields Affected | Logic |
|-----------|----------------|-------|
| View Entries | Aggregates by `ref` | Groups items by reference, sums per category |
| Tally Category | `tally_fabric`, `tally_tailoring`, `tally_embroidery`, `tally_addon` | Sets to True/False |
| Tally Advance | `tally` in advances collection | Sets to True/False |
| Tally All | All tally fields | Sets all categories + advances |

**Aggregation Logic:**
- Groups items by `ref`
- Sums: `fabric_received`, `tailoring_received`, `embroidery_received`, `addon_received`
- Tracks: `fabric_pay_date`, `fabric_pay_mode` per category
- Includes advances from `advances` collection

---

### 2.7 LABOUR PAYMENTS (`/labour`)
**Endpoints:**
- `GET /api/labour?view_mode=unpaid|paid`
- `GET /api/labour/karigars`
- `POST /api/labour/pay`
- `POST /api/labour/delete-payment`

#### UNPAID View (Pending Labour):
| Query | Logic |
|-------|-------|
| Tailoring | `tailoring_status` in ["Stitched", "Delivered"], `labour_paid` in ["N/A", "", null], `labour_amount` > 0 |
| Embroidery | `embroidery_status` = "Finished", `emb_labour_amount` > 0, `emb_labour_paid` in ["N/A", "", null] |

#### PAID View:
| Query | Logic |
|-------|-------|
| Tailoring | `labour_paid` = "Yes", groups by `labour_payment_id` |
| Embroidery | `emb_labour_paid` = "Yes", groups by `emb_labour_payment_id` |

| UI Action | Fields Affected | Logic |
|-----------|----------------|-------|
| Pay Labour | For Tailoring: `labour_paid` = "Yes", `labour_pay_date`, `labour_payment_mode`, `labour_payment_id` | Single payment_id for batch |
| Pay Labour | For Embroidery: `emb_labour_paid` = "Yes", `emb_labour_date`, `emb_labour_payment_mode`, `emb_labour_payment_id` | Same payment_id if paid together |
| Delete Payment | Resets all labour fields to "N/A" or 0/null | Undo payment |
| Edit Payment | Removes items from payment | Updates only deselected items |

---

### 2.8 MANAGE ORDERS (`/items`)
**Endpoints:**
- `GET /api/items?name=&ref=&order_no=`
- `PUT /api/items/{id}`
- `DELETE /api/items/{id}`

| UI Action | Fields Affected | Logic |
|-----------|----------------|-------|
| View Items | All fields | Groups by `ref`, shows totals per category |
| Edit Item | `barcode`, `price`, `qty`, `discount`, `fabric_amount` (auto-recalculated) | Updates single item |
| Delete Item | Removes entire document | Cascade delete - affects all related data |

---

### 2.9 ORDER STATUS (`/order-status`)
**Endpoint:** `GET /api/orders/status`

| UI Action | Database Operation | Logic |
|-----------|-------------------|-------|
| View Status | Aggregation pipeline | Groups by `order_no`, counts items per status |

**Aggregation Fields:**
- `item_count`: Count of items in order
- `tailoring_pending/stitched/delivered`: Count per status
- `emb_required/in_progress/finished`: Count per embroidery status
- `order_total`: Sum of fabric + tailoring + embroidery + addon amounts
- `latest_bill_date`, `latest_delivery_date`: Max dates

---

### 2.10 SEARCH (`/search`)
**Endpoint:** `GET /api/search?q=&params`

| UI Action | Database Operation |
|-----------|-------------------|
| Search | Queries across: `name`, `barcode`, `ref`, `article_type`, `order_no`, `karigar`, `addon_desc` |
| Filter by Date | Uses `date` field range |
| Filter by Status | Uses `tailoring_status` or `embroidery_status` |
| Filter by Payment | Uses `fabric_pending` and `fabric_received` |

---

## 3. FIELD DEPENDENCIES & WORKFLOWS

### 3.1 Bill Creation Flow
```
New Bill
  ↓
Creates items with:
  - Basic fields (date, name, ref, barcode, price, qty, discount)
  - fabric_amount = calculated
  - If settled: fabric_pay_mode, fabric_pay_date, fabric_pending, fabric_received
  - If inline tailoring: tailoring_status, article_type, order_no, delivery_date, tailoring_amount, labour_amount, tailoring_pending
  - If inline embroidery: embroidery_status
  - If add-ons: addon_desc, addon_amount, addon_pending
  - If advance: Creates record in advances collection
```

### 3.2 Tailoring Order Flow
```
Awaiting Order (New Bill with needs_tailoring=true)
  ↓
Tailoring Orders → Assign
  ↓
Pending (tailoring_status, article_type, order_no, delivery_date, tailoring_amount, labour_amount set)
  ↓
Job Work → Move to Stitched
  ↓
Stitched
  ↓
Job Work → Move to Delivered
  ↓
Delivered (Now eligible for labour payment)
```

### 3.3 Embroidery Flow
```
Required (Tailoring Orders or New Bill)
  ↓
Job Work → Move to In Progress
  ↓
In Progress (karigar assigned)
  ↓
Job Work → Move to Finished (with amounts)
  ↓
Finished (emb_labour_amount, embroidery_amount, embroidery_pending set)
  ↓
Labour Payments → Pay
  ↓
emb_labour_paid = "Yes", emb_labour_date, emb_labour_payment_mode, emb_labour_payment_id set
```

### 3.4 Payment Settlement Flow
```
Pending fabric/tailoring/embroidery/addon
  ↓
Settlements → Process Payment
  ↓
Updates:
  - {category}_pay_date = payment date
  - {category}_received += allocated amount
  - {category}_pending -= allocated amount
  - {category}_pay_mode = "Settled - {modes}" or "Partially Settled - {modes}"
  - If using advance: Creates negative advance record
  - If creating new advance: Creates positive advance record
```

### 3.5 Labour Payment Flow
```
Stitched/Delivered (Tailoring) OR Finished (Embroidery)
  ↓
Labour Payments (Unpaid view)
  ↓
Select items + Pay
  ↓
Generates payment_id (shared for batch)
  ↓
For Tailoring:
  - labour_paid = "Yes"
  - labour_pay_date = date
  - labour_payment_mode = mode
  - labour_payment_id = payment_id
  ↓
For Embroidery:
  - emb_labour_paid = "Yes"
  - emb_labour_date = date
  - emb_labour_payment_mode = mode
  - emb_labour_payment_id = payment_id
```

### 3.6 Daybook Tally Flow
```
Paid entries exist
  ↓
Daybook → Tally
  ↓
If fabric category: tally_fabric = True
If tailoring category: tally_tailoring = True
If embroidery category: tally_embroidery = True
If addon category: tally_addon = True
If advance: advances.tally = True
If all: All above fields set
```

---

## 4. CRITICAL FIELD RELATIONSHIPS

### 4.1 Amount Calculations
| Field | Formula |
|-------|---------|
| `fabric_amount` | `price * qty * (1 - discount/100)` |
| `fabric_pending` | `fabric_amount - fabric_received` |
| `tailoring_pending` | `tailoring_amount - tailoring_received` |
| `embroidery_pending` | `embroidery_amount - embroidery_received` |
| `addon_pending` | `addon_amount - addon_received` |
| `labour_amount` | From TAILORING_RATES[article_type][1] (index 1 = labour cost) |
| `tailoring_amount` | From TAILORING_RATES[article_type][0] (index 0 = customer charge) |

### 4.2 Status Dependencies
| Status | Prerequisites |
|--------|----------------|
| Can pay labour (Tailoring) | `tailoring_status` in ["Stitched", "Delivered"], `labour_paid` = "N/A" |
| Can pay labour (Embroidery) | `embroidery_status` = "Finished", `emb_labour_paid` = "N/A" |
| Eligible for settlement | `fabric_pending` > 0 OR `tailoring_pending` > 0, etc. |
| Eligible for daybook | `fabric_received` > 0 OR `tailoring_received` > 0, etc. |

### 4.3 Reference (ref) Structure
- Format: `{sequence:02d}/{DD}{MM}{YY}`
- Example: "01/210426" (First bill on 21-04-2026)
- All items in same bill share the same `ref`
- Used for grouping in: Settlements, Daybook, Manage Orders

---

## 5. DATA LIFECYCLE SUMMARY

| Stage | Collections | Key Fields |
|-------|-------------|------------|
| **Bill Creation** | `items` (+ `advances` if advance) | Basic info, fabric amounts, inline tailoring/embroidery/addons |
| **Tailoring** | `items` | article_type, order_no, delivery_date, tailoring_amount, labour_amount |
| **Embroidery** | `items` | karigar, emb_labour_amount, embroidery_amount |
| **Add-ons** | `items` | addon_desc, addon_amount |
| **Job Work** | `items` | tailoring_status, embroidery_status |
| **Settlement** | `items` (+ `advances` if used/created) | All *_pay_date, *_received, *_pending, *_pay_mode |
| **Labour Payment** | `items` | labour_paid/emb_labour_paid, *_date, *_mode, *_payment_id |
| **Daybook** | `items`, `advances` | tally_* fields |

---

## 6. API ENDPOINT SUMMARY

| Endpoint | Method | Pages Using | Description |
|----------|--------|-------------|-------------|
| `/api/bills` | POST | New Bill | Create bill items |
| `/api/items` | GET | Manage Orders, Search | List items |
| `/api/items/{id}` | PUT | Manage Orders | Update item |
| `/api/items/{id}` | DELETE | Manage Orders | Delete item |
| `/api/tailoring/awaiting` | GET | Tailoring Orders | List awaiting items |
| `/api/tailoring/assign` | POST | Tailoring Orders | Assign to order |
| `/api/tailoring/split` | POST | Tailoring Orders | Split items |
| `/api/addons` | POST | Add-ons | Add add-ons |
| `/api/jobwork` | GET | Job Work | List job work items |
| `/api/jobwork/move` | POST | Job Work | Move status forward |
| `/api/jobwork/move-back` | POST | Job Work | Move status backward |
| `/api/jobwork/move-emb` | POST | Job Work | Move embroidery with amounts |
| `/api/jobwork/edit-emb` | POST | Job Work | Edit embroidery details |
| `/api/settlements/balances` | GET | Settlements | Get balances |
| `/api/settlements/pay` | POST | Settlements | Process payment |
| `/api/daybook` | GET | Daybook | List entries |
| `/api/daybook/dates` | GET | Daybook | Get available dates |
| `/api/daybook/tally` | POST | Daybook | Tally entries |
| `/api/labour` | GET | Labour Payments | List labour items |
| `/api/labour/karigars` | GET | Labour Payments | List karigars |
| `/api/labour/pay` | POST | Labour Payments | Pay labour |
| `/api/labour/delete-payment` | POST | Labour Payments | Delete/undo payment |
| `/api/orders/status` | GET | Order Status | Order status aggregation |
| `/api/search` | GET | Search | Search items |
| `/api/advances` | GET | (various) | List advances |
| `/api/customers` | GET | (various) | List customers |

---

*Document Version: 1.0*
*Generated for Retail Book Database Schema*
