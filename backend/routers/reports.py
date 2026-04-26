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
from .models import ARTICLE_TYPES, TAILORING_RATES, DEFAULT_SETTINGS, merge_settings
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
    
    # Collect payment modes (deduplicated, strip "Settled - " prefix)
    all_modes = set()
    for i in items:
        for field in ["fabric_pay_mode", "tailoring_pay_mode", "embroidery_pay_mode", "addon_pay_mode"]:
            mode = i.get(field, "")
            if mode and mode != "N/A":
                clean = mode.replace("Settled - ", "").replace("Settled", "").strip()
                if clean:
                    all_modes.add(clean)
    payment_modes = " · ".join(sorted(all_modes)) if all_modes else "—"

    # Collect latest payment date across all categories
    pay_dates = []
    for i in items:
        for field in ["fabric_pay_date", "tailoring_pay_date", "embroidery_pay_date", "addon_pay_date"]:
            d = i.get(field, "")
            if d and d != "N/A":
                pay_dates.append(d)
    latest_pay_date = max(pay_dates) if pay_dates else order_date

    # Settlement status — only unsettled (pay_mode not starting with "Settled") sections contribute
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
            emb = ti.get("embroidery_status", "Not Required")
            emb_display = emb if emb not in ("N/A", "", None, "Not Required") else "—"
            tail_rows += f"""
            <tr>
              <td>{ti.get("barcode", "N/A")}</td>
              <td>{ti.get("article_type", "—")}</td>
              <td>{ti.get("order_no", "—")}</td>
              <td>{ti.get("delivery_date", "—")}</td>
              <td>{ti.get("tailoring_status", "—")}</td>
              <td>{emb_display}</td>
            </tr>"""
        tailoring_html = f"""
        <div class="inv-tailoring">
          <h5>✂ Tailoring Details</h5>
          <table>
            <thead><tr><th>Barcode</th><th>Article Type</th><th>Order No</th><th>Delivery</th><th>Status</th><th>Embroidery</th></tr></thead>
            <tbody>{tail_rows}</tbody>
          </table>
        </div>"""

    # ---- Totals ----
    grand_total = sum(float(i.get("fabric_amount", 0)) + float(i.get("tailoring_amount", 0)) +
                     float(i.get("embroidery_amount", 0)) + float(i.get("addon_amount", 0)) for i in items)
    # Correct received = sum of all actual received fields (not derived from pending)
    total_received = sum(
        float(i.get("fabric_received", 0)) + float(i.get("tailoring_received", 0)) +
        float(i.get("embroidery_received", 0)) + float(i.get("addon_received", 0))
        for i in items
    )
    total_adv = sum(float(a.get("amount", 0)) for a in advances)
    
    balance_status = "Fully Paid ✓" if is_settled else f"Balance Due: ₹{fmt(total_pending)}"
    status_dot = "●" if is_settled else "○"
    status_color = "#111111"

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

    # ---- Standard format (v4 redesign) ----

    # ---- Build per-article rows for each section ----
    def section_rows(items_list, amt_field, section_label, show_order=False):
        """Returns (rows_html, subtotals_dict) for a section table."""
        if not items_list:
            return "", {}
        sub_base = sub_disc = sub_gst = sub_amt = 0.0
        rows = ""
        for item in items_list:
            amt = float(item.get(amt_field, 0))
            if section_label == "Fabric":
                price = float(item.get("price", 0))
                qty   = float(item.get("qty", 0))
                disc_pct = float(item.get("discount", 0))
                base_pre_disc = price * qty
                disc_amt = base_pre_disc * disc_pct / 100
                base = base_pre_disc - disc_amt
                gst  = round(base * GST_RATE / 100, 2)
                disc_str = f"₹{fmt(disc_amt)}" if disc_pct > 0 else "—"
                desc = f'<div class="sec-barcode">{item.get("barcode","N/A")}</div>'
                cols = [desc, fmt(qty), f"₹{fmt(price)}", f"{disc_pct:.0f}%", disc_str, f"₹{fmt(base)}", f"₹{fmt(gst)}", f"₹{fmt(amt)}"]
            elif section_label == "Tailoring":
                tail_amt = float(item.get("tailoring_amount", 0))
                gst = 0.0
                base = tail_amt
                desc = f'<div class="sec-barcode">{item.get("barcode","N/A")}</div><div class="sec-sub">{item.get("article_type","—")}</div>'
                cols = [desc, f"₹{fmt(tail_amt)}"]
            elif section_label == "Embroidery":
                emb_amt = float(item.get("embroidery_amount", 0))
                gst = 0.0
                base = emb_amt
                desc = f'<div class="sec-barcode">{item.get("barcode","N/A")}</div>'
                cols = [desc, f"₹{fmt(emb_amt)}"]
            elif section_label == "Add-on":
                ao_amt = float(item.get("addon_amount", 0))
                gst = 0.0
                base = ao_amt
                desc = f'<div class="sec-barcode">{item.get("addon_desc","Add-on")}</div>'
                cols = [desc, f"₹{fmt(ao_amt)}"]
            else:
                cols = ["—","—","—","—","—","—","—","—"]
                base = gst = disc_amt = amt
                disc_pct = 0

            if section_label == "Fabric":
                sub_base += base_pre_disc - disc_amt
                sub_disc += disc_amt
            else:
                sub_base += base
                sub_disc += 0
            sub_gst += gst
            sub_amt += amt

            tds = "".join(
                f'<td{"" if i==0 else " class=\"r\""}>{"" if i==0 else ""}{c}</td>'
                for i, c in enumerate(cols)
            )
            rows += f'<tr>{tds}</tr>\n'

        return rows, {"base": sub_base, "disc": sub_disc, "gst": sub_gst, "amt": sub_amt}

    # ---- Build section HTML blocks ----
    def make_section(label, items_list, amt_field):
        if not items_list:
            return "", 0.0, 0.0
        rows_html, subs = section_rows(items_list, amt_field, label)
        if not rows_html:
            return "", 0.0, 0.0
        sub_gst = subs["gst"]
        sub_amt = subs["amt"]
        sub_base = subs["base"]
        sub_disc = subs["disc"]

        if label == "Fabric":
            # Fabric: base = price*qty - disc (GST-exclusive), GST col, Total col
            headers = ["Article / Barcode", "Qty (m)", "Rate", "Disc %", "Disc Amt", f"Base (excl GST {int(GST_RATE)}%)", f"GST {int(GST_RATE)}%", "Total"]
            th_row = "".join(f'<th{"" if i==0 else " class=\"r\""} >{h}</th>' for i, h in enumerate(headers))
            sub_tds = f'<td class="subtd" colspan="4">Subtotal ({len(items_list)} articles)</td><td class="subtd r">₹{fmt(sub_disc)}</td><td class="subtd r">₹{fmt(sub_base)}</td><td class="subtd r">₹{fmt(sub_gst)}</td><td class="subtd r">₹{fmt(sub_amt)}</td>'
        else:
            # Non-fabric: just 2 cols — item desc + amount
            headers = [label + " Item", "Amount"]
            th_row = f'<th>{headers[0]}</th><th class="r">{headers[1]}</th>'
            sub_tds = f'<td class="subtd">Subtotal</td><td class="subtd r">₹{fmt(sub_amt)}</td>'

        block = f"""
        <div class="sec-block">
          <div class="sec-head">{label}</div>
          <table>
            <thead><tr>{th_row}</tr></thead>
            <tbody>
              {rows_html}
              <tr class="sub-row">{sub_tds}</tr>
            </tbody>
          </table>
        </div>"""
        return block, sub_gst, sub_amt

    # Fabric items
    fabric_items = items
    # Tailoring items (only those with a real tailoring amount)
    tail_items = [x for x in items if float(x.get("tailoring_amount", 0)) > 0]
    # Embroidery items
    emb_items = [x for x in items if float(x.get("embroidery_amount", 0)) > 0]
    # Add-on items
    ao_items = [x for x in items if float(x.get("addon_amount", 0)) > 0]

    fab_block, fab_gst, fab_amt = make_section("Fabric", fabric_items, "fabric_amount")
    tail_block, tail_gst, tail_amt_total = make_section("Tailoring", tail_items, "tailoring_amount")
    emb_block, emb_gst, emb_amt_total = make_section("Embroidery", emb_items, "embroidery_amount")
    ao_block, ao_gst, ao_amt_total = make_section("Add-on", ao_items, "addon_amount")

    # Advance section
    adv_block = ""
    adv_total = 0.0
    if advances:
        adv_rows = ""
        for a in advances:
            amt_a = float(a.get("amount", 0))
            adv_total += amt_a
            adv_rows += f'<tr><td>{a.get("date","—")}</td><td class="r mono">₹{fmt(amt_a)}</td><td>{a.get("mode","—")}</td><td>{a.get("note","")}</td></tr>'
        adv_block = f"""
        <div class="sec-block">
          <div class="sec-head">Advances</div>
          <table>
            <thead><tr><th>Date</th><th class="r">Amount</th><th>Mode</th><th>Note</th></tr></thead>
            <tbody>
              {adv_rows}
              <tr class="sub-row"><td class="subtd" colspan="1">Total Advances</td><td class="subtd r">₹{fmt(adv_total)}</td><td class="subtd" colspan="2"></td></tr>
            </tbody>
          </table>
        </div>"""

    # Grand total
    grand_total_calc = fab_amt + tail_amt_total + emb_amt_total + ao_amt_total
    total_gst_calc   = fab_gst  # only fabric has GST

    # ---- Payment details table (section-wise) ----
    def pay_row(label, amt, rcvd, rcvd_date, mode, pay_mode_raw):
        if amt <= 0:
            return ""
        is_settled_sec = str(pay_mode_raw).startswith("Settled")
        clean_mode = mode.replace("Settled - ", "").replace("Settled", "").strip() if mode else ""
        rcvd_str   = f"₹{fmt(rcvd)}" if rcvd > 0 else ""
        date_str   = rcvd_date if (rcvd_date and rcvd_date != "N/A" and rcvd > 0) else ""
        bal        = amt - rcvd
        bal_str    = "✓ Settled" if is_settled_sec else (f"₹{fmt(bal)}" if bal > 0 else "")
        mode_str   = clean_mode if rcvd > 0 else ""
        bal_cls    = "bal-ok" if is_settled_sec else ("bal-due" if bal > 0 else "")
        return f'<tr><td>{label}</td><td class="r">₹{fmt(amt)}</td><td class="r">{rcvd_str}</td><td class="r">{date_str}</td><td>{mode_str}</td><td class="r {bal_cls}">{bal_str}</td></tr>'

    fabric_rcvd = sum(float(i.get("fabric_received", 0)) for i in items)
    tail_rcvd   = sum(float(i.get("tailoring_received", 0)) for i in items)
    emb_rcvd    = sum(float(i.get("embroidery_received", 0)) for i in items)
    ao_rcvd     = sum(float(i.get("addon_received", 0)) for i in ao_items)

    # Use first settled item's pay mode/date for section-level display
    def _first_settled(item_list, mode_field, date_field):
        for it in item_list:
            m = it.get(mode_field, "N/A") or "N/A"
            if m.startswith("Settled"):
                return m, it.get(date_field, "") or ""
        # fallback: first item
        if item_list:
            return item_list[0].get(mode_field, "N/A") or "N/A", item_list[0].get(date_field, "") or ""
        return "N/A", ""

    fabric_pay_mode, fabric_pay_date = _first_settled(items, "fabric_pay_mode", "fabric_pay_date")
    tail_pay_mode,   tail_pay_date   = _first_settled(tail_items, "tailoring_pay_mode", "tailoring_pay_date")
    emb_pay_mode,    emb_pay_date    = _first_settled(emb_items, "embroidery_pay_mode", "embroidery_pay_date")
    ao_pay_mode,     ao_pay_date     = _first_settled(ao_items, "addon_pay_mode", "addon_pay_date")

    fabric_pend  = sum(float(i.get("fabric_pending", 0)) for i in items)
    tail_pend    = sum(float(i.get("tailoring_pending", 0)) for i in tail_items)
    emb_pend     = sum(float(i.get("embroidery_pending", 0)) for i in emb_items)
    ao_pend      = sum(float(i.get("addon_pending", 0)) for i in ao_items)

    pay_rows_html = ""
    pay_rows_html += pay_row("Fabric",     fab_amt,        fabric_rcvd, fabric_pay_date, fabric_pay_mode, fabric_pay_mode)
    pay_rows_html += pay_row("Tailoring",  tail_amt_total, tail_rcvd,   tail_pay_date,   tail_pay_mode,   tail_pay_mode)
    pay_rows_html += pay_row("Embroidery", emb_amt_total,  emb_rcvd,    emb_pay_date,    emb_pay_mode,    emb_pay_mode)
    pay_rows_html += pay_row("Add-on",     ao_amt_total,   ao_rcvd,     ao_pay_date,     ao_pay_mode,     ao_pay_mode)

    total_rcvd_all = fabric_rcvd + tail_rcvd + emb_rcvd + ao_rcvd
    # Subtotal balance: sum only unsettled sections
    unsettled_pending = 0.0
    all_settled = True
    for _amt, _rcvd, _mode in [
        (fab_amt, fabric_rcvd, fabric_pay_mode),
        (tail_amt_total, tail_rcvd, tail_pay_mode),
        (emb_amt_total, emb_rcvd, emb_pay_mode),
        (ao_amt_total, ao_rcvd, ao_pay_mode),
    ]:
        if _amt <= 0:
            continue
        if not str(_mode).startswith("Settled"):
            all_settled = False
            unsettled_pending += _amt - _rcvd
    grand_bal_cls = "bal-ok" if all_settled else "bal-due"
    grand_bal_str = "✓ Settled" if all_settled else f"₹{fmt(unsettled_pending)}"

    logo_tag = ""
    if firm_logo:
        logo_src = firm_logo if firm_logo.startswith("http") else firm_logo
        logo_tag = f'<img src="{logo_src}" class="hdr-logo" alt="logo" />'

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Tax Invoice – {ref_id}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;500;600;700;800&family=IBM+Plex+Mono:wght@400;500&display=swap');
  *, *::before, *::after {{ box-sizing: border-box; margin: 0; padding: 0; }}

  html {{
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }}

  body {{
    font-family: 'Manrope', sans-serif;
    font-size: 11px;
    color: #111;
    background: #e8e8e8;
    padding: 16px;
  }}

  /* Wrapper — A5 proportions, full-page fill */
  .inv {{
    background: #fff;
    width: 148mm;
    min-height: 210mm;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
  }}

  /* ── HEADER ── */
  .inv-hdr {{
    padding: 14px 18px 12px;
    border-bottom: 2px solid #111;
    display: flex;
    align-items: center;
    gap: 14px;
  }}
  .hdr-logo {{
    width: 48px;
    height: 48px;
    object-fit: contain;
    flex-shrink: 0;
  }}
  .hdr-firm {{
    flex: 1;
  }}
  .hdr-firm h2 {{
    font-size: 15px;
    font-weight: 800;
    letter-spacing: -0.3px;
    color: #111;
    line-height: 1.1;
  }}
  .hdr-firm .addr {{
    font-size: 9px;
    color: #444;
    margin-top: 3px;
    line-height: 1.4;
  }}
  /* ── BILL-TO / INVOICE DETAILS ── */
  .inv-billto {{
    background: #fff;
    color: #111;
    padding: 10px 18px;
    display: flex;
    gap: 0;
    border-top: 1px solid #ddd;
    border-bottom: 1px solid #ddd;
  }}
  .bt-col {{
    flex: 1;
  }}
  .bt-col + .bt-col {{
    border-left: 1px solid #bbb;
    padding-left: 14px;
    margin-left: 14px;
  }}
  .bt-label {{
    font-size: 7.5px;
    text-transform: uppercase;
    letter-spacing: 0.18em;
    color: #555;
    display: block;
    margin-bottom: 2px;
  }}
  .bt-val {{
    font-size: 12px;
    font-weight: 700;
    color: #111;
  }}
  .bt-val.small {{
    font-size: 10px;
    font-weight: 600;
    color: #111;
  }}

  /* ── SECTION BLOCKS ── */
  .sec-block {{
    border-top: 2px solid #111;
    margin-top: 6px;
  }}
  .sec-head {{
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.25em;
    color: #111;
    background: #fff;
    padding: 6px 18px 4px;
    border-left: 4px solid #111;
    border-bottom: 1px solid #ccc;
  }}
  .sec-block table {{
    width: 100%;
    border-collapse: collapse;
  }}
  .sec-block th {{
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 700;
    color: #fff;
    background: #444;
    padding: 5px 6px;
    white-space: nowrap;
  }}
  .sec-block th.r {{ text-align: right; }}
  .sec-block td {{
    font-size: 10px;
    padding: 5px 6px;
    border-bottom: 1px solid #eee;
    color: #111;
    vertical-align: top;
  }}
  .sec-block td.r {{
    text-align: right;
    font-family: 'IBM Plex Mono', monospace;
    font-size: 9.5px;
  }}
  .mono {{ font-family: 'IBM Plex Mono', monospace; }}
  .sec-block tr:nth-child(even) td {{ background: #fafafa; }}
  .sec-barcode {{ font-weight: 600; }}
  .sec-sub {{ font-size: 9px; color: #555; margin-top: 1px; }}

  /* Subtotal row */
  .sub-row td {{ border-top: 1.5px solid #aaa; border-bottom: none; background: #f0f0f0 !important; font-weight: 600; }}
  .sub-row .subtd {{ font-size: 9px; text-transform: uppercase; letter-spacing: 0.1em; }}
  .sub-row .subtd.r {{ font-family: 'IBM Plex Mono', monospace; }}

  /* ── GRAND TOTAL ── */
  .inv-grand {{
    background: #444;
    color: #fff;
    padding: 8px 18px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }}
  .inv-grand .gt-label {{ font-size: 9px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.25em; color: #fff; }}
  .inv-grand .gt-val {{ font-size: 14px; font-weight: 800; font-family: 'IBM Plex Mono', monospace; color: #fff; }}

  /* ── PAYMENT TABLE ── */
  .inv-pay-section {{
    border-top: 2px solid #111;
    margin-top: 6px;
  }}
  .inv-pay-section .sec-head {{
    font-size: 9px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.25em;
    color: #111;
    background: #fff;
    padding: 6px 18px 4px;
    border-left: 4px solid #111;
    border-bottom: 1px solid #ccc;
  }}
  .inv-pay-section table {{
    width: 100%;
    border-collapse: collapse;
  }}
  .inv-pay-section th {{
    font-size: 8px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    font-weight: 700;
    color: #fff;
    background: #444;
    padding: 5px 8px;
    text-align: left;
    white-space: nowrap;
  }}
  .inv-pay-section th.r {{ text-align: right; }}
  .inv-pay-section td {{
    font-size: 10px;
    padding: 5px 8px;
    border-bottom: 1px solid #eee;
    color: #111;
  }}
  .inv-pay-section td.r {{
    text-align: right;
    font-family: 'IBM Plex Mono', monospace;
  }}
  .inv-pay-section tr:last-child td {{ border-bottom: none; font-weight: 600; background: #f0f0f0; }}
  .bal-due {{ color: #8b0000; }}
  .bal-ok  {{ color: #1a5c2a; }}

  /* ── FOOTER ── */
  .inv-footer {{
    margin-top: auto;
    border-top: 1.5px solid #111;
    padding: 10px 18px 8px;
  }}
  .footer-top {{
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 12px;
    margin-bottom: 8px;
  }}
  .footer-sig {{
    font-size: 9px;
    font-weight: 700;
    color: #111;
    text-align: center;
    border-top: 1px solid #aaa;
    padding-top: 22px;
    min-width: 100px;
  }}
  .footer-thanks {{
    font-size: 11px;
    font-weight: 800;
    color: #111;
  }}
  .footer-tnc {{
    border-top: 1px solid #ddd;
    padding-top: 6px;
    font-size: 7.5px;
    color: #555;
    line-height: 1.6;
  }}
  .footer-tnc strong {{ color: #111; font-size: 8px; }}

  /* ── PRINT ── */
  @media print {{
    body {{ background: #fff; padding: 0; }}
    .inv {{ width: 100%; min-height: 100vh; border: none; box-shadow: none; }}
    @page {{ size: A5; margin: 8mm 10mm; }}
    /* Force background colors/images to print on mobile Chrome & Safari */
    .sec-block th,
    .inv-grand,
    .inv-pay-section th,
    .inv-pay-section .sec-head {{
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }}
  }}
</style>
</head>
<body>
<div class="inv">

  <!-- Header: Logo + Firm Name + Address -->
  <div class="inv-hdr">
    {logo_tag}
    <div class="hdr-firm">
      <h2>{firm_name}</h2>
      <div class="addr">{firm_address}<br/>Ph: {firm_phones}&nbsp;&nbsp;GSTIN: {firm_gstin}</div>
    </div>
  </div>

  <!-- Bill To + Invoice Details (dark band) -->
  <div class="inv-billto">
    <div class="bt-col">
      <span class="bt-label">Bill To</span>
      <div class="bt-val">{customer_name}</div>
    </div>
    <div class="bt-col">
      <span class="bt-label">Tax Invoice No.</span>
      <div class="bt-val small">{ref_id}</div>
    </div>
    <div class="bt-col">
      <span class="bt-label">Bill Date</span>
      <div class="bt-val small">{order_date}</div>
    </div>
  </div>

  <!-- Section: Fabric -->
  {fab_block}

  <!-- Section: Tailoring -->
  {tail_block}

  <!-- Section: Embroidery -->
  {emb_block}

  <!-- Section: Add-on -->
  {ao_block}

  <!-- Section: Advances -->
  {adv_block}

  <!-- Grand Total -->
  <div class="inv-grand">
    <div class="gt-label">Grand Total</div>
    <div class="gt-val">₹{fmt(grand_total_calc)}</div>
  </div>

  <!-- Payment Details -->
  <div class="inv-pay-section">
    <div class="sec-head">Payment Details</div>
    <table>
      <thead>
        <tr>
          <th>Section</th>
          <th class="r">Amount</th>
          <th class="r">Received</th>
          <th class="r">Rcvd Date</th>
          <th>Mode</th>
          <th class="r">Balance</th>
        </tr>
      </thead>
      <tbody>
        {pay_rows_html}
        <tr>
          <td>Total</td>
          <td class="r">₹{fmt(grand_total_calc)}</td>
          <td class="r">₹{fmt(total_rcvd_all)}</td>
          <td></td>
          <td></td>
          <td class="r {grand_bal_cls}">{grand_bal_str}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- Footer -->
  <div class="inv-footer">
    <div class="footer-top">
      <div></div>
      <div class="footer-sig">Authorised Signatory</div>
    </div>
    <div class="footer-tnc">
      <strong>Terms &amp; Conditions</strong><br/>
      1. All disputes are subject to local jurisdiction only.<br/>
      2. Goods once sold will not be taken back or exchanged.<br/>
      3. Payment is due within 30 days of the bill date.<br/>
      4. We are not responsible for any damage after delivery.
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

