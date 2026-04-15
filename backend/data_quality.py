from datetime import datetime, timezone
from typing import List
import uuid


def round_money(value: float) -> float:
    return round(float(value or 0), 2)


def determine_payment_status(pending_amount: float, received_amount: float) -> str:
    pending_amount = round_money(pending_amount)
    received_amount = round_money(received_amount)
    if pending_amount <= 0 and received_amount > 0:
        return "Settled"
    if pending_amount > 0 and received_amount > 0:
        return "Partially Settled"
    if pending_amount > 0:
        return "Pending"
    return "N/A"


def build_payment_mode_label(payment_modes: List[str], pending_amount: float, received_amount: float) -> str:
    status = determine_payment_status(pending_amount, received_amount)
    if status == "Settled":
        return f"Settled - {', '.join(payment_modes) if payment_modes else 'Cash'}"
    if status == "Partially Settled":
        return f"Partially Settled - {', '.join(payment_modes) if payment_modes else 'Cash'}"
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

    if pending < 0:
        issues.append({
            "type": "negative_pending",
            "category": label,
            "message": f"{label} pending is negative",
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

    if total >= 0 and received - total > 0.01:
        issues.append({
            "type": "received_exceeds_total",
            "category": label,
            "message": f"{label} received exceeds total amount",
            "total": total,
            "received": received,
            "pending": pending,
            "mode": mode,
        })

    if total >= 0 and pending - total > 0.01:
        issues.append({
            "type": "pending_exceeds_total",
            "category": label,
            "message": f"{label} pending exceeds total amount",
            "total": total,
            "received": received,
            "pending": pending,
            "mode": mode,
        })

    if total > 0 and abs(round_money(received + pending) - total) > 1:
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

    if expected_status == "Partially Settled" and not str(mode).startswith("Partially Settled"):
        issues.append({
            "type": "mode_status_mismatch",
            "category": label,
            "message": f"{label} is partially settled but mode is {mode}",
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
            else:
                received = round_money(max(0, total - pending))

    status = determine_payment_status(pending, received)
    mode = original_mode
    if original_mode != "N/A" or total > 0 or received > 0 or pending > 0:
        mode = status if status != "N/A" else "N/A"
        if status in ("Settled", "Partially Settled"):
            mode_suffix = ""
            if " - " in str(original_mode):
                mode_suffix = original_mode.split(" - ", 1)[1].strip()
            if mode_suffix:
                mode = f"{status} - {mode_suffix}"

    return {
        received_field: received,
        pending_field: pending,
        mode_field: mode,
    }


async def normalize_low_risk_data(db, limit: int = 100) -> dict:
    items = await db.items.find({}, {"_id": 0}).to_list(10000)
    advances = await db.advances.find({}, {"_id": 0}).to_list(5000)

    changes = []
    items_updated = 0
    advances_updated = 0

    for item in items:
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
            await db.items.update_one({"id": item["id"]}, {"$set": updates})
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

    advance_totals = {}
    for adv in advances:
        ref = adv.get("ref", "")
        amount = round_money(adv.get("amount", 0))
        advance_totals[ref] = round_money(advance_totals.get(ref, 0) + amount)

    for ref, total in advance_totals.items():
        if total < -0.01:
            negative_entries = [a for a in advances if a.get("ref") == ref and round_money(a.get("amount", 0)) < 0 and a.get("mode") != "Adjusted"]
            for adv in negative_entries:
                await db.advances.update_one({"id": adv["id"]}, {"$set": {"mode": "Adjusted"}})
                advances_updated += 1
                if len(changes) < limit:
                    changes.append({
                        "kind": "advance",
                        "advance_id": adv.get("id"),
                        "ref": ref,
                        "name": adv.get("name"),
                        "updates": {"mode": "Adjusted"},
                    })

    return {
        "items_updated": items_updated,
        "advances_updated": advances_updated,
        "changes": changes,
        "audit_after": await generate_data_audit(db, limit),
    }


async def repair_high_risk_data(db, limit: int = 100) -> dict:
    items = await db.items.find({}, {"_id": 0}).to_list(10000)
    item_updates = 0
    advances_created = 0
    changes = []

    for item in items:
        updates = {}
        carry_forwards = []
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

            excess = 0.0
            corrected_received = received
            corrected_pending = pending

            if received > total + 0.01:
                excess = max(excess, round_money(received - total))
                corrected_received = total
                corrected_pending = 0.0

            if corrected_pending < -0.01:
                excess = max(excess, round_money(-corrected_pending))
                corrected_received = total
                corrected_pending = 0.0

            if corrected_pending >= 0 and corrected_received <= total + 0.01:
                corrected_pending = round_money(max(0, total - corrected_received))

            corrected_mode = original_mode
            corrected_status = determine_payment_status(corrected_pending, corrected_received)
            if corrected_status == "Pending":
                corrected_mode = "Pending"
            elif corrected_status in ("Settled", "Partially Settled"):
                suffix = ""
                if " - " in str(original_mode):
                    suffix = original_mode.split(" - ", 1)[1].strip()
                corrected_mode = f"{corrected_status} - {suffix}" if suffix else corrected_status
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

            if excess > 0.01:
                carry_forwards.append({
                    "category": label,
                    "amount": excess,
                    "date": item.get(date_field) if item.get(date_field) and item.get(date_field) != "N/A" else item.get("date"),
                })
                changed_fields["carry_forward"] = excess

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
            await db.items.update_one({"id": item["id"]}, {"$set": updates})
            item_updates += 1

        for carry in carry_forwards:
            adv = {
                "id": str(uuid.uuid4()),
                "date": carry["date"] or item.get("date"),
                "name": item.get("name", ""),
                "ref": item.get("ref", ""),
                "amount": carry["amount"],
                "mode": f"Auto Carry Forward - {carry['category'].title()}",
                "tally": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.advances.insert_one(adv)
            advances_created += 1
            if len(changes) < limit:
                changes.append({
                    "kind": "advance_created",
                    "ref": adv["ref"],
                    "name": adv["name"],
                    "amount": adv["amount"],
                    "mode": adv["mode"],
                })

    return {
        "items_updated": item_updates,
        "advances_created": advances_created,
        "changes": changes,
        "audit_after": await generate_data_audit(db, limit),
    }


async def generate_data_audit(db, limit: int = 100) -> dict:
    items = await db.items.find({}, {"_id": 0}).to_list(10000)
    advances = await db.advances.find({}, {"_id": 0}).to_list(5000)

    issue_counts = {}
    issues = []

    def push_issue(issue: dict):
        issue_counts[issue["type"]] = issue_counts.get(issue["type"], 0) + 1
        if len(issues) < limit:
            issues.append(issue)

    for item in items:
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

    advance_total_by_ref = {}
    for adv in advances:
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
            "items": len(items),
            "advances": len(advances),
        },
        "total_issues": sum(issue_counts.values()),
        "issue_counts": dict(sorted(issue_counts.items(), key=lambda kv: (-kv[1], kv[0]))),
        "issues": issues,
    }
