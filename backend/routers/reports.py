"""
Reports router.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from fastapi.responses import HTMLResponse, StreamingResponse
from typing import Optional, List, Dict, Any
from datetime import datetime, timezone, date
import uuid
import re
from bson import ObjectId
from .deps import db, get_current_user_dep
from data_quality import round_money, determine_payment_status, build_payment_mode_label
import auth as auth_module
from auth import audit_log
from .models import ARTICLE_TYPES, TAILORING_RATES
import io

router = APIRouter()

@router.get("/invoice")
async def generate_invoice(ref_id: str = Query(..., alias="ref"), format: str = Query(default="standard", alias="format"), current_user: dict = Depends(get_current_user_dep)):
    from fastapi.responses import HTMLResponse

    items = await db.items.find({"ref": ref_id}, {"_id": 0}).to_list(100)
    if not items:
        raise HTTPException(status_code=404, detail="No items found for this reference")

    advances = await db.advances.find({"ref": ref_id}, {"_id": 0}).to_list(50)
    stored_settings = await db.settings.find_one({"key": "app_settings"}, {"_id": 0})
    s = merge_settings(stored_settings)

    GST_RATE = float(s.get("gst_rate", DEFAULT_SETTINGS["gst_rate"]))
    brand_color = s.get("firm_name_color", "#C86B4D")
    brand_light = f"{brand_color}15"
    firm_name = s.get("firm_name", DEFAULT_SETTINGS["firm_name"])
    firm_address = s.get("firm_address", DEFAULT_SETTINGS["firm_address"])
    firm_phones = s.get("firm_phones", DEFAULT_SETTINGS["firm_phones"])
    firm_gstin = s.get("firm_gstin", DEFAULT_SETTINGS["firm_gstin"])
    firm_logo = s.get("firm_logo", DEFAULT_SETTINGS.get("firm_logo", None))

    customer_name = items[0].get("name", "N/A")
    order_date = items[0].get("date", "N/A")
    
    # Collect payment modes
    all_modes = set()
    for i in items:
        for field in ["fabric_pay_mode", "tailoring_pay_mode", "embroidery_pay_mode", "addon_pay_mode"]:
            mode = i.get(field, "")
            if mode and mode != "N/A":
                all_modes.add(mode.replace("Settled - ", "").replace("Settled", ""))
    payment_modes = " · ".join(sorted(all_modes)) if all_modes else "Cash"
    
    # Check settlement status
    total_pending = sum(float(i.get("fabric_pending", 0)) for i in items if not str(i.get("fabric_pay_mode", "")).startswith("Settled"))
    total_pending += sum(float(i.get("tailoring_pending", 0)) for i in items if not str(i.get("tailoring_pay_mode", "")).startswith("Settled"))
    total_pending += sum(float(i.get("embroidery_pending", 0)) for i in items if not str(i.get("embroidery_pay_mode", "")).startswith("Settled"))
    total_pending += sum(float(i.get("addon_pending", 0)) for i in items if not str(i.get("addon_pay_mode", "")).startswith("Settled"))
    is_settled = total_pending <= 0

    def fmt(n):
        try:
            return f"{float(n):,.0f}"
        except:
            return "0"

    # ---- Items with badges ----
    items_html = ""
    fab_total = 0
    for item in items:
        amt = float(item.get("fabric_amount", 0))
        fab_total += amt
        badges = []
        if item.get("tailoring_status") not in ("N/A", None, "", "Not Required"):
            art_type = item.get("article_type", "Item")
            badges.append(f'<span class="item-badge">✂ {art_type}</span>')
        if item.get("addon_desc"):
            badges.append(f'<span class="item-badge addon">+ {item.get("addon_desc", "")}</span>')
        badges_html = f'<div>{" ".join(badges)}</div>' if badges else ""
        
        items_html += f"""
        <tr>
          <td>
            <div class="item-barcode">{item.get("barcode", "N/A")}</div>
            {badges_html}
          </td>
          <td>{item.get("qty", 0)}</td>
          <td>₹{fmt(item.get("price", 0))}</td>
          <td>{float(item.get("discount", 0)):.0f}%</td>
          <td>₹{fmt(amt)}</td>
        </tr>"""

    # ---- Tailoring details (conditional) ----
    tailoring_items = [x for x in items if x.get("tailoring_status") not in ("N/A", None, "", "Not Required", "Awaiting Order")]
    tailoring_html = ""
    if tailoring_items:
        tail_rows = ""
        for ti in tailoring_items:
            tail_rows += f"""
            <tr>
              <td>{ti.get("barcode", "N/A")}</td>
              <td>{ti.get("order_no", "—")}</td>
              <td>{ti.get("article_type", "—")}</td>
              <td>{ti.get("delivery_date", "—")}</td>
              <td>{ti.get("embroidery_status", "Not Required")}</td>
            </tr>"""
        tailoring_html = f"""
        <div class="inv-tailoring">
          <h5>✂ Tailoring Details</h5>
          <table>
            <thead><tr><th>Article</th><th>Order No</th><th>Type</th><th>Delivery</th><th>Embroidery</th></tr></thead>
            <tbody>{tail_rows}</tbody>
          </table>
        </div>"""

    # ---- Totals ----
    grand_total = sum(float(i.get("fabric_amount", 0)) + float(i.get("tailoring_amount", 0)) + 
                     float(i.get("embroidery_amount", 0)) + float(i.get("addon_amount", 0)) for i in items)
    total_received = grand_total - total_pending
    total_adv = sum(float(a.get("amount", 0)) for a in advances)
    
    balance_status = "Fully Paid ✓" if is_settled else f"Balance Due: ₹{fmt(total_pending)}"
    balance_color = "var(--success)" if is_settled else "var(--warning)"
    status_dot = "●" if is_settled else "●"
    status_color = "#455D4A" if is_settled else "#D49842"

    # ---- Thermal format ----
    is_thermal = format == "thermal"
    max_width = "280px" if is_thermal else "600px"
    font_family = "'IBM Plex Mono', monospace" if is_thermal else "'IBM Plex Sans', sans-serif"
    font_size = "11px" if is_thermal else "12px"
    
    if is_thermal:
        # Simplified thermal layout
        thermal_items = ""
        for item in items:
            amt = float(item.get("fabric_amount", 0))
            thermal_items += f"""
            <div style="border-bottom:1px dashed #D6D1C4;padding:4px 0;">
              <div style="font-size:10px;">{item.get('barcode','N/A')[:20]}</div>
              <div style="display:flex;justify-content:space-between;font-size:10px;">
                <span>{item.get('qty',0)}m × ₹{fmt(item.get('price',0))}</span>
                <span>₹{fmt(amt)}</span>
              </div>
            </div>"""
        
        html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Receipt – {ref_id}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&display=swap');
  * {{ box-sizing: border-box; margin: 0; padding: 0; }}
  body {{ font-family: 'IBM Plex Mono', monospace; font-size: 11px; color: #2D2A26; background: #fff; padding: 8px; max-width: 280px; margin: 0 auto; }}
  .r {{ text-align: right; }}
  .center {{ text-align: center; }}
  .firm {{ font-size: 12px; font-weight: 600; margin-bottom: 4px; }}
  .meta {{ font-size: 9px; color: #6C6760; margin-bottom: 8px; border-bottom: 1px dashed #D6D1C4; padding-bottom: 8px; }}
  .total {{ border-top: 2px solid #2D2A26; padding-top: 6px; margin-top: 6px; font-weight: 600; }}
  .footer {{ font-size: 8px; color: #9C9690; text-align: center; margin-top: 12px; padding-top: 8px; border-top: 1px dashed #D6D1C4; }}
  @media print {{ body {{ max-width: 280px; }} }}
</style>
</head>
<body>
  <div class="center firm">{firm_name[:24]}</div>
  <div class="center meta">{firm_phones}<br/>Ref: {ref_id}</div>
  <div style="margin-bottom:8px;"><b>{customer_name[:20]}</b></div>
  {thermal_items}
  <div class="total" style="display:flex;justify-content:space-between;">
    <span>TOTAL</span>
    <span>₹{fmt(grand_total)}</span>
  </div>
  <div style="display:flex;justify-content:space-between;margin-top:4px;font-size:10px;">
    <span>{'PAID' if is_settled else 'DUE'}</span>
    <span>{balance_status}</span>
  </div>
  <div class="footer">{order_date}<br/>Thank you!</div>
</body>
</html>"""
        return HTMLResponse(content=html, status_code=200)

    # ---- Standard format (v3 design) ----
    gen_time = datetime.now().strftime("%d-%m-%Y %H:%M")
    
    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Invoice – {ref_id}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700&family=IBM+Plex+Sans:wght@300;400;500&family=IBM+Plex+Mono:wght@400;500&display=swap');
  *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}
  
  :root {{
    --brand: {brand_color};
    --brand-light: {brand_light};
    --success: #455D4A;
    --warning: #D49842;
    --info: #5C8A9E;
    --bg: #F5F3EE;
    --surface: #FFFFFF;
    --border: #EBE8E1;
    --border-strong: #D6D1C4;
    --text: #2D2A26;
    --text-secondary: #6C6760;
  }}
  
  body {{ 
    font-family: 'IBM Plex Sans', sans-serif; 
    font-size: {font_size}; 
    color: var(--text); 
    background: var(--bg); 
    padding: 24px;
    line-height: 1.6;
  }}
  
  .inv {{ 
    background: var(--surface); 
    border: 1px solid var(--border); 
    max-width: {max_width}; 
    margin: 0 auto;
  }}
  
  /* Header */
  .inv-head {{ 
    padding: 24px 28px 20px; 
    border-bottom: 1px solid var(--border); 
    display: flex; 
    justify-content: space-between; 
    align-items: flex-start; 
    gap: 16px;
  }}
  
  .inv-brand {{ display: flex; align-items: flex-start; gap: 12px; }}
  .inv-logo-img {{
    width: 40px;
    height: 40px;
    object-fit: contain;
    border-radius: 8px;
    flex-shrink: 0;
  }}
  .inv-firm h2 {{ 
    font-family: 'Manrope', sans-serif; 
    font-size: 16px; 
    font-weight: 600; 
    letter-spacing: -0.2px; 
    color: var(--text); 
    margin-bottom: 1px;
  }}
  
  .inv-firm p {{ 
    font-size: 10px; 
    color: var(--text-secondary); 
    text-transform: uppercase; 
    letter-spacing: 0.18em;
  }}
  
  .inv-meta {{ text-align: right; }}
  .inv-meta .inv-ref {{ 
    font-family: 'IBM Plex Mono', monospace; 
    font-size: 14px; 
    font-weight: 500; 
    color: var(--brand); 
    margin-bottom: 4px;
  }}
  .inv-meta p {{ font-size: 10px; color: var(--text-secondary); margin-bottom: 2px; }}
  .inv-meta .inv-title {{ 
    font-family: 'Manrope', sans-serif; 
    font-size: 10px; 
    font-weight: 700; 
    text-transform: uppercase; 
    letter-spacing: 0.2em; 
    color: var(--text-secondary); 
    margin-bottom: 6px;
  }}
  
  /* Customer */
  .inv-customer {{ 
    padding: 16px 28px; 
    background: var(--bg); 
    border-bottom: 1px solid var(--border); 
    display: flex; 
    gap: 32px; 
    flex-wrap: wrap;
  }}
  .inv-customer .ic-group label {{ 
    font-size: 9px; 
    text-transform: uppercase; 
    letter-spacing: 0.18em; 
    font-weight: 700; 
    color: var(--text-secondary); 
    display: block; 
    margin-bottom: 2px;
  }}
  .inv-customer .ic-group p {{ 
    font-size: 12px; 
    color: var(--text); 
    font-weight: 500;
  }}
  
  /* Items table */
  .inv-items {{ padding: 0; }}
  .inv-items table {{ width: 100%; border-collapse: collapse; }}
  .inv-items th {{ 
    font-size: 9px; 
    text-transform: uppercase; 
    letter-spacing: 0.12em; 
    font-weight: 700; 
    color: var(--text-secondary); 
    padding: 10px 12px 8px; 
    background: var(--bg); 
    border-bottom: 1px solid var(--border);
    text-align: left;
  }}
  .inv-items th:not(:first-child) {{ text-align: right; }}
  .inv-items td {{ 
    font-size: 12px; 
    padding: 10px 12px; 
    border-bottom: 1px solid var(--border); 
    color: var(--text); 
    vertical-align: top;
  }}
  .inv-items td:not(:first-child) {{ 
    text-align: right; 
    font-family: 'IBM Plex Mono', monospace;
  }}
  .item-barcode {{ font-weight: 500; }}
  .item-badge {{ 
    font-size: 9px; 
    padding: 1px 5px; 
    background: var(--info); 
    color: white; 
    border-radius: 2px; 
    font-weight: 600; 
    text-transform: uppercase; 
    letter-spacing: 0.08em; 
    margin-top: 2px; 
    display: inline-block;
  }}
  .item-badge.addon {{ background: var(--brand); }}
  
  /* Totals */
  .inv-totals {{ padding: 12px 28px; border-top: 1px solid var(--border); }}
  .inv-total-row {{ 
    display: flex; 
    justify-content: space-between; 
    align-items: center; 
    padding: 4px 0;
  }}
  .inv-total-row.subtotal {{ color: var(--text-secondary); font-size: 12px; }}
  .inv-total-row.grand {{ 
    font-family: 'Manrope', sans-serif; 
    font-size: 18px; 
    font-weight: 600; 
    color: var(--text); 
    padding-top: 10px; 
    border-top: 1px solid var(--border-strong); 
    margin-top: 6px;
  }}
  .inv-total-row.grand span:last-child {{ color: var(--brand); }}
  .inv-total-row.received {{ 
    color: var(--success); 
    font-size: 12px; 
    font-family: 'IBM Plex Mono', monospace;
  }}
  .inv-total-row.balance {{ 
    color: {balance_color}; 
    font-size: 12px; 
    font-weight: 600; 
    font-family: 'IBM Plex Mono', monospace;
  }}
  
  /* Tailoring section */
  .inv-tailoring {{ 
    margin: 0 28px 16px; 
    background: var(--info)10; 
    border: 1px solid var(--info)30; 
    border-radius: 2px; 
    padding: 12px 14px;
  }}
  .inv-tailoring h5 {{ 
    font-size: 9px; 
    text-transform: uppercase; 
    letter-spacing: 0.18em; 
    font-weight: 700; 
    color: var(--info); 
    margin-bottom: 8px;
  }}
  .inv-tailoring table {{ width: 100%; border-collapse: collapse; }}
  .inv-tailoring th {{ 
    font-size: 9px; 
    color: var(--text-secondary); 
    text-align: left; 
    padding: 4px 6px; 
    font-weight: 600;
  }}
  .inv-tailoring td {{ 
    font-size: 10px; 
    padding: 4px 6px; 
    color: var(--text); 
    border-top: 1px solid var(--info)20;
  }}
  
  /* Payment band */
  .inv-payment {{ 
    padding: 12px 28px; 
    background: var(--bg); 
    border-top: 1px solid var(--border); 
    display: flex; 
    gap: 24px; 
    flex-wrap: wrap;
  }}
  .inv-payment label {{ 
    font-size: 9px; 
    text-transform: uppercase; 
    letter-spacing: 0.18em; 
    font-weight: 700; 
    color: var(--text-secondary); 
    display: block; 
    margin-bottom: 2px;
  }}
  .inv-payment p {{ font-size: 11px; color: var(--text); }}
  
  /* Footer */
  .inv-footer {{ 
    padding: 16px 28px; 
    border-top: 1px solid var(--border); 
    display: flex; 
    justify-content: space-between; 
    align-items: center;
  }}
  .inv-footer .ifooter-left {{ 
    font-size: 9px; 
    color: var(--text-secondary); 
    text-transform: uppercase; 
    letter-spacing: 0.12em;
  }}
  .inv-footer .ifooter-right {{ 
    font-size: 9px; 
    color: var(--text-secondary); 
    text-align: right;
  }}
  .inv-footer .ifooter-thanks {{ 
    font-family: 'Manrope', sans-serif; 
    font-size: 11px; 
    font-weight: 500; 
    color: var(--brand); 
    margin-bottom: 1px;
  }}
  
  /* Print */
  @media print {{
    body {{ background: #fff; padding: 0; margin: 0; }}
    .inv {{ border: none; max-width: none; }}
    @page {{ margin: 10mm 12mm; size: A4; }}
  }}
</style>
</head>
<body>
<div class="inv">
  <!-- Head -->
  <div class="inv-head">
    <div class="inv-brand">
      {f'<img src="{firm_logo}" class="inv-logo-img" alt="logo" />' if firm_logo else ''}
      <div class="inv-firm">
        <h2>{firm_name}</h2>
        <p>Fabric &amp; Tailoring</p>
        <p style="font-size:10px;color:var(--text-secondary);margin-top:3px;font-style:normal;">{firm_address} · {firm_phones}</p>
      </div>
    </div>
    <div class="inv-meta">
      <p class="inv-title">Tax Invoice</p>
      <p class="inv-ref">{ref_id}</p>
      <p>Date: {order_date}</p>
      <p>Payment: {order_date}</p>
    </div>
  </div>

  <!-- Customer row -->
  <div class="inv-customer">
    <div class="ic-group">
      <label>Bill To</label>
      <p>{customer_name}</p>
    </div>
    <div class="ic-group">
      <label>Payment Mode</label>
      <p>{payment_modes}</p>
    </div>
    <div class="ic-group">
      <label>Status</label>
      <p style="color:{status_color};font-weight:600;">{status_dot} {"Settled" if is_settled else "Pending"}</p>
    </div>
  </div>

  <!-- Items -->
  <div class="inv-items">
    <table>
      <thead>
        <tr>
          <th style="text-align:left;">Article / Barcode</th>
          <th>Qty (m)</th>
          <th>Rate</th>
          <th>Disc%</th>
          <th>Amount</th>
        </tr>
      </thead>
      <tbody>
        {items_html}
      </tbody>
    </table>
  </div>

  <!-- Totals -->
  <div class="inv-totals">
    <div class="inv-total-row subtotal"><span>Subtotal ({len(items)} articles)</span><span style="font-family:'IBM Plex Mono',monospace;">₹{fmt(fab_total)}</span></div>
    <div class="inv-total-row grand"><span>Grand Total</span><span>₹{fmt(grand_total)}</span></div>
    <div style="height:8px;"></div>
    <div class="inv-total-row received"><span>Amount Received</span><span>₹{fmt(total_received)}</span></div>
    <div class="inv-total-row balance"><span>{balance_status}</span></div>
  </div>

  {tailoring_html}

  <!-- Payment band -->
  <div class="inv-payment">
    <div>
      <label>Payment Mode(s)</label>
      <p>{payment_modes}</p>
    </div>
    <div>
      <label>Payment Date</label>
      <p>{order_date}</p>
    </div>
    <div>
      <label>Bill Created</label>
      <p>{order_date}</p>
    </div>
  </div>

  <!-- Footer -->
  <div class="inv-footer">
    <div class="ifooter-left">
      <p>{firm_name} · {firm_address}</p>
      <p style="margin-top:2px;">GSTIN: {firm_gstin}</p>
    </div>
    <div class="ifooter-right">
      <p class="ifooter-thanks">Thank you for your business!</p>
      <p>This is a computer-generated invoice.</p>
    </div>
  </div>
</div>
</body>
</html>"""

    return HTMLResponse(content=html, status_code=200)

# ==========================================
# REPORTS & ANALYTICS
# ==========================================

@router.get("/reports/revenue")
async def get_revenue_report(period: str = "daily", date_from: Optional[str] = None, date_to: Optional[str] = None, current_user: dict = Depends(get_current_user_dep)):
    match_query = {}
    if date_from:
        match_query.setdefault("date", {})["$gte"] = date_from
    if date_to:
        match_query.setdefault("date", {})["$lte"] = date_to

    pipeline = [
        {"$match": match_query} if match_query else {"$match": {}},
        {"$group": {
            "_id": "$date",
            "fabric_total": {"$sum": "$fabric_amount"},
            "fabric_received": {"$sum": "$fabric_received"},
            "tailoring_total": {"$sum": "$tailoring_amount"},
            "tailoring_received": {"$sum": "$tailoring_received"},
            "embroidery_total": {"$sum": "$embroidery_amount"},
            "embroidery_received": {"$sum": "$embroidery_received"},
            "addon_total": {"$sum": "$addon_amount"},
            "count": {"$sum": 1},
        }},
        {"$sort": {"_id": 1}},
    ]

    daily = await db.items.aggregate(pipeline).to_list(1000)

    if period == "weekly":
        weekly = {}
        for d in daily:
            try:
                dt = datetime.strptime(d["_id"], "%Y-%m-%d")
                week_start = dt.strftime("%Y-W%W")
                if week_start not in weekly:
                    weekly[week_start] = {"_id": week_start, "fabric_total": 0, "fabric_received": 0, "tailoring_total": 0, "tailoring_received": 0, "embroidery_total": 0, "embroidery_received": 0, "addon_total": 0, "count": 0}
                for k in ["fabric_total", "fabric_received", "tailoring_total", "tailoring_received", "embroidery_total", "embroidery_received", "addon_total", "count"]:
                    weekly[week_start][k] += d[k]
            except Exception:
                pass
        return list(weekly.values())

    if period == "monthly":
        monthly = {}
        for d in daily:
            month_key = d["_id"][:7] if d["_id"] else "unknown"
            if month_key not in monthly:
                monthly[month_key] = {"_id": month_key, "fabric_total": 0, "fabric_received": 0, "tailoring_total": 0, "tailoring_received": 0, "embroidery_total": 0, "embroidery_received": 0, "addon_total": 0, "count": 0}
            for k in ["fabric_total", "fabric_received", "tailoring_total", "tailoring_received", "embroidery_total", "embroidery_received", "addon_total", "count"]:
                monthly[month_key][k] += d[k]
        return list(monthly.values())

    return daily

@router.get("/reports/customers")
async def get_customer_report(current_user: dict = Depends(get_current_user_dep)):
    pipeline = [
        {"$group": {
            "_id": "$name",
            "total_fabric": {"$sum": "$fabric_amount"},
            "total_received": {"$sum": "$fabric_received"},
            "total_pending_raw": {"$sum": {"$cond": [{"$not": [{"$regexMatch": {"input": {"$ifNull": ["$fabric_pay_mode", ""]}, "regex": "^Settled"}}]}, "$fabric_pending", 0]}},
            "total_tailoring": {"$sum": "$tailoring_amount"},
            "items_count": {"$sum": 1},
            "refs": {"$addToSet": "$ref"},
        }},
        {"$sort": {"total_fabric": -1}},
    ]
    result = await db.items.aggregate(pipeline).to_list(200)
    return [
        {
            "name": r["_id"],
            "total_fabric": r["total_fabric"],
            "total_received": r["total_received"],
            "total_pending": max(0, r["total_pending_raw"]),
            "total_tailoring": r["total_tailoring"],
            "items_count": r["items_count"],
            "refs_count": len(r["refs"]),
        }
        for r in result if r["_id"]
    ]

@router.get("/reports/summary")
async def get_summary_report(date_from: Optional[str] = None, date_to: Optional[str] = None, current_user: dict = Depends(get_current_user_dep)):
    match_query = {}
    if date_from:
        match_query.setdefault("date", {})["$gte"] = date_from
    if date_to:
        match_query.setdefault("date", {})["$lte"] = date_to

    items = await db.items.find(match_query if match_query else {}, {"_id": 0}).to_list(5000)
    advances = await db.advances.find({}, {"_id": 0}).to_list(500)

    total_fabric = sum(i.get("fabric_amount", 0) for i in items)
    total_fabric_received = sum(i.get("fabric_received", 0) for i in items)
    # max(0, sum) so over-paid credits (negative pending) correctly reduce the outstanding total
    total_fabric_pending = sum(i.get("fabric_pending", 0) for i in items if not str(i.get("fabric_pay_mode", "")).startswith("Settled"))
    total_tailoring = sum(i.get("tailoring_amount", 0) for i in items)
    total_tailoring_received = sum(i.get("tailoring_received", 0) for i in items)
    total_tailoring_pending = sum(i.get("tailoring_pending", 0) for i in items if not str(i.get("tailoring_pay_mode", "")).startswith("Settled"))
    total_embroidery = sum(i.get("embroidery_amount", 0) for i in items)
    total_embroidery_received = sum(i.get("embroidery_received", 0) for i in items)
    total_embroidery_pending = sum(i.get("embroidery_pending", 0) for i in items if not str(i.get("embroidery_pay_mode", "")).startswith("Settled"))
    total_addon = sum(i.get("addon_amount", 0) for i in items)
    total_addon_received = sum(i.get("addon_received", 0) for i in items)
    total_addon_pending = sum(i.get("addon_pending", 0) for i in items if not str(i.get("addon_pay_mode", "")).startswith("Settled"))
    total_advance = sum(a.get("amount", 0) for a in advances)

    # Payment mode breakdown
    mode_counts = {}
    for i in items:
        mode = i.get("fabric_pay_mode", "N/A")
        if mode.startswith("Settled"):
            parts = mode.replace("Settled - ", "").split(", ")
            for p in parts:
                p = p.strip()
                if p:
                    mode_counts[p] = mode_counts.get(p, 0) + i.get("fabric_received", 0)

    # Article type breakdown
    article_counts = {}
    for i in items:
        at = i.get("article_type", "N/A")
        if at != "N/A":
            article_counts[at] = article_counts.get(at, 0) + 1

    return {
        "total_fabric": total_fabric,
        "total_fabric_received": total_fabric_received,
        "total_fabric_pending": total_fabric_pending,
        "total_tailoring": total_tailoring,
        "total_tailoring_received": total_tailoring_received,
        "total_tailoring_pending": total_tailoring_pending,
        "total_embroidery": total_embroidery,
        "total_embroidery_received": total_embroidery_received,
        "total_embroidery_pending": total_embroidery_pending,
        "total_addon": total_addon,
        "total_addon_received": total_addon_received,
        "total_addon_pending": total_addon_pending,
        "total_advance": total_advance,
        "total_items": len(items),
        "payment_modes": [{"mode": k, "amount": v} for k, v in sorted(mode_counts.items(), key=lambda x: -x[1])],
        "article_types": [{"type": k, "count": v} for k, v in sorted(article_counts.items(), key=lambda x: -x[1])],
    }

# ==========================================
# EXCEL IMPORT (Upload .xlsm/.xlsx from browser)
# ==========================================

