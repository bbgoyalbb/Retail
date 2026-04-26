"""
Verifies every fix from the Cascade session is present in the loaded code.
Run from backend/ with the venv python. Exit code 0 = all OK, 1 = failures found.
"""
import sys, inspect, importlib, pathlib, ast, re

ROOT = pathlib.Path(__file__).parent
sys.path.insert(0, str(ROOT))

failures = []
passes = []

def ok(label):
    passes.append(label)
    print(f"  OK   {label}")

def fail(label, detail=""):
    failures.append(label)
    print(f"  FAIL {label}" + (f": {detail}" if detail else ""))

def src(rel):
    return (ROOT / rel).read_text(encoding="utf-8")

print("\n=== Cascade Session Fix Verification ===\n")

# ── 1. server.py: importlib used to inject db before routers load ──────────
s = src("server.py")
if "importlib.util.spec_from_file_location" in s and "sys.modules[\"routers.deps\"]" in s:
    ok("1. server.py: importlib db injection before routers/__init__.py")
else:
    fail("1. server.py: importlib db injection", "missing")

# ── 2. models.py: BillLineItem has tailoring/addon optional fields ──────────
s = src("routers/models.py")
for field in ["article_type: Optional[str] = None",
              "order_no: Optional[str] = None",
              "delivery_date: Optional[str] = None",
              "embroidery_status: Optional[str] = None",
              "addons: Optional[List[dict]] = None"]:
    if field in s:
        ok(f"2. models.py BillLineItem.{field.split(':')[0].strip()}")
    else:
        fail(f"2. models.py BillLineItem.{field.split(':')[0].strip()}", "missing")

# ── 3. bills.py: effective_settled guard ───────────────────────────────────
s = src("routers/bills.py")
if "effective_settled = req.is_settled and req.amount_paid > 0" in s:
    ok("3. bills.py: effective_settled guard (is_settled+amount_paid=0 → Pending)")
else:
    fail("3. bills.py: effective_settled guard")

if "item_article_type" in s and "item_order_no" in s and "item_delivery_date" in s:
    ok("4. bills.py: tailoring fields wired from BillLineItem into doc")
else:
    fail("4. bills.py: tailoring fields not wired")

if "item_addon_amount" in s and "item_addon_desc" in s and "item_addon_pay_mode" in s:
    ok("5. bills.py: addon fields computed from line item addons")
else:
    fail("5. bills.py: addon fields not computed")

# ── 4. settlements.py: no max(0,...) on balance return ─────────────────────
s = src("routers/settlements.py")
# The return dict should NOT have max(0, ...) on fabric/tailoring/emb/addon lines
bad_clamp = re.search(r'"fabric":\s*max\(0', s)
if bad_clamp:
    fail("6. settlements.py: max(0,...) clamping still present", f"line contains: {bad_clamp.group()}")
else:
    ok("6. settlements.py: no max(0,...) clamping on balance return")

# Check the return block specifically has raw values
if '"fabric": fab[0]["total"] if fab else 0' in s:
    ok("6b. settlements.py: balance return uses raw total values")
else:
    fail("6b. settlements.py: balance return not using raw values")

# ── 5. advances.py: tally+created_at in create_advance ────────────────────
s = src("routers/advances.py")
if '"tally": False' in s and '"created_at": datetime.now' in s:
    ok("7. advances.py: create_advance includes tally=False and created_at")
else:
    fail("7. advances.py: tally/created_at missing from create_advance")

# ── 6. data_quality.py: repair skips intentional over-payments ─────────────
s = src("data_quality.py")
if "Skip intentional over-payments" in s:
    ok("8. data_quality.py: repair_high_risk_data skips intentional over-payments")
else:
    fail("8. data_quality.py: over-payment skip missing")

# ── 7. Import fixes: no response classes imported directly from fastapi ─────
BAD = ["StreamingResponse", "FileResponse", "JSONResponse", "HTMLResponse"]
for fname in ["routers/reports.py", "routers/auth_routes.py",
              "routers/data.py", "routers/items.py"]:
    s = src(fname)
    # Only check the `from fastapi import` line (not fastapi.responses)
    for line in s.splitlines():
        if line.startswith("from fastapi import") and not "fastapi.responses" in line:
            for bad in BAD:
                if bad in line:
                    fail(f"9. {fname}: {bad} still imported from fastapi directly",
                         f"line: {line.strip()}")
                    break
            else:
                continue
    ok(f"9. {fname}: no response classes imported from fastapi directly")

# ── 8. auth_routes.py: no stray server boilerplate ─────────────────────────
s = src("routers/auth_routes.py")
if "app.include_router" in s:
    fail("10. auth_routes.py: stray app.include_router still present")
elif "app.add_middleware" in s:
    fail("10. auth_routes.py: stray app.add_middleware still present")
elif "app.on_event" in s:
    fail("10. auth_routes.py: stray app.on_event still present")
else:
    ok("10. auth_routes.py: no stray server boilerplate")

# ── 9. JobWork.js: useToast imported ───────────────────────────────────────
js = (ROOT.parent / "frontend/src/pages/JobWork.js").read_text(encoding="utf-8")
if 'import { useToast }' in js or 'useToast' in js.splitlines()[1]:
    ok("11. JobWork.js: useToast imported")
else:
    fail("11. JobWork.js: useToast missing")

# ── 10. DataManager.js: repair description corrected ──────────────────────
js = (ROOT.parent / "frontend/src/pages/DataManager.js").read_text(encoding="utf-8")
if "Intentional over-payments and credit balances are preserved untouched" in js:
    ok("12. DataManager.js: repair description corrected")
else:
    fail("12. DataManager.js: repair description not updated")

# ── 11. merge_settings / DEFAULT_SETTINGS in models.py + all importers ─────
s = src("routers/models.py")
if "def merge_settings" in s and "DEFAULT_SETTINGS" in s:
    ok("13. models.py: merge_settings and DEFAULT_SETTINGS defined")
else:
    fail("13. models.py: merge_settings / DEFAULT_SETTINGS missing")

for fname, pattern in [
    ("routers/auth_routes.py",  "merge_settings"),
    ("routers/reports.py",      "merge_settings"),
    ("routers/tailoring.py",    "merge_settings"),
]:
    s = src(fname)
    if "merge_settings" in s.splitlines()[14] or "merge_settings" in s[:500]:
        ok(f"14. {fname}: imports merge_settings")
    else:
        fail(f"14. {fname}: does NOT import merge_settings")

# ── Summary ────────────────────────────────────────────────────────────────
print(f"\n{'='*42}")
print(f"  PASSED: {len(passes)}")
print(f"  FAILED: {len(failures)}")
if failures:
    print("\n  FAILURES:")
    for f in failures:
        print(f"    - {f}")
    print()
    sys.exit(1)
else:
    print("\n  ALL FIXES VERIFIED PRESENT IN CODE.\n")
    sys.exit(0)
