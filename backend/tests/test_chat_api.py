import pytest
import requests
import uuid
import os

# Test chat messaging endpoints for bookings

BASE_URL = os.environ.get('EXPO_PUBLIC_BACKEND_URL')
if not BASE_URL:
    pytest.skip("EXPO_PUBLIC_BACKEND_URL not set", allow_module_level=True)
BASE_URL = BASE_URL.rstrip('/')


@pytest.fixture
def auth_user_with_booking(api_client):
    """Create a test user, book a game, and return token + booking_id"""
    test_username = f"test_chat_{uuid.uuid4().hex[:8]}"
    test_email = f"{test_username}@example.com"
    test_password = "quest123"
    
    # Register user
    response = api_client.post(f"{BASE_URL}/api/register", json={
        "username": test_username,
        "email": test_email,
        "password": test_password
    })
    assert response.status_code == 200
    data = response.json()
    token = data["token"]
    
    # Get a game with available spots
    games_response = api_client.get(f"{BASE_URL}/api/games")
    games = games_response.json()
    
    # Find game with spots available
    game_id = None
    for game in games:
        if game.get("spots_left", 0) > 0:
            game_id = game["id"]
            break
    
    if not game_id:
        pytest.skip("No games with available spots")
    
    # Book the game
    book_response = api_client.post(
        f"{BASE_URL}/api/games/{game_id}/book",
        json={},
        headers={"Authorization": f"Bearer {token}"}
    )
    assert book_response.status_code == 200
    booking_id = book_response.json()["booking_id"]
    
    return {
        "token": token,
        "user": data["user"],
        "username": test_username,
        "password": test_password,
        "booking_id": booking_id,
        "game_id": game_id
    }


class TestChatAPI:
    """Test chat messaging endpoints"""

    def test_get_messages_empty(self, api_client, auth_user_with_booking):
        """Test GET /api/bookings/{booking_id}/messages returns empty messages initially"""
        booking_id = auth_user_with_booking["booking_id"]
        token = auth_user_with_booking["token"]
        
        response = api_client.get(
            f"{BASE_URL}/api/bookings/{booking_id}/messages",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "messages" in data
        assert "master_name" in data
        assert "game_title" in data
        assert "booking_status" in data
        assert isinstance(data["messages"], list)
        assert len(data["messages"]) == 0  # No messages initially
        assert data["master_name"]  # Should have master name
        assert data["game_title"]  # Should have game title
        assert data["booking_status"] == "active"

    def test_send_message_success(self, api_client, auth_user_with_booking):
        """Test POST /api/bookings/{booking_id}/messages sends a message"""
        booking_id = auth_user_with_booking["booking_id"]
        token = auth_user_with_booking["token"]
        
        message_text = "Привет! У меня вопрос по игре."
        
        response = api_client.post(
            f"{BASE_URL}/api/bookings/{booking_id}/messages",
            json={"text": message_text},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "id" in data
        assert "message" in data
        assert data["message"] == "Сообщение отправлено"
        
        # Verify message persisted - GET messages
        get_response = api_client.get(
            f"{BASE_URL}/api/bookings/{booking_id}/messages",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert get_response.status_code == 200
        
        messages_data = get_response.json()
        assert len(messages_data["messages"]) == 1
        
        message = messages_data["messages"][0]
        assert message["text"] == message_text
        assert message["sender_type"] == "player"
        assert message["booking_id"] == booking_id
        assert "id" in message
        assert "created_at" in message
        assert "sender_name" in message

    def test_send_empty_message_fails(self, api_client, auth_user_with_booking):
        """Test sending empty message fails"""
        booking_id = auth_user_with_booking["booking_id"]
        token = auth_user_with_booking["token"]
        
        response = api_client.post(
            f"{BASE_URL}/api/bookings/{booking_id}/messages",
            json={"text": "   "},  # Only whitespace
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 400
        data = response.json()
        assert "пустым" in data["detail"].lower()

    def test_send_message_no_auth(self, api_client, auth_user_with_booking):
        """Test sending message without auth fails"""
        booking_id = auth_user_with_booking["booking_id"]
        
        response = api_client.post(
            f"{BASE_URL}/api/bookings/{booking_id}/messages",
            json={"text": "Test message"}
        )
        assert response.status_code == 401

    def test_get_messages_wrong_user(self, api_client, auth_user_with_booking):
        """Test getting messages for another user's booking fails"""
        booking_id = auth_user_with_booking["booking_id"]
        
        # Create another user
        other_username = f"test_other_{uuid.uuid4().hex[:8]}"
        other_response = api_client.post(f"{BASE_URL}/api/register", json={
            "username": other_username,
            "email": f"{other_username}@example.com",
            "password": "quest123"
        })
        other_token = other_response.json()["token"]
        
        # Try to get messages with other user's token
        response = api_client.get(
            f"{BASE_URL}/api/bookings/{booking_id}/messages",
            headers={"Authorization": f"Bearer {other_token}"}
        )
        assert response.status_code == 404

    def test_send_multiple_messages(self, api_client, auth_user_with_booking):
        """Test sending multiple messages and verify order"""
        booking_id = auth_user_with_booking["booking_id"]
        token = auth_user_with_booking["token"]
        
        messages = [
            "Первое сообщение",
            "Второе сообщение",
            "Третье сообщение"
        ]
        
        # Send multiple messages
        for msg in messages:
            response = api_client.post(
                f"{BASE_URL}/api/bookings/{booking_id}/messages",
                json={"text": msg},
                headers={"Authorization": f"Bearer {token}"}
            )
            assert response.status_code == 200
        
        # Get all messages
        get_response = api_client.get(
            f"{BASE_URL}/api/bookings/{booking_id}/messages",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert get_response.status_code == 200
        
        data = get_response.json()
        assert len(data["messages"]) == 3
        
        # Verify order (should be chronological)
        for i, msg in enumerate(messages):
            assert data["messages"][i]["text"] == msg

    def test_get_unread_count(self, api_client, auth_user_with_booking):
        """Test GET /api/bookings/{booking_id}/unread_count"""
        booking_id = auth_user_with_booking["booking_id"]
        token = auth_user_with_booking["token"]
        
        response = api_client.get(
            f"{BASE_URL}/api/bookings/{booking_id}/unread_count",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert response.status_code == 200
        
        data = response.json()
        assert "unread_count" in data
        assert isinstance(data["unread_count"], int)
        assert data["unread_count"] == 0  # No master messages yet


class TestBookingBugFix:
    """Test that bookings appear immediately after creation"""

    def test_booking_appears_in_active_list(self, api_client):
        """Test bug fix: After booking, GET /api/bookings shows booking in active list"""
        # Create new user
        test_username = f"test_booking_{uuid.uuid4().hex[:8]}"
        register_response = api_client.post(f"{BASE_URL}/api/register", json={
            "username": test_username,
            "email": f"{test_username}@example.com",
            "password": "quest123"
        })
        assert register_response.status_code == 200
        token = register_response.json()["token"]
        
        # Get a game with available spots
        games_response = api_client.get(f"{BASE_URL}/api/games")
        games = games_response.json()
        
        # Find game with spots available
        game_id = None
        for game in games:
            if game.get("spots_left", 0) > 0:
                game_id = game["id"]
                break
        
        if not game_id:
            pytest.skip("No games with available spots")
        
        # Book the game
        book_response = api_client.post(
            f"{BASE_URL}/api/games/{game_id}/book",
            json={},
            headers={"Authorization": f"Bearer {token}"}
        )
        assert book_response.status_code == 200
        booking_id = book_response.json()["booking_id"]
        
        # CRITICAL: Immediately get bookings list (simulating tab switch)
        bookings_response = api_client.get(
            f"{BASE_URL}/api/bookings",
            headers={"Authorization": f"Bearer {token}"}
        )
        assert bookings_response.status_code == 200
        
        data = bookings_response.json()
        assert "active" in data
        assert len(data["active"]) == 1, "Booking should appear immediately in active list"
        
        # Verify booking details
        booking = data["active"][0]
        assert booking["id"] == booking_id
        assert booking["status"] == "active"
        assert booking["game_id"] == game_id
        assert "game" in booking
        assert booking["game"]["title"]
        assert booking["game"]["game_master"]
