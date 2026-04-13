#!/usr/bin/env python3
"""
Backend API Testing for VBA Retail Management System
Tests all API endpoints for the fabric/tailoring business management system
"""

import requests
import sys
import json
from datetime import datetime, date
from typing import Dict, Any, List

class RetailAPITester:
    def __init__(self, base_url: str = "https://vba-converter.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_base = f"{base_url}/api"
        self.tests_run = 0
        self.tests_passed = 0
        self.failed_tests = []
        self.session = requests.Session()
        self.session.headers.update({'Content-Type': 'application/json'})

    def log_test(self, name: str, success: bool, details: str = ""):
        """Log test result"""
        self.tests_run += 1
        if success:
            self.tests_passed += 1
            print(f"✅ {name}")
        else:
            self.failed_tests.append({"name": name, "details": details})
            print(f"❌ {name} - {details}")

    def test_api_endpoint(self, method: str, endpoint: str, expected_status: int = 200, 
                         data: Dict[Any, Any] = None, params: Dict[str, Any] = None) -> tuple:
        """Test a single API endpoint"""
        url = f"{self.api_base}/{endpoint.lstrip('/')}"
        
        try:
            if method.upper() == 'GET':
                response = self.session.get(url, params=params)
            elif method.upper() == 'POST':
                response = self.session.post(url, json=data, params=params)
            elif method.upper() == 'PUT':
                response = self.session.put(url, json=data, params=params)
            elif method.upper() == 'DELETE':
                response = self.session.delete(url, params=params)
            else:
                return False, f"Unsupported method: {method}"

            success = response.status_code == expected_status
            if success:
                try:
                    return True, response.json()
                except:
                    return True, response.text
            else:
                return False, f"Status {response.status_code}, expected {expected_status}. Response: {response.text[:200]}"
                
        except Exception as e:
            return False, f"Request failed: {str(e)}"

    def test_health_check(self):
        """Test basic API health"""
        success, result = self.test_api_endpoint('GET', '/')
        self.log_test("API Health Check", success, str(result) if not success else "")
        return success

    def test_seed_data(self):
        """Test data seeding"""
        success, result = self.test_api_endpoint('POST', '/seed')
        self.log_test("Seed Data", success, str(result) if not success else "")
        if success and isinstance(result, dict):
            print(f"   📊 Items: {result.get('items_count', 'N/A')}, Advances: {result.get('advances_count', 'N/A')}")
        return success

    def test_dashboard(self):
        """Test dashboard endpoint"""
        success, result = self.test_api_endpoint('GET', '/dashboard')
        self.log_test("Dashboard API", success, str(result) if not success else "")
        
        if success and isinstance(result, dict):
            required_fields = ['total_items', 'total_advances', 'fabric_pending_amount', 
                             'tailoring_pending_amount', 'unique_customers', 'total_revenue']
            missing_fields = [f for f in required_fields if f not in result]
            if missing_fields:
                self.log_test("Dashboard Data Structure", False, f"Missing fields: {missing_fields}")
            else:
                self.log_test("Dashboard Data Structure", True)
                print(f"   📊 Items: {result['total_items']}, Customers: {result['unique_customers']}, Revenue: ₹{result['total_revenue']}")
        
        return success

    def test_customers(self):
        """Test customers endpoint"""
        success, result = self.test_api_endpoint('GET', '/customers')
        self.log_test("Customers API", success, str(result) if not success else "")
        
        if success and isinstance(result, list):
            print(f"   👥 Found {len(result)} customers")
            return len(result) > 0
        return success

    def test_items(self):
        """Test items endpoint"""
        success, result = self.test_api_endpoint('GET', '/items')
        self.log_test("Items API", success, str(result) if not success else "")
        
        if success and isinstance(result, dict) and 'items' in result:
            items = result['items']
            total = result.get('total', 0)
            print(f"   📦 Found {len(items)} items (total: {total})")
            
            # Test with filters
            success2, result2 = self.test_api_endpoint('GET', '/items', params={'limit': 5})
            self.log_test("Items API with Limit", success2, str(result2) if not success2 else "")
            
            return len(items) > 0
        return success

    def test_tailoring_awaiting(self):
        """Test tailoring awaiting orders"""
        success, result = self.test_api_endpoint('GET', '/tailoring/awaiting')
        self.log_test("Tailoring Awaiting Orders", success, str(result) if not success else "")
        
        if success and isinstance(result, list):
            print(f"   ✂️ Found {len(result)} awaiting orders")
        return success

    def test_jobwork_endpoints(self):
        """Test job work endpoints"""
        # Test tailoring tab
        success1, result1 = self.test_api_endpoint('GET', '/jobwork', params={'tab': 'tailoring'})
        self.log_test("JobWork Tailoring Tab", success1, str(result1) if not success1 else "")
        
        if success1 and isinstance(result1, dict):
            pending = len(result1.get('pending', []))
            stitched = len(result1.get('stitched', []))
            delivered = len(result1.get('delivered', []))
            print(f"   ✂️ Tailoring - Pending: {pending}, Stitched: {stitched}, Delivered: {delivered}")
        
        # Test embroidery tab
        success2, result2 = self.test_api_endpoint('GET', '/jobwork', params={'tab': 'embroidery'})
        self.log_test("JobWork Embroidery Tab", success2, str(result2) if not success2 else "")
        
        if success2 and isinstance(result2, dict):
            required = len(result2.get('required', []))
            in_progress = len(result2.get('in_progress', []))
            finished = len(result2.get('finished', []))
            print(f"   🎨 Embroidery - Required: {required}, In Progress: {in_progress}, Finished: {finished}")
        
        # Test filters
        success3, result3 = self.test_api_endpoint('GET', '/jobwork/filters')
        self.log_test("JobWork Filters", success3, str(result3) if not success3 else "")
        
        return success1 and success2 and success3

    def test_daybook(self):
        """Test daybook endpoints"""
        success1, result1 = self.test_api_endpoint('GET', '/daybook')
        self.log_test("Daybook API", success1, str(result1) if not success1 else "")
        
        if success1 and isinstance(result1, dict):
            pending = len(result1.get('pending', []))
            reconciled = len(result1.get('reconciled', []))
            print(f"   📚 Daybook - Pending: {pending}, Reconciled: {reconciled}")
        
        # Test dates endpoint
        success2, result2 = self.test_api_endpoint('GET', '/daybook/dates')
        self.log_test("Daybook Dates", success2, str(result2) if not success2 else "")
        
        if success2 and isinstance(result2, list):
            print(f"   📅 Found {len(result2)} unique dates")
        
        return success1 and success2

    def test_labour(self):
        """Test labour endpoints"""
        success1, result1 = self.test_api_endpoint('GET', '/labour')
        self.log_test("Labour Items", success1, str(result1) if not success1 else "")
        
        if success1 and isinstance(result1, list):
            print(f"   👷 Found {len(result1)} labour items")
        
        # Test karigars
        success2, result2 = self.test_api_endpoint('GET', '/labour/karigars')
        self.log_test("Labour Karigars", success2, str(result2) if not success2 else "")
        
        if success2 and isinstance(result2, list):
            print(f"   👨‍🎨 Found {len(result2)} karigars")
        
        return success1 and success2

    def test_settlements(self):
        """Test settlements endpoints"""
        # Test balances (should work with empty params)
        success1, result1 = self.test_api_endpoint('GET', '/settlements/balances')
        self.log_test("Settlement Balances (empty)", success1, str(result1) if not success1 else "")
        
        return success1

    def test_advances(self):
        """Test advances endpoint"""
        success, result = self.test_api_endpoint('GET', '/advances')
        self.log_test("Advances API", success, str(result) if not success else "")
        
        if success and isinstance(result, list):
            print(f"   💰 Found {len(result)} advances")
        
        return success

    def test_orders(self):
        """Test orders endpoint"""
        success, result = self.test_api_endpoint('GET', '/orders')
        self.log_test("Orders API", success, str(result) if not success else "")
        
        if success and isinstance(result, list):
            print(f"   📋 Found {len(result)} orders")
        
        return success

    def test_create_bill_flow(self):
        """Test creating a new bill"""
        bill_data = {
            "customer_name": "Test Customer API",
            "date": date.today().isoformat(),
            "payment_date": date.today().isoformat(),
            "items": [
                {
                    "barcode": "TEST001",
                    "qty": 2.5,
                    "price": 1000,
                    "discount": 5
                }
            ],
            "payment_modes": ["Cash"],
            "amount_paid": 2375,
            "is_settled": True,
            "needs_tailoring": False
        }
        
        success, result = self.test_api_endpoint('POST', '/bills', data=bill_data)
        self.log_test("Create Bill", success, str(result) if not success else "")
        
        if success and isinstance(result, dict):
            print(f"   🧾 Bill created - Ref: {result.get('ref')}, Total: ₹{result.get('grand_total')}")
        
        return success

    def run_all_tests(self):
        """Run all API tests"""
        print("🚀 Starting VBA Retail Management API Tests")
        print(f"🌐 Testing against: {self.base_url}")
        print("=" * 60)
        
        # Core API tests
        self.test_health_check()
        self.test_seed_data()
        
        # Data retrieval tests
        self.test_dashboard()
        self.test_customers()
        self.test_items()
        self.test_tailoring_awaiting()
        self.test_jobwork_endpoints()
        self.test_daybook()
        self.test_labour()
        self.test_settlements()
        self.test_advances()
        self.test_orders()
        
        # Data creation test
        self.test_create_bill_flow()
        
        # Print summary
        print("\n" + "=" * 60)
        print(f"📊 Test Summary: {self.tests_passed}/{self.tests_run} passed")
        
        if self.failed_tests:
            print("\n❌ Failed Tests:")
            for test in self.failed_tests:
                print(f"   • {test['name']}: {test['details']}")
        
        success_rate = (self.tests_passed / self.tests_run * 100) if self.tests_run > 0 else 0
        print(f"✨ Success Rate: {success_rate:.1f}%")
        
        return self.tests_passed == self.tests_run

def main():
    """Main test runner"""
    tester = RetailAPITester()
    
    try:
        success = tester.run_all_tests()
        return 0 if success else 1
    except KeyboardInterrupt:
        print("\n⚠️ Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n💥 Test runner failed: {e}")
        return 1

if __name__ == "__main__":
    sys.exit(main())