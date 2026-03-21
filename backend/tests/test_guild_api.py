import pytest
import requests
import uuid
import os

# Test Guild API endpoints: games, bookings, wallet, leaderboard, masters

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL')
if not BASE_URL:
    pytest.skip("EXPO_PUBLIC_BACKEND_URL not set", allow_module_level=True)
BASE_URL = BASE_URL.rstrip('/')


@pytest.fixture
def auth_user(api_client):
    """Create a test user and return token"""
    test_username = f"test_guild_{uuid.uuid4().hex[:8]}"
    test_email = f"{test_username}@example.com"
    test_password = "quest123"
    
    response = api_client.post(f"{BASE_URL}/api/register", json={
        "username": test_username,
        "email": test_email,
        "password": test_password
    })
    assert response.status_code == 200
    data = response.json()
    return {
        "token": data["token"],
        "user": data["user"],
        "username": test_username,
        "password": test_password
    }


class TestGamesAPI:
    """Test games catalog endpoints"""

    def test_get_games_list(self, api_client):
        """Test GET /api/games returns seeded games"""
        response = api_client.get(f"{BASE_URL}/api/games")
        assert response.status_code == 200
        
        games = response.json()
        assert isinstance(games, list)
        assert len(games) >= 4, "Should have at least 4 seeded games"
        
        # Verify game structure
        game = games[0]
        assert "id" in game
        assert "title" in game
        assert "description" in game
        assert "date_time" in game
        assert "game_master" in game
        assert "location" in game
        assert "max_players" in game
        assert "booked_count" in game
        assert "spots_left" in game
        assert "duration_text" in game
        assert "hourly_rate" in game

    def test_get_game_detail_unauthenticated(self, api_client):
        """Test GET /api/games/{id} without auth"""
        # Get first game
        games_response = api_client.get(f"{BASE_URL}/api/games")
        games = games_response.json()
        game_id = games[0]["id"]
        
        # Get game detail
        response = api_client.get(f"{BASE_URL}/api/games/{game_id}")
        assert response.status_code == 200
        
        game = response.json()
        assert game["id"] == game_id
        assert "title" in game
        assert "description" in game
        assert "participants" in game
        assert isinstance(game["participants"], list)
        assert "is_booked" in game
        assert game["is_booked"] == False  # Not authenticated
        assert "ratings" in game
        assert "avg_rating" in game

    def test_get_game_detail_authenticated(self, api_client, auth_user):
        """Test GET /api/games/{id} with auth shows booking status"""
        # Get first game
        games_response = api_client.get(f"{BASE_URL}/api/games")
        games = games_response.json()
        game_id = games[0]["id"]
        
        # Get game detail with auth
        response = api_client.get(
            f"{BASE_URL}/api/games/{game_id}",
            headers={"Authorization": f"Bearer {auth_user['token']}"}
        )
        assert response.status_code == 200
        
        game = response.json()
        assert "is_booked" in game
        assert isinstance(game["is_booked"], bool)

    def test_get_nonexistent_game(self, api_client):
        """Test GET /api/games/{id} with invalid ID"""
        response = api_client.get(f"{BASE_URL}/api/games/nonexistent-id-12345")
        assert response.status_code == 404


class TestBookingsAPI:
    """Test game booking endpoints"""

    def test_book_game_success(self, api_client, auth_user):
        """Test POST /api/games/{id}/book creates booking"""
        # Get first game
        games_response = api_client.get(f"{BASE_URL}/api/games")
        games = games_response.json()
        game_id = games[0]["id"]
        
        # Book the game
        response = api_client.post(
            f"{BASE_URL}/api/games/{game_id}/book",
            json={},
            headers={"Authorization": f"Bearer {auth_user['token']}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "message" in data
        assert "booking_id" in data
        
        # Verify booking persisted - check game detail
        game_detail = api_client.get(
            f"{BASE_URL}/api/games/{game_id}",
            headers={"Authorization": f"Bearer {auth_user['token']}"}
        )
        assert game_detail.status_code == 200
        game = game_detail.json()
        assert game["is_booked"] == True

    def test_book_game_duplicate(self, api_client, auth_user):
        """Test booking same game twice fails"""
        # Get first game
        games_response = api_client.get(f"{BASE_URL}/api/games")
        games = games_response.json()
        game_id = games[0]["id"]
        
        # First booking
        response1 = api_client.post(
            f"{BASE_URL}/api/games/{game_id}/book",
            json={},
            headers={"Authorization": f"Bearer {auth_user['token']}"}
        )
        assert response1.status_code == 200
        
        # Second booking should fail
        response2 = api_client.post(
            f"{BASE_URL}/api/games/{game_id}/book",
            json={},
            headers={"Authorization": f"Bearer {auth_user['token']}"}
        )
        assert response2.status_code == 400
        data = response2.json()
        assert "записаны" in data["detail"].lower()

    def test_book_game_no_auth(self, api_client):
        """Test booking without authentication fails"""
        games_response = api_client.get(f"{BASE_URL}/api/games")
        games = games_response.json()
        game_id = games[0]["id"]
        
        response = api_client.post(f"{BASE_URL}/api/games/{game_id}/book", json={})
        assert response.status_code == 401

    def test_cancel_booking_success(self, api_client, auth_user):
        """Test DELETE /api/games/{id}/book cancels booking"""
        # Get first game
        games_response = api_client.get(f"{BASE_URL}/api/games")
        games = games_response.json()
        game_id = games[0]["id"]
        
        # Book the game
        book_response = api_client.post(
            f"{BASE_URL}/api/games/{game_id}/book",
            json={},
            headers={"Authorization": f"Bearer {auth_user['token']}"}
        )
        assert book_response.status_code == 200
        
        # Cancel booking
        cancel_response = api_client.delete(
            f"{BASE_URL}/api/games/{game_id}/book",
            headers={"Authorization": f"Bearer {auth_user['token']}"}
        )
        assert cancel_response.status_code == 200
        
        data = cancel_response.json()
        assert "message" in data
        
        # Verify cancellation - check game detail
        game_detail = api_client.get(
            f"{BASE_URL}/api/games/{game_id}",
            headers={"Authorization": f"Bearer {auth_user['token']}"}
        )
        game = game_detail.json()
        assert game["is_booked"] == False

    def test_cancel_nonexistent_booking(self, api_client, auth_user):
        """Test canceling booking that doesn't exist"""
        games_response = api_client.get(f"{BASE_URL}/api/games")
        games = games_response.json()
        game_id = games[0]["id"]
        
        # Try to cancel without booking
        response = api_client.delete(
            f"{BASE_URL}/api/games/{game_id}/book",
            headers={"Authorization": f"Bearer {auth_user['token']}"}
        )
        assert response.status_code == 404

    def test_get_user_bookings(self, api_client, auth_user):
        """Test GET /api/bookings returns user's bookings"""
        # Book a game first
        games_response = api_client.get(f"{BASE_URL}/api/games")
        games = games_response.json()
        game_id = games[0]["id"]
        
        api_client.post(
            f"{BASE_URL}/api/games/{game_id}/book",
            json={},
            headers={"Authorization": f"Bearer {auth_user['token']}"}
        )
        
        # Get bookings
        response = api_client.get(
            f"{BASE_URL}/api/bookings",
            headers={"Authorization": f"Bearer {auth_user['token']}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "active" in data
        assert "past" in data
        assert isinstance(data["active"], list)
        assert isinstance(data["past"], list)
        assert len(data["active"]) >= 1
        
        # Verify booking structure
        booking = data["active"][0]
        assert "id" in booking
        assert "game_id" in booking
        assert "status" in booking
        assert "game" in booking
        assert booking["game"]["title"]

    def test_get_bookings_no_auth(self, api_client):
        """Test GET /api/bookings without auth fails"""
        response = api_client.get(f"{BASE_URL}/api/bookings")
        assert response.status_code == 401


class TestWalletAPI:
    """Test wallet and cashback endpoints"""

    def test_get_wallet(self, api_client, auth_user):
        """Test GET /api/wallet returns balance and stats"""
        response = api_client.get(
            f"{BASE_URL}/api/wallet",
            headers={"Authorization": f"Bearer {auth_user['token']}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "balance" in data
        assert "prepaid_hours" in data
        assert "status_name" in data
        assert "status_emoji" in data
        assert "cashback_rate" in data
        assert "total_received" in data
        assert "total_spent" in data
        assert "transactions" in data
        assert isinstance(data["transactions"], list)
        assert "total" in data
        assert "page" in data
        assert "pages" in data

    def test_get_wallet_with_filters(self, api_client, auth_user):
        """Test GET /api/wallet with type filters"""
        # Test income filter
        response = api_client.get(
            f"{BASE_URL}/api/wallet?type=income",
            headers={"Authorization": f"Bearer {auth_user['token']}"}
        )
        assert response.status_code == 200
        
        # Test expense filter
        response = api_client.get(
            f"{BASE_URL}/api/wallet?type=expense",
            headers={"Authorization": f"Bearer {auth_user['token']}"}
        )
        assert response.status_code == 200
        
        # Test achievement filter
        response = api_client.get(
            f"{BASE_URL}/api/wallet?type=achievement",
            headers={"Authorization": f"Bearer {auth_user['token']}"}
        )
        assert response.status_code == 200

    def test_get_wallet_no_auth(self, api_client):
        """Test GET /api/wallet without auth fails"""
        response = api_client.get(f"{BASE_URL}/api/wallet")
        assert response.status_code == 401


class TestLeaderboardAPI:
    """Test leaderboard endpoints"""

    def test_get_leaderboard_sessions(self, api_client):
        """Test GET /api/leaderboard?sort_by=sessions"""
        response = api_client.get(f"{BASE_URL}/api/leaderboard?sort_by=sessions")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 4, "Should have at least 4 seeded users"
        
        # Verify structure
        user = data[0]
        assert "rank" in user
        assert "id" in user
        assert "username" in user
        assert "status_name" in user
        assert "status_emoji" in user
        assert "sessions_count" in user
        assert "balance" in user
        assert "achievement_count" in user
        
        # Verify sorting by sessions
        if len(data) > 1:
            assert data[0]["sessions_count"] >= data[1]["sessions_count"]

    def test_get_leaderboard_gold(self, api_client):
        """Test GET /api/leaderboard?sort_by=gold"""
        response = api_client.get(f"{BASE_URL}/api/leaderboard?sort_by=gold")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Verify sorting by balance
        if len(data) > 1:
            assert data[0]["balance"] >= data[1]["balance"]

    def test_get_leaderboard_achievements(self, api_client):
        """Test GET /api/leaderboard?sort_by=achievements"""
        response = api_client.get(f"{BASE_URL}/api/leaderboard?sort_by=achievements")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        
        # Verify sorting by achievements
        if len(data) > 1:
            assert data[0]["achievement_count"] >= data[1]["achievement_count"]


class TestMastersAPI:
    """Test game masters endpoints"""

    def test_get_masters_list(self, api_client):
        """Test GET /api/masters returns list of masters"""
        response = api_client.get(f"{BASE_URL}/api/masters")
        assert response.status_code == 200
        
        data = response.json()
        assert isinstance(data, list)
        assert len(data) >= 3, "Should have at least 3 seeded masters"
        
        # Verify master structure
        master = data[0]
        assert "id" in master
        assert "username" in master
        assert "full_name" in master
        assert "bio" in master
        assert "style" in master
        assert "experience_years" in master
        assert "systems" in master
        assert isinstance(master["systems"], list)
        assert "is_active" in master
        assert "avg_rating" in master
        assert "ratings_count" in master
        assert "sessions_count" in master
        assert "total_sessions" in master
