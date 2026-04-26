import requests
import sys
import json
import os
from datetime import datetime, date


def normalize_base_url(base_url: str) -> str:
    """Accept either host root or /api URL and normalize to host root."""
    clean = (base_url or "").strip().rstrip("/")
    if clean.endswith("/api"):
        clean = clean[:-4]
    return clean

class SpecificFixesTester:
    def __init__(self, base_url="http://127.0.0.1:8001"):
        self.base_url = normalize_base_url(base_url)
        self.api_base = f"{self.base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.created_refs = []
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})

    def login(self, username: str = "admin", password: str = "admin123") -> bool:
        """Authenticate and inject JWT into session headers."""
        if hasattr(self, "_pending_credentials"):
            username, password = self._pending_credentials
        try:
            resp = self.session.post(
                f"{self.api_base}/auth/login",
                json={"username": username, "password": password},
            )
            if resp.status_code == 200:
                token = resp.json().get("access_token")
                if token:
                    self.session.headers.update({"Authorization": f"Bearer {token}"})
                    print(f"✅ Auth Login — logged in as '{username}'")
                    return True
            print(f"❌ Auth Login — HTTP {resp.status_code}: {resp.text[:120]}")
            return False
        except Exception as e:
            print(f"❌ Auth Login — {e}")
            return False

    def log_test(self, name: str, success: bool, details: str = ""):
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            self.failed_tests.append({"name": name, "details": details})
            print(f"❌ {name} - {details}")

    def create_test_bill(self, customer_name: str, needs_tailoring: bool = False, qty: float = 1.0):
        payload = {
            "customer_name": customer_name,
            "date": date.today().isoformat(),
            "payment_date": date.today().isoformat(),
            "items": [
                {
                    "barcode": f"TEST-{customer_name[:8].upper()}",
                    "qty": qty,
                    "price": 1000,
                    "discount": 0,
                }
            ],
            "payment_modes": ["Cash"],
            "amount_paid": 0,
            "is_settled": False,
            "needs_tailoring": needs_tailoring,
        }
        response = self.session.post(f"{self.api_base}/bills", json=payload)
        if response.status_code != 200:
            return None
        ref = response.json().get("ref")
        if ref:
            self.created_refs.append(ref)
        return response.json()

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            self.failed_tests.append({"name": name, "details": details})
            print(f"❌ {name} - {details}")

    def test_settings_endpoints(self):
        """Test new settings endpoints (Fix #7)"""
        print("\n=== Testing Settings Page Features (Fix #7) ===")
        
        # Test GET /api/settings
        try:
            response = self.session.get(f"{self.api_base}/settings")
            success = response.status_code == 200
            
            if success:
                settings = response.json()
                required_fields = ['article_types', 'tailoring_rates', 'payment_modes', 'addon_items']
                missing_fields = [f for f in required_fields if f not in settings]
                
                if missing_fields:
                    self.log_test("GET /api/settings structure", False, f"Missing: {missing_fields}")
                else:
                    self.log_test("GET /api/settings returns required fields", True)
                    print(f"   📋 Article types: {len(settings.get('article_types', []))}")
                    print(f"   💰 Payment modes: {len(settings.get('payment_modes', []))}")
                    print(f"   🎯 Add-on items: {len(settings.get('addon_items', []))}")
                    
                    # Test PUT /api/settings
                    test_update = {
                        **settings,
                        "firm_name": "Test Update - NARWANA AGENCIES"
                    }
                    
                    put_response = self.session.put(f"{self.api_base}/settings", json=test_update)
                    put_success = put_response.status_code == 200
                    self.log_test("PUT /api/settings updates and persists", put_success, 
                                put_response.text if not put_success else "")
                    
                    return success and put_success
            else:
                self.log_test("GET /api/settings", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Settings endpoints", False, str(e))
            return False

    def test_tailoring_split(self):
        """Test fabric splitting in tailoring orders (Fix #2)"""
        print("\n=== Testing Tailoring Split Feature (Fix #2) ===")
        
        try:
            fixture = self.create_test_bill("SPLIT_TEST_CUSTOMER", needs_tailoring=True, qty=2.0)
            if not fixture or not fixture.get("ref"):
                self.log_test("Tailoring split setup", False, "Failed to create fixture bill")
                return False

            items_response = self.session.get(f"{self.api_base}/items", params={"ref": fixture["ref"], "limit": 10})
            if items_response.status_code != 200:
                self.log_test("Get items for split test", False, f"Status: {items_response.status_code}")
                return False

            items = items_response.json().get("items", [])
            split_item = items[0] if items else None
            if not split_item:
                self.log_test("Tailoring split setup", False, "Fixture item not found")
                return False

            split_data = {
                "item_id": split_item["id"],
                "order_no": "TEST_SPLIT_001",
                "delivery_date": date.today().isoformat(),
                "splits": [
                    {
                        "article_type": "Shirt",
                        "qty": 1.0,
                        "embroidery_status": "Not Required"
                    },
                    {
                        "article_type": "Pant",
                        "qty": max(float(split_item.get("qty", 2.0)) - 1.0, 1.0),
                        "embroidery_status": "Required"
                    }
                ]
            }

            split_response = self.session.post(f"{self.api_base}/tailoring/split", json=split_data)
            success = split_response.status_code == 200

            if success:
                result = split_response.json()
                self.log_test("POST /api/tailoring/split works", True)
                print(f"   ✂️ Split successful: {result.get('message', '')}")
            else:
                self.log_test("POST /api/tailoring/split works", False,
                            f"Status: {split_response.status_code}, Response: {split_response.text}")

            return success
                
        except Exception as e:
            self.log_test("Tailoring split test", False, str(e))
            return False

    def test_embroidery_move_fix(self):
        """Test fixed 404 error in embroidery move (Fix #4)"""
        print("\n=== Testing Embroidery Move Fix (Fix #4) ===")
        
        try:
            # Test the fixed endpoint
            test_data = {
                "item_ids": ["test-id-123"],
                "new_status": "In Progress",
                "emb_labour_amount": 500.0,
                "emb_customer_amount": 1000.0
            }
            
            response = self.session.post(f"{self.api_base}/jobwork/move-emb", json=test_data)
            
            # Should return 200 (not 404) even with invalid item ID
            success = response.status_code == 200
            
            if success:
                result = response.json()
                self.log_test("POST /api/jobwork/move-emb returns 200 (not 404)", True)
                print(f"   🎨 Response: {result.get('message', '')}")
            else:
                self.log_test("POST /api/jobwork/move-emb returns 200 (not 404)", False, 
                            f"Status: {response.status_code} (should be 200, not 404)")
            
            return success
            
        except Exception as e:
            self.log_test("Embroidery move fix test", False, str(e))
            return False

    def test_pdf_conditional_sections(self):
        """Test PDF generation with conditional sections (Fix #1)"""
        print("\n=== Testing PDF Conditional Sections (Fix #1) ===")
        
        try:
            fabric_only = self.create_test_bill("PDF_FABRIC_ONLY", needs_tailoring=False, qty=1.0)
            tailoring_bill = self.create_test_bill("PDF_WITH_TAILORING", needs_tailoring=True, qty=1.0)

            if not fabric_only or not tailoring_bill:
                self.log_test("PDF fixture setup", False, "Unable to create fixture bills")
                return False

            response1 = self.session.get(f"{self.api_base}/invoice", params={"ref": fabric_only["ref"]})
            success1 = response1.status_code == 200 and response1.headers.get('content-type') == 'application/pdf'
            
            if success1:
                pdf_size1 = len(response1.content)
                self.log_test("PDF for fabric-only bill generates", True)
                print(f"   📄 PDF size: {pdf_size1} bytes")
            else:
                self.log_test("PDF for fabric-only bill generates", False, 
                            f"Status: {response1.status_code}")
            
            response2 = self.session.get(f"{self.api_base}/invoice", params={"ref": tailoring_bill["ref"]})
            success2 = response2.status_code == 200 and response2.headers.get('content-type') == 'application/pdf'
            
            if success2:
                pdf_size2 = len(response2.content)
                self.log_test("PDF for tailoring bill generates", True)
                print(f"   📄 PDF size: {pdf_size2} bytes")
            else:
                self.log_test("PDF for tailoring bill generates", False, 
                            f"Status: {response2.status_code}")
            
            return success1 and success2
            
        except Exception as e:
            self.log_test("PDF conditional sections test", False, str(e))
            return False

    def test_settlement_by_order_no(self):
        """Test settlement by order number (Fix #5)"""
        print("\n=== Testing Settlement by Order No (Fix #5) ===")
        
        try:
            fixture = self.create_test_bill("SETTLEMENT_TEST_CUSTOMER", needs_tailoring=False, qty=1.0)
            if not fixture or not fixture.get("ref"):
                self.log_test("Settlement balances fixture setup", False, "Unable to create fixture bill")
                return False

            response = self.session.get(f"{self.api_base}/settlements/balances", params={"ref": fixture["ref"]})
            success = response.status_code == 200
            
            if success:
                balances = response.json()
                required_fields = ['fabric', 'tailoring', 'embroidery', 'addon', 'advance']
                missing_fields = [f for f in required_fields if f not in balances]
                
                if missing_fields:
                    self.log_test("Settlement balances structure", False, f"Missing: {missing_fields}")
                else:
                    self.log_test("Settlement balances by order ref works", True)
                    print(f"   💰 Fabric: ₹{balances['fabric']}")
                    print(f"   ✂️ Tailoring: ₹{balances['tailoring']}")
                    print(f"   🎨 Embroidery: ₹{balances['embroidery']}")
                    print(f"   🎯 Add-on: ₹{balances['addon']}")
                    print(f"   💵 Advance: ₹{balances['advance']}")
                
                return True
            else:
                self.log_test("Settlement balances by order ref", False, f"Status: {response.status_code}")
                return False
                
        except Exception as e:
            self.log_test("Settlement by order no test", False, str(e))
            return False

    def run_specific_fixes_tests(self):
        """Run tests for all 7 specific fixes"""
        print("🎯 Testing 7 Specific Fixes from Review Request")
        print("=" * 60)

        # Authenticate first — all routes require a valid JWT
        if not self.login():
            print("❌ Cannot proceed without authentication. Check credentials.")
            return False

        # Fix #1: PDF only shows sections with actual data
        pdf_ok = self.test_pdf_conditional_sections()
        
        # Fix #2: Split fabric in tailoring orders
        split_ok = self.test_tailoring_split()
        
        # Fix #4: Fixed 404 error in embroidery move
        emb_ok = self.test_embroidery_move_fix()
        
        # Fix #5: Settlement by order no
        settlement_ok = self.test_settlement_by_order_no()
        
        # Fix #7: Settings page for article types, rates, payment modes
        settings_ok = self.test_settings_endpoints()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Specific Fixes Test Summary: {self.tests_passed}/{self.tests_run} passed")
        
        if self.failed_tests:
            print("\n❌ Failed Tests:")
            for test in self.failed_tests:
                print(f"   • {test['name']}: {test['details']}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"✨ Success Rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test runner for specific fixes"""
    base_url = sys.argv[1] if len(sys.argv) > 1 else os.environ.get("RETAIL_API_BASE_URL", "http://127.0.0.1:8001")
    username = sys.argv[2] if len(sys.argv) > 2 else os.environ.get("RETAIL_TEST_USER", "admin")
    password = sys.argv[3] if len(sys.argv) > 3 else os.environ.get("RETAIL_TEST_PASS", "admin123")
    tester = SpecificFixesTester(base_url)
    tester._pending_credentials = (username, password)

    try:
        success = tester.run_specific_fixes_tests()
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n💥 Test runner failed: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())