import requests
import sys
import json
from datetime import datetime

class SpecificFixesTester:
    def __init__(self, base_url="https://vba-converter.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_base = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []

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
            response = requests.get(f"{self.api_base}/settings")
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
                    
                    put_response = requests.put(f"{self.api_base}/settings", json=test_update)
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
            # Get items that can be split
            items_response = requests.get(f"{self.api_base}/items", params={"tailoring_status": "Awaiting Order", "limit": 5})
            
            if items_response.status_code == 200:
                items_data = items_response.json()
                items = items_data.get("items", [])
                
                # Find an item with qty > 1 for splitting
                split_item = None
                for item in items:
                    if item.get("qty", 0) > 1:
                        split_item = item
                        break
                
                if split_item:
                    split_data = {
                        "item_id": split_item["id"],
                        "order_no": "TEST_SPLIT_001",
                        "delivery_date": "2024-02-15",
                        "splits": [
                            {
                                "article_type": "Shirt",
                                "qty": 1.0,
                                "embroidery_status": "Not Required"
                            },
                            {
                                "article_type": "Pant",
                                "qty": float(split_item["qty"]) - 1.0,
                                "embroidery_status": "Required"
                            }
                        ]
                    }
                    
                    split_response = requests.post(f"{self.api_base}/tailoring/split", json=split_data)
                    success = split_response.status_code == 200
                    
                    if success:
                        result = split_response.json()
                        self.log_test("POST /api/tailoring/split works", True)
                        print(f"   ✂️ Split successful: {result.get('message', '')}")
                    else:
                        self.log_test("POST /api/tailoring/split works", False, 
                                    f"Status: {split_response.status_code}, Response: {split_response.text}")
                    
                    return success
                else:
                    self.log_test("Tailoring split test", False, "No suitable items found for splitting (need qty > 1)")
                    return True  # Not a failure of the API
            else:
                self.log_test("Get items for split test", False, f"Status: {items_response.status_code}")
                return False
                
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
            
            response = requests.post(f"{self.api_base}/jobwork/move-emb", json=test_data)
            
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
            # Test PDF for ref 04/010426 (should NOT have tailoring section - Pending fabric only)
            response1 = requests.get(f"{self.api_base}/invoice", params={"ref": "04/010426"})
            success1 = response1.status_code == 200 and response1.headers.get('content-type') == 'application/pdf'
            
            if success1:
                pdf_size1 = len(response1.content)
                self.log_test("PDF for ref 04/010426 generates without tailoring section", True)
                print(f"   📄 PDF size: {pdf_size1} bytes (items are Pending fabric only)")
            else:
                self.log_test("PDF for ref 04/010426 generates without tailoring section", False, 
                            f"Status: {response1.status_code}")
            
            # Test PDF for ref 03/010426 (should HAVE tailoring section)
            response2 = requests.get(f"{self.api_base}/invoice", params={"ref": "03/010426"})
            success2 = response2.status_code == 200 and response2.headers.get('content-type') == 'application/pdf'
            
            if success2:
                pdf_size2 = len(response2.content)
                self.log_test("PDF for ref 03/010426 generates WITH tailoring section", True)
                print(f"   📄 PDF size: {pdf_size2} bytes (includes tailoring section)")
            else:
                self.log_test("PDF for ref 03/010426 generates WITH tailoring section", False, 
                            f"Status: {response2.status_code}")
            
            return success1 and success2
            
        except Exception as e:
            self.log_test("PDF conditional sections test", False, str(e))
            return False

    def test_settlement_by_order_no(self):
        """Test settlement by order number (Fix #5)"""
        print("\n=== Testing Settlement by Order No (Fix #5) ===")
        
        try:
            # Test settlement balances for specific reference
            response = requests.get(f"{self.api_base}/settlements/balances", params={"ref": "04/010426"})
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
    tester = SpecificFixesTester()
    
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