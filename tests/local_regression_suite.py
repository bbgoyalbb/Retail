#!/usr/bin/env python3
"""
Local regression checks for the Retail Management app.

This script is designed to run against a locally running backend, defaulting to
http://127.0.0.1:8001/api. It exercises the core money-flow paths that were
recently hardened:
 - health and stats
 - settings
 - create bill
 - partial settlement
 - search with payment status
 - data audit

It creates temporary test data and cleans it up at the end.
"""

from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass
from datetime import date


@dataclass
class TestResult:
    name: str
    passed: bool
    detail: str = ""


class LocalRegressionSuite:
    def __init__(self, base_url: str = "http://127.0.0.1:8001/api") -> None:
        self.base_url = base_url.rstrip("/")
        self.results: list[TestResult] = []
        self.created_item_ids: list[str] = []
        self.test_customer = f"Regression Test Customer {date.today().isoformat()}"
        self.created_ref: str | None = None

    def log(self, name: str, passed: bool, detail: str = "") -> None:
        self.results.append(TestResult(name, passed, detail))
        marker = "PASS" if passed else "FAIL"
        line = f"[{marker}] {name}"
        if detail:
            line += f" - {detail}"
        print(line)

    def request(self, path: str, method: str = "GET", data: dict | None = None):
        body = None
        headers = {}
        if data is not None:
            body = json.dumps(data).encode("utf-8")
            headers["Content-Type"] = "application/json"
        req = urllib.request.Request(f"{self.base_url}{path}", data=body, headers=headers, method=method)
        try:
            with urllib.request.urlopen(req, timeout=30) as response:
                raw = response.read()
                ctype = response.headers.get("Content-Type", "")
                if "application/json" in ctype:
                    return response.status, json.loads(raw.decode("utf-8"))
                return response.status, raw.decode("utf-8", errors="replace")
        except urllib.error.HTTPError as exc:
            payload = exc.read().decode("utf-8", errors="replace")
            return exc.code, payload

    def test_health(self) -> None:
        status, body = self.request("/")
        self.log("health endpoint", status == 200 and isinstance(body, dict) and body.get("status") == "running", str(body))

    def test_stats(self) -> None:
        status, body = self.request("/db/stats")
        passed = status == 200 and isinstance(body, dict) and "items_count" in body and "advances_count" in body
        self.log("db stats endpoint", passed, str(body) if not passed else f"{body['items_count']} items / {body['advances_count']} advances")

    def test_settings(self) -> None:
        status, body = self.request("/settings")
        required = {"article_types", "tailoring_rates", "payment_modes", "addon_items", "gst_rate"}
        passed = status == 200 and isinstance(body, dict) and required.issubset(body.keys())
        self.log("settings endpoint", passed, str(body) if not passed else "default/settings payload present")

    def create_bill(self) -> None:
        payload = {
            "customer_name": self.test_customer,
            "date": date.today().isoformat(),
            "payment_date": date.today().isoformat(),
            "items": [
                {"barcode": "REG-ITEM-001", "qty": 2, "price": 500, "discount": 0},
            ],
            "payment_modes": ["Cash"],
            "amount_paid": 0,
            "is_settled": False,
            "needs_tailoring": False,
        }
        status, body = self.request("/bills", "POST", payload)
        passed = status == 200 and isinstance(body, dict) and body.get("ref")
        self.log("create pending bill", passed, str(body))
        if passed:
            self.created_ref = body["ref"]
            search_status, search_body = self.request(
                f"/search?q={urllib.parse.quote(self.test_customer)}&limit=10"
            )
            if search_status == 200 and isinstance(search_body, dict):
                self.created_item_ids = [item["id"] for item in search_body.get("items", [])]

    def test_partial_settlement(self) -> None:
        if not self.created_ref:
            self.log("partial settlement", False, "no created ref available")
            return
        status, before = self.request(f"/settlements/balances?ref={urllib.parse.quote(self.created_ref)}")
        if status != 200 or not isinstance(before, dict):
            self.log("balances before settlement", False, str(before))
            return
        pay_payload = {
            "customer_name": self.test_customer,
            "ref": self.created_ref,
            "payment_date": date.today().isoformat(),
            "payment_modes": ["Cash"],
            "fresh_payment": 400,
            "use_advance": False,
            "allot_fabric": 400,
            "allot_tailoring": 0,
            "allot_embroidery": 0,
            "allot_addon": 0,
            "allot_advance": 0,
        }
        settle_status, settle_body = self.request("/settlements/pay", "POST", pay_payload)
        after_status, after = self.request(f"/settlements/balances?ref={urllib.parse.quote(self.created_ref)}")
        passed = (
            settle_status == 200
            and after_status == 200
            and isinstance(after, dict)
            and round(float(after.get("fabric", 0)), 2) == 600.0
        )
        self.log("partial settlement retains remaining balance", passed, f"before={before} after={after} settle={settle_body}")

    def test_search_status(self) -> None:
        status, body = self.request(
            f"/search?q={urllib.parse.quote(self.test_customer)}&payment_status=Settled&limit=10"
        )
        passed = (
            status == 200
            and isinstance(body, dict)
            and body.get("total", 0) >= 1
            and body["items"][0].get("payment_status") == "Settled"
        )
        self.log("search by settled status (partial payment = settled)", passed, str(body) if not passed else f"{body['total']} matching items")

    def test_audit(self) -> None:
        status, body = self.request("/db/audit?limit=10")
        passed = status == 200 and isinstance(body, dict) and "total_issues" in body and "issue_counts" in body
        self.log("data audit endpoint", passed, str(body) if not passed else f"{body['total_issues']} issues currently reported")

    def cleanup(self) -> None:
        for item_id in self.created_item_ids:
            self.request(f"/items/{item_id}", "DELETE")
        if self.created_item_ids:
            self.log("cleanup temporary records", True, f"deleted {len(self.created_item_ids)} items")

    def run(self) -> int:
        self.test_health()
        self.test_stats()
        self.test_settings()
        self.create_bill()
        self.test_partial_settlement()
        self.test_search_status()
        self.test_audit()
        self.cleanup()

        passed = sum(1 for result in self.results if result.passed)
        total = len(self.results)
        print(f"\nSummary: {passed}/{total} checks passed")
        return 0 if passed == total else 1


def main() -> int:
    base_url = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8001/api"
    suite = LocalRegressionSuite(base_url)
    return suite.run()


if __name__ == "__main__":
    raise SystemExit(main())
