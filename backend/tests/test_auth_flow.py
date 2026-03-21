import pytest
import requests
import uuid
import os

# Test authentication flows: health check, registration, login, /me endpoint

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL')
if not BASE_URL:
    pytest.skip("EXPO_PUBLIC_BACKEND_URL not set", allow_module_level=True)
BASE_URL = BASE_URL.rstrip('/')

class TestHealthCheck:
    """Health check endpoints"""

    def test_root_endpoint(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/")
        assert response.status_code == 200
        data = response.json()
        assert "message" in data
        assert "Гильдия" in data["message"]

    def test_health_endpoint(self, api_client):
        response = api_client.get(f"{BASE_URL}/api/health")
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == "ok"


class TestRegistration:
    """User registration tests"""

    def test_register_success_and_verify(self, api_client):
        """Test successful registration and verify user data persists"""
        test_username = f"test_user_{uuid.uuid4().hex[:8]}"
        test_email = f"{test_username}@example.com"
        test_password = "quest123"

        # Register
        response = api_client.post(f"{BASE_URL}/api/register", json={
            "username": test_username,
            "email": test_email,
            "password": test_password
        })
        assert response.status_code == 200, f"Registration failed: {response.text}"

        data = response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["username"] == test_username.lower()
        assert data["user"]["email"] == test_email.lower()
        assert data["user"]["status_name"] == "Новичок"
        assert data["user"]["status_emoji"] == "🌱"
        assert data["user"]["balance"] == 0.0
        assert data["user"]["cashback_rate"] == 5.0

        # Verify by logging in
        login_response = api_client.post(f"{BASE_URL}/api/login", json={
            "login": test_username,
            "password": test_password
        })
        assert login_response.status_code == 200
        login_data = login_response.json()
        assert login_data["user"]["username"] == test_username.lower()

    def test_register_username_too_short(self, api_client):
        """Test username validation: minimum 3 characters"""
        response = api_client.post(f"{BASE_URL}/api/register", json={
            "username": "ab",
            "email": "test@example.com",
            "password": "quest123"
        })
        assert response.status_code in [400, 422]
        data = response.json()
        assert "минимум 3 символа" in data["detail"].lower()

    def test_register_username_invalid_chars(self, api_client):
        """Test username validation: only latin, digits, underscore"""
        response = api_client.post(f"{BASE_URL}/api/register", json={
            "username": "test-user",
            "email": "test@example.com",
            "password": "quest123"
        })
        assert response.status_code in [400, 422]
        data = response.json()
        assert "латиница" in data["detail"].lower() or "latin" in data["detail"].lower()

    def test_register_password_too_short(self, api_client):
        """Test password validation: minimum 6 characters"""
        response = api_client.post(f"{BASE_URL}/api/register", json={
            "username": "testuser",
            "email": "test@example.com",
            "password": "12345"
        })
        assert response.status_code in [400, 422]
        data = response.json()
        assert "минимум 6" in data["detail"].lower()

    def test_register_duplicate_username(self, api_client):
        """Test unique username constraint"""
        test_username = f"test_dup_{uuid.uuid4().hex[:8]}"
        test_email1 = f"{test_username}_1@example.com"
        test_email2 = f"{test_username}_2@example.com"

        # First registration
        response1 = api_client.post(f"{BASE_URL}/api/register", json={
            "username": test_username,
            "email": test_email1,
            "password": "quest123"
        })
        assert response1.status_code == 200

        # Second registration with same username
        response2 = api_client.post(f"{BASE_URL}/api/register", json={
            "username": test_username,
            "email": test_email2,
            "password": "quest123"
        })
        assert response2.status_code == 400
        data = response2.json()
        assert "никнейм" in data["detail"].lower() or "занят" in data["detail"].lower()

    def test_register_duplicate_email(self, api_client):
        """Test unique email constraint"""
        test_email = f"test_dup_{uuid.uuid4().hex[:8]}@example.com"
        test_username1 = f"user1_{uuid.uuid4().hex[:8]}"
        test_username2 = f"user2_{uuid.uuid4().hex[:8]}"

        # First registration
        response1 = api_client.post(f"{BASE_URL}/api/register", json={
            "username": test_username1,
            "email": test_email,
            "password": "quest123"
        })
        assert response1.status_code == 200

        # Second registration with same email
        response2 = api_client.post(f"{BASE_URL}/api/register", json={
            "username": test_username2,
            "email": test_email,
            "password": "quest123"
        })
        assert response2.status_code == 400
        data = response2.json()
        assert "email" in data["detail"].lower()


class TestLogin:
    """User login tests"""

    def test_login_with_username(self, api_client):
        """Test login with username"""
        # Create test user first
        test_username = f"test_login_{uuid.uuid4().hex[:8]}"
        test_email = f"{test_username}@example.com"
        test_password = "quest123"

        reg_response = api_client.post(f"{BASE_URL}/api/register", json={
            "username": test_username,
            "email": test_email,
            "password": test_password
        })
        assert reg_response.status_code == 200

        # Login with username
        login_response = api_client.post(f"{BASE_URL}/api/login", json={
            "login": test_username,
            "password": test_password
        })
        assert login_response.status_code == 200
        data = login_response.json()
        assert "token" in data
        assert "user" in data
        assert data["user"]["username"] == test_username.lower()

    def test_login_with_email(self, api_client):
        """Test login with email"""
        # Create test user first
        test_username = f"test_email_{uuid.uuid4().hex[:8]}"
        test_email = f"{test_username}@example.com"
        test_password = "quest123"

        reg_response = api_client.post(f"{BASE_URL}/api/register", json={
            "username": test_username,
            "email": test_email,
            "password": test_password
        })
        assert reg_response.status_code == 200

        # Login with email
        login_response = api_client.post(f"{BASE_URL}/api/login", json={
            "login": test_email,
            "password": test_password
        })
        assert login_response.status_code == 200
        data = login_response.json()
        assert "token" in data
        assert data["user"]["email"] == test_email.lower()

    def test_login_wrong_password(self, api_client):
        """Test login with wrong password"""
        # Create test user first
        test_username = f"test_wrong_{uuid.uuid4().hex[:8]}"
        test_email = f"{test_username}@example.com"

        reg_response = api_client.post(f"{BASE_URL}/api/register", json={
            "username": test_username,
            "email": test_email,
            "password": "quest123"
        })
        assert reg_response.status_code == 200

        # Login with wrong password
        login_response = api_client.post(f"{BASE_URL}/api/login", json={
            "login": test_username,
            "password": "wrongpass"
        })
        assert login_response.status_code == 401
        data = login_response.json()
        assert "логин" in data["detail"].lower() or "пароль" in data["detail"].lower()

    def test_login_nonexistent_user(self, api_client):
        """Test login with non-existent user"""
        login_response = api_client.post(f"{BASE_URL}/api/login", json={
            "login": "nonexistent_user_12345",
            "password": "quest123"
        })
        assert login_response.status_code == 401


class TestAuthenticatedEndpoints:
    """Tests for endpoints requiring authentication"""

    def test_get_me_success(self, api_client):
        """Test GET /api/me with valid token"""
        # Create test user and get token
        test_username = f"test_me_{uuid.uuid4().hex[:8]}"
        test_email = f"{test_username}@example.com"
        test_password = "quest123"

        reg_response = api_client.post(f"{BASE_URL}/api/register", json={
            "username": test_username,
            "email": test_email,
            "password": test_password
        })
        assert reg_response.status_code == 200
        token = reg_response.json()["token"]

        # Get user profile
        me_response = api_client.get(f"{BASE_URL}/api/me", headers={
            "Authorization": f"Bearer {token}"
        })
        assert me_response.status_code == 200
        data = me_response.json()
        assert data["username"] == test_username.lower()
        assert data["email"] == test_email.lower()
        assert "id" in data
        assert "balance" in data
        assert "prepaid_hours" in data
        assert "status_name" in data
        assert "cashback_rate" in data

    def test_get_me_no_token(self, api_client):
        """Test GET /api/me without token"""
        me_response = api_client.get(f"{BASE_URL}/api/me")
        assert me_response.status_code == 401

    def test_get_me_invalid_token(self, api_client):
        """Test GET /api/me with invalid token"""
        me_response = api_client.get(f"{BASE_URL}/api/me", headers={
            "Authorization": "Bearer invalid_token_12345"
        })
        assert me_response.status_code == 401
