import asyncio
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import List
import uuid
from pymongo import UpdateOne


PENNY_TOLERANCE = 0.01
RUPEE_TOLERANCE = 1.0

def round_money(value: float) -> float:
    return round(float(value or 0), 2)


def round_money_precise(value) -> Decimal:
    """Decimal-based rounding for exact financial arithmetic (avoids float drift)."""
    return Decimal(str(value or 0)).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def determine_payment_status(pending_amount: float, received_amount: float) -> str:
    pending_amount = round_money(pending_amount)
    if pending_amount <= PENNY_TOLERANCE:
        return "Settled"
    return "Pending"


def build_payment_mode_label(payment_modes: List[str], pending_amount: float, received_amount: float) -> str:
    status = determine_payment_status(pending_amount, received_amount)
    if status == "Settled":
        return f"Settled - {', '.join(payment_modes) if payment_modes else 'Cash'}"
    if status == "Pending":
        return "Pending"
    return "N/A"


def analyze_payment_field(
    item: dict,
    amount_field: str,
    received_field: str,
    pending_field: str,
    mode_field: str,
    label: str,
) -> List[dict]:
    issues = []
    total = round_money(item.get(amount_field, 0))
    received = round_money(item.get(received_field, 0))
    pending = round_money(item.get(pending_field, 0))
    mode = item.get(mode_field, "N/A") or "N/A"
    expected_status = determine_payment_status(pending, received)

    if pending < 0 or (total >= 0 and received - total > PENNY_TOLERANCE):
        issues.append({
            "type": "overpaid",
            "category": label,
            "message": f"{label} over-payment: received \u20b9{received} against total \u20b9{total} (credit \u20b9{round_money(received - total)})",
            "total": total,
            "received": received,
            "pending": pending,
            "mode": mode,
        })

    if received < 0:
        issues.append({
            "type": "negative_received",
            "category": label,
            "message": f"{label} received is negative",
            "total": total,
            "received": received,
            "pending": pending,
            "mode": mode,
        })

    if total >= 0 and pending - total > PENNY_TOLERANCE:
        issues.append({
            "type": "pending_exceeds_total",
            "category": label,
            "message": f"{label} pending exceeds total amount",
            "total": total,
            "received": received,
            "pending": pending,
            "mode": mode,
        })

    if total > 0 and pending >= 0 and abs(round_money(received + pending) - total) > RUPEE_TOLERANCE:
        issues.append({
            "type": "amount_mismatch",
            "category": label,
            "message": f"{label} total does not equal received plus pending",
            "total": total,
            "received": received,
            "pending": pending,
            "mode": mode,
        })

    if expected_status == "Pending" and mode != "Pending":
        issues.append({
            "type": "mode_status_mismatch",
            "category": label,
            "message": f"{label} is pending but mode is {mode}",
            "total": total,
            "received": received,
            "pending": pending,
            "mode": mode,
        })

    if expected_status == "Settled" and not str(mode).startswith("Settled"):
        issues.append({
            "type": "mode_status_mismatch",
            "category": label,
            "message": f"{label} is settled but mode is {mode}",
            "total": total,
            "received": received,
            "pending": pending,
            "mode": mode,
        })

    return issues


def normalize_payment_field(
    item: dict,
    amount_field: str,
    received_field: str,
    pending_field: str,
    mode_field: str,
) -> dict:
    total = round_money(item.get(amount_field, 0))
    received = round_money(item.get(received_field, 0))
    pending = round_money(item.get(pending_field, 0))
    original_mode = item.get(mode_field, "N/A") or "N/A"

    if pending < 0 and abs(pending) <= 1:
        pending = 0.0

    if received < 0 and abs(received) <= 1:
        received = 0.0

    if total >= 0 and received > total and abs(received - total) <= 1:
        received = total

    if total >= 0 and pending > total and abs(pending - total) <= 1:
        pending = total

    if total > 0:
        mismatch = round_money((received + pending) - total)
        if abs(mismatch) <= 1:
            if pending > 0:
                pending = round_money(max(0, total - received))
            elif pending == 0 and received > 0:
                # Only fix rounding drift when there is no over-payment
                received = round_money(total - pending)

    status = determine_payment_status(pending, received)
    mode = original_mode
    if original_mode != "N/A" or total > 0 or received > 0 or pending > 0:
        mode = status if status != "N/A" else "N/A"
        if status == "Settled":
            mode_suffix = ""
            if " - " in str(original_mode):
                mode_suffix = original_mode.split(" - ", 1)[1].strip()
                if mode_suffix.startswith("Partially Settled - "):
                    mode_suffix = mode_suffix[len("Partially Settled - "):].strip()
            if mode_suffix:
                mode = f"Settled - {mode_suffix}"

    return {
        received_field: received,
        pending_field: pending,
        mode_field: mode,
    }


_PAYMENT_PROJ = {
    "_id": 0, "id": 1, "ref": 1, "name": 1, "barcode": 1, "date": 1,
    "fabric_amount": 1, "fabric_received": 1, "fabric_pending": 1, "fabric_pay_mode": 1, "fabric_pay_date": 1,
    "tailoring_amount": 1, "tailoring_received": 1, "tailoring_pending": 1, "tailoring_pay_mode": 1, "tailoring_pay_date": 1,
    "embroidery_amount": 1, "embroidery_received": 1, "embroidery_pending": 1, "embroidery_pay_mode": 1, "embroidery_pay_date": 1,
    "addon_amount": 1, "addon_received": 1, "addon_pending": 1, "addon_pay_mode": 1, "addon_pay_date": 1,
    "embroidery_status": 1, "emb_labour_amount": 1,
}
_ADV_PROJ = {"_id": 0, "id": 1, "ref": 1, "name": 1, "amount": 1, "mode": 1, "date": 1}

async def _fetch_items_batch(db, projection, batch_size: int = 500):
    """Fetch items in batches to avoid loading entire collection into memory.
    Cancelled items are intentionally excluded — their zeroed amounts would
    produce false positives in every data quality check.
    """
    cursor = db.items.find({"cancelled": {"$ne": True}}, projection)
    batch = []
    async for doc in cursor:
        batch.append(doc)
        if len(batch) >= batch_size:
            yield batch
            batch = []
    if batch:
        yield batch

async def _fetch_advances_batch(db, projection, batch_size: int = 500):
    """Fetch advances in batches to avoid loading entire collection into memory."""
    cursor = db.advances.find({}, projection)
    batch = []
    async for doc in cursor:
        batch.append(doc)
        if len(batch) >= batch_size:
            yield batch
            batch = []
    if batch:
        yield batch

async def normalize_low_risk_data(db, limit: int = 100) -> dict:
    changes = []
    items_updated = 0
    advances_updated = 0
    total_items_scanned = 0
    total_advances_scanned = 0

    # Process items in batches
    bulk_item_ops = []
    async for items_batch in _fetch_items_batch(db, _PAYMENT_PROJ, batch_size=500):
        total_items_scanned += len(items_batch)
        for item in items_batch:
            updates = {}
            checks = [
                ("fabric_amount", "fabric_received", "fabric_pending", "fabric_pay_mode"),
                ("tailoring_amount", "tailoring_received", "tailoring_pending", "tailoring_pay_mode"),
                ("embroidery_amount", "embroidery_received", "embroidery_pending", "embroidery_pay_mode"),
                ("addon_amount", "addon_received", "addon_pending", "addon_pay_mode"),
            ]

            for check in checks:
                normalized = normalize_payment_field(item, *check)
                for field, value in normalized.items():
                    current_value = item.get(field)
                    if isinstance(value, (int, float)):
                        changed = round_money(current_value) != round_money(value)
                    else:
                        changed = current_value != value
                    if changed:
                        updates[field] = value

            if updates:
                bulk_item_ops.append(UpdateOne({"id": item["id"]}, {"$set": updates}))
                items_updated += 1
                if len(changes) < limit:
                    changes.append({
                        "kind": "item",
                        "item_id": item.get("id"),
                        "ref": item.get("ref"),
                        "name": item.get("name"),
                        "barcode": item.get("barcode"),
                        "updates": updates,
                    })
        # Flush batch operations every 500 items to keep memory bounded
        if len(bulk_item_ops) >= 500:
            await db.items.bulk_write(bulk_item_ops, ordered=False)
            bulk_item_ops = []
    # Flush remaining operations
    if bulk_item_ops:
        await db.items.bulk_write(bulk_item_ops, ordered=False)

    # Process advances in batches
    advance_totals = {}
    all_advances = []
    async for advances_batch in _fetch_advances_batch(db, _ADV_PROJ, batch_size=500):
        total_advances_scanned += len(advances_batch)
        for adv in advances_batch:
            all_advances.append(adv)
            ref = adv.get("ref", "")
            amount = round_money(adv.get("amount", 0))
            advance_totals[ref] = round_money(advance_totals.get(ref, 0) + amount)

    bulk_adv_ops = []
    for ref, total in advance_totals.items():
        if total < -0.01:
            negative_entries = [a for a in all_advances if a.get("ref") == ref and round_money(a.get("amount", 0)) < 0 and a.get("mode") != "Adjusted"]
            for adv in negative_entries:
                bulk_adv_ops.append(UpdateOne({"id": adv["id"]}, {"$set": {"mode": "Adjusted"}}))
                advances_updated += 1
                if len(changes) < limit:
                    changes.append({
                        "kind": "advance",
                        "advance_id": adv.get("id"),
                        "ref": ref,
                        "name": adv.get("name"),
                        "updates": {"mode": "Adjusted"},
                    })
    if bulk_adv_ops:
        await db.advances.bulk_write(bulk_adv_ops, ordered=False)

    return {
        "items_updated": items_updated,
        "advances_updated": advances_updated,
        "scanned": {"items": total_items_scanned, "advances": total_advances_scanned},
        "changes": changes,
        "audit_after": await generate_data_audit(db, limit),
    }


async def repair_high_risk_data(db, limit: int = 100) -> dict:
    item_updates = 0
    total_items_scanned = 0
    changes = []
    bulk_item_ops = []

    async for items_batch in _fetch_items_batch(db, _PAYMENT_PROJ, batch_size=500):
        total_items_scanned += len(items_batch)
        for item in items_batch:
            updates = {}
            checks = [
                ("fabric", "fabric_amount", "fabric_received", "fabric_pending", "fabric_pay_mode", "fabric_pay_date"),
                ("tailoring", "tailoring_amount", "tailoring_received", "tailoring_pending", "tailoring_pay_mode", "tailoring_pay_date"),
                ("embroidery", "embroidery_amount", "embroidery_received", "embroidery_pending", "embroidery_pay_mode", "embroidery_pay_date"),
                ("addon", "addon_amount", "addon_received", "addon_pending", "addon_pay_mode", "addon_pay_date"),
            ]

            for label, amount_field, received_field, pending_field, mode_field, date_field in checks:
                total = round_money(item.get(amount_field, 0))
                received = round_money(item.get(received_field, 0))
                pending = round_money(item.get(pending_field, 0))
                original_mode = item.get(mode_field, "N/A") or "N/A"

                if total <= 0 and received <= 0 and pending <= 0:
                    continue

                corrected_received = received
                corrected_pending = pending

                # Skip intentional over-payments — do not clamp them.
                if received > total + 0.01 or pending < -0.01:
                    continue

                if corrected_pending >= 0 and corrected_received <= total + 0.01:
                    corrected_pending = round_money(max(0, total - corrected_received))

                corrected_mode = original_mode
                corrected_status = determine_payment_status(corrected_pending, corrected_received)
                if corrected_status == "Pending":
                    corrected_mode = "Pending"
                elif corrected_status == "Settled":
                    suffix = ""
                    if " - " in str(original_mode):
                        suffix = original_mode.split(" - ", 1)[1].strip()
                        if suffix.startswith("Partially Settled - "):
                            suffix = suffix[len("Partially Settled - "):].strip()
                    corrected_mode = f"Settled - {suffix}" if suffix else "Settled"
                elif total <= 0:
                    corrected_mode = "N/A"

                field_updates = {
                    received_field: corrected_received,
                    pending_field: corrected_pending,
                    mode_field: corrected_mode,
                }

                changed_fields = {}
                for field, value in field_updates.items():
                    current_value = item.get(field)
                    if isinstance(value, (int, float)):
                        changed = round_money(current_value) != round_money(value)
                    else:
                        changed = current_value != value
                    if changed:
                        changed_fields[field] = value
                        updates[field] = value

                if changed_fields and len(changes) < limit:
                    changes.append({
                        "kind": "item_repair",
                        "item_id": item.get("id"),
                        "ref": item.get("ref"),
                        "name": item.get("name"),
                        "barcode": item.get("barcode"),
                        "category": label,
                        "updates": changed_fields,
                    })

            if updates:
                bulk_item_ops.append(UpdateOne({"id": item["id"]}, {"$set": updates}))
                item_updates += 1

        # Flush batch operations every 500 items to keep memory bounded
        if len(bulk_item_ops) >= 500:
            await db.items.bulk_write(bulk_item_ops, ordered=False)
            bulk_item_ops = []

    # Flush remaining operations
    if bulk_item_ops:
        await db.items.bulk_write(bulk_item_ops, ordered=False)

    return {
        "items_updated": item_updates,
        "scanned": {"items": total_items_scanned},
        "changes": changes,
        "audit_after": await generate_data_audit(db, limit),
    }


async def generate_data_audit(db, limit: int = 100) -> dict:
    issue_counts = {}
    issues = []
    total_items_scanned = 0
    total_advances_scanned = 0

    def push_issue(issue: dict):
        issue_counts[issue["type"]] = issue_counts.get(issue["type"], 0) + 1
        if len(issues) < limit:
            issues.append(issue)

    # Process items in batches to avoid loading entire collection
    async for items_batch in _fetch_items_batch(db, _PAYMENT_PROJ, batch_size=500):
        total_items_scanned += len(items_batch)
        for item in items_batch:
            base_info = {
                "item_id": item.get("id"),
                "ref": item.get("ref"),
                "name": item.get("name"),
                "barcode": item.get("barcode"),
                "date": item.get("date"),
            }

            checks = [
                ("fabric_amount", "fabric_received", "fabric_pending", "fabric_pay_mode", "fabric"),
                ("tailoring_amount", "tailoring_received", "tailoring_pending", "tailoring_pay_mode", "tailoring"),
                ("embroidery_amount", "embroidery_received", "embroidery_pending", "embroidery_pay_mode", "embroidery"),
                ("addon_amount", "addon_received", "addon_pending", "addon_pay_mode", "addon"),
            ]

            for check in checks:
                for issue in analyze_payment_field(item, *check):
                    push_issue({**base_info, **issue})

            emb_labour = round_money(item.get("emb_labour_amount", 0))
            if emb_labour > 0 and item.get("embroidery_status") not in ["Finished", "In Progress"]:
                push_issue({
                    **base_info,
                    "type": "embroidery_labour_status_mismatch",
                    "category": "embroidery_labour",
                    "message": "Embroidery labour exists while embroidery status is not in progress/finished",
                    "emb_labour_amount": emb_labour,
                    "embroidery_status": item.get("embroidery_status"),
                })

    # Process advances in batches
    advance_total_by_ref = {}
    async for advances_batch in _fetch_advances_batch(db, _ADV_PROJ, batch_size=500):
        total_advances_scanned += len(advances_batch)
        for adv in advances_batch:
            ref = adv.get("ref", "")
            amount = round_money(adv.get("amount", 0))
            advance_total_by_ref[ref] = round_money(advance_total_by_ref.get(ref, 0) + amount)
            if amount < 0 and adv.get("mode") != "Adjusted":
                push_issue({
                    "ref": ref,
                    "name": adv.get("name"),
                    "type": "negative_advance_non_adjustment",
                    "category": "advance",
                    "message": "Negative advance entry is not marked as Adjusted",
                    "amount": amount,
                    "mode": adv.get("mode"),
                    "date": adv.get("date"),
                })

    for ref, total in advance_total_by_ref.items():
        if total < -0.01:
            push_issue({
                "ref": ref,
                "type": "negative_advance_balance",
                "category": "advance",
                "message": "Advance balance is negative for this reference",
                "amount": total,
            })

    return {
        "scanned": {
            "items": total_items_scanned,
            "advances": total_advances_scanned,
        },
        "total_issues": sum(issue_counts.values()),
        "issue_counts": dict(sorted(issue_counts.items(), key=lambda kv: (-kv[1], kv[0]))),
        "issues": issues,
    }
