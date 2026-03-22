#!/usr/bin/env python3
"""
Backend API Testing for Гильдия (Guild) Mobile App
Tests the proxy endpoints that forward to guildkhv.com
"""

import requests
import json
import time
import io
import os
from typing import Optional

# Configuration
BACKEND_URL = "https://guild-khv-mobile.preview.emergentagent.com"
API_BASE = f"{BACKEND_URL}/api"

# Test credentials (from review request)
TEST_LOGIN = "admin1"
TEST_PASSWORD = "Qwerty1@1"
TEST_BOOKING_ID = 11  # Booking ID with active chat

class GuildAPITester:
    def __init__(self):
        self.token: Optional[str] = None
        self.session = requests.Session()
        self.session.timeout = 30
        
    def log(self, message: str, level: str = "INFO"):
        """Log test messages"""
        print(f"[{level}] {message}")
        
    def test_login_proxy(self) -> bool:
        """Test POST /api/proxy/login endpoint"""
        self.log("Testing login proxy endpoint...")
        
        try:
            response = self.session.post(
                f"{API_BASE}/proxy/login",
                json={
                    "login": TEST_LOGIN,
                    "password": TEST_PASSWORD
                },
                headers={"Content-Type": "application/json"}
            )
            
            self.log(f"Login response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                if "token" in data and "user" in data:
                    self.token = data["token"]
                    self.log(f"✅ Login successful, token received: {self.token[:20]}...")
                    self.log(f"User data: {data['user'].get('username', 'N/A')}")
                    return True
                else:
                    self.log("❌ Login response missing token or user data", "ERROR")
                    self.log(f"Response: {data}")
                    return False
            else:
                self.log(f"❌ Login failed with status {response.status_code}", "ERROR")
                self.log(f"Response: {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Login request failed: {str(e)}", "ERROR")
            return False
    
    def test_messages_endpoint(self) -> bool:
        """Test GET /api/proxy/bookings/{id}/messages to verify file_url fields"""
        self.log("Testing messages endpoint...")
        
        if not self.token:
            self.log("❌ No token available for messages test", "ERROR")
            return False
            
        try:
            response = self.session.get(
                f"{API_BASE}/proxy/bookings/{TEST_BOOKING_ID}/messages",
                headers={"Authorization": f"Bearer {self.token}"}
            )
            
            self.log(f"Messages response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                messages = data.get("messages", [])
                self.log(f"✅ Messages endpoint working, found {len(messages)} messages")
                
                # Check for file_url fields in messages
                file_messages = [msg for msg in messages if msg.get("file_url")]
                voice_messages = [msg for msg in messages if msg.get("file_type") == "voice"]
                image_messages = [msg for msg in messages if msg.get("file_type") == "image"]
                
                self.log(f"Messages with file_url: {len(file_messages)}")
                self.log(f"Voice messages: {len(voice_messages)}")
                self.log(f"Image messages: {len(image_messages)}")
                
                return True
            else:
                self.log(f"❌ Messages endpoint failed with status {response.status_code}", "ERROR")
                self.log(f"Response: {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Messages request failed: {str(e)}", "ERROR")
            return False
    
    def test_voice_upload_proxy(self) -> bool:
        """Test POST /api/proxy/bookings/{id}/voice endpoint"""
        self.log("Testing voice upload proxy endpoint...")
        
        if not self.token:
            self.log("❌ No token available for voice upload test", "ERROR")
            return False
            
        try:
            # Create a small test audio file (webm format)
            test_audio_data = b"webm_test_audio_data_placeholder"
            audio_file = io.BytesIO(test_audio_data)
            
            response = self.session.post(
                f"{API_BASE}/proxy/bookings/{TEST_BOOKING_ID}/voice",
                headers={"Authorization": f"Bearer {self.token}"},
                files={"audio": ("test_voice.webm", audio_file, "audio/webm")}
            )
            
            self.log(f"Voice upload response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("ok"):
                    self.log("✅ Voice upload successful")
                    return True
                else:
                    self.log(f"❌ Voice upload failed: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ Voice upload failed with status {response.status_code}", "ERROR")
                self.log(f"Response: {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ Voice upload request failed: {str(e)}", "ERROR")
            return False
    
    def test_file_upload_proxy(self) -> bool:
        """Test POST /api/proxy/bookings/{id}/upload endpoint"""
        self.log("Testing file upload proxy endpoint...")
        
        if not self.token:
            self.log("❌ No token available for file upload test", "ERROR")
            return False
            
        try:
            # Create a small test image file (PNG format)
            test_image_data = b"PNG_test_image_data_placeholder"
            image_file = io.BytesIO(test_image_data)
            
            response = self.session.post(
                f"{API_BASE}/proxy/bookings/{TEST_BOOKING_ID}/upload",
                headers={"Authorization": f"Bearer {self.token}"},
                files={"file": ("test_image.png", image_file, "image/png")},
                data={"text": "Test image upload from backend test"}
            )
            
            self.log(f"File upload response status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                if data.get("ok"):
                    self.log("✅ File upload successful")
                    return True
                else:
                    self.log(f"❌ File upload failed: {data}", "ERROR")
                    return False
            else:
                self.log(f"❌ File upload failed with status {response.status_code}", "ERROR")
                self.log(f"Response: {response.text}")
                return False
                
        except Exception as e:
            self.log(f"❌ File upload request failed: {str(e)}", "ERROR")
            return False
    
    def test_auth_validation(self) -> bool:
        """Test that endpoints require valid authorization"""
        self.log("Testing auth validation (no token should get 401)...")
        
        try:
            # Test voice upload without token
            test_audio_data = b"webm_test_audio_data_placeholder"
            audio_file = io.BytesIO(test_audio_data)
            
            response = self.session.post(
                f"{API_BASE}/proxy/bookings/{TEST_BOOKING_ID}/voice",
                files={"audio": ("test_voice.webm", audio_file, "audio/webm")}
            )
            
            self.log(f"Voice upload without token status: {response.status_code}")
            
            if response.status_code == 401:
                self.log("✅ Auth validation working - 401 returned for missing token")
                return True
            else:
                self.log(f"❌ Auth validation failed - expected 401, got {response.status_code}", "ERROR")
                return False
                
        except Exception as e:
            self.log(f"❌ Auth validation test failed: {str(e)}", "ERROR")
            return False
    
    def run_all_tests(self) -> dict:
        """Run all backend tests and return results"""
        self.log("=" * 60)
        self.log("Starting Гильдия Backend API Tests")
        self.log("=" * 60)
        
        results = {}
        
        # Test 1: Login proxy
        self.log("\n1. Testing Login Proxy...")
        results["login_proxy"] = self.test_login_proxy()
        
        # Small delay to respect rate limiting
        time.sleep(2)
        
        # Test 2: Messages endpoint (to check file_url fields)
        self.log("\n2. Testing Messages Endpoint...")
        results["messages_endpoint"] = self.test_messages_endpoint()
        
        time.sleep(2)
        
        # Test 3: Voice upload proxy
        self.log("\n3. Testing Voice Upload Proxy...")
        results["voice_upload"] = self.test_voice_upload_proxy()
        
        time.sleep(2)
        
        # Test 4: File upload proxy
        self.log("\n4. Testing File Upload Proxy...")
        results["file_upload"] = self.test_file_upload_proxy()
        
        time.sleep(2)
        
        # Test 5: Auth validation
        self.log("\n5. Testing Auth Validation...")
        results["auth_validation"] = self.test_auth_validation()
        
        # Summary
        self.log("\n" + "=" * 60)
        self.log("TEST RESULTS SUMMARY")
        self.log("=" * 60)
        
        passed = sum(1 for result in results.values() if result)
        total = len(results)
        
        for test_name, result in results.items():
            status = "✅ PASS" if result else "❌ FAIL"
            self.log(f"{test_name.replace('_', ' ').title()}: {status}")
        
        self.log(f"\nOverall: {passed}/{total} tests passed")
        
        if passed == total:
            self.log("🎉 All backend proxy tests PASSED!")
        else:
            self.log("⚠️  Some backend tests FAILED - check logs above")
        
        return results

def main():
    """Main test runner"""
    tester = GuildAPITester()
    results = tester.run_all_tests()
    
    # Exit with error code if any tests failed
    if not all(results.values()):
        exit(1)
    else:
        exit(0)

if __name__ == "__main__":
    main()