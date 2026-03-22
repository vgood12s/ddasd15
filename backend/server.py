from fastapi import FastAPI, APIRouter, HTTPException, Depends, Header, Request, Response, UploadFile, File, Form
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import re
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import Optional, List
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import httpx
import subprocess
import tempfile
import struct
import json

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ.get('JWT_SECRET', 'guild-rpg-secret-key-2026-extended-secure!!')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 72

app = FastAPI()
api_router = APIRouter(prefix="/api")

# ===== Models =====
class RegisterRequest(BaseModel):
    username: str
    email: EmailStr
    password: str

class LoginRequest(BaseModel):
    login: str
    password: str

class UserResponse(BaseModel):
    id: str
    username: str
    first_name: Optional[str] = None
    email: str
    phone: Optional[str] = None
    balance: float = 0.0
    prepaid_hours: float = 0.0
    status_name: str = "Новичок"
    status_emoji: str = "🌱"
    cashback_rate: float = 5.0
    sessions_count: int = 0
    active_bookings: int = 0
    avatar: Optional[str] = None
    achievements: List[dict] = []
    created_at: str = ""
    next_status_name: str = "Авантюрист"
    next_status_emoji: str = "⚔️"
    next_status_games: int = 3
    progress_percent: float = 0.0

class AuthResponse(BaseModel):
    token: str
    user: UserResponse

class ProfileUpdateRequest(BaseModel):
    first_name: Optional[str] = None
    email: Optional[EmailStr] = None
    phone: Optional[str] = None

class PasswordChangeRequest(BaseModel):
    old_password: str
    new_password: str

class BookingRequest(BaseModel):
    use_cashback: float = 0.0

class RatingRequest(BaseModel):
    rating: int
    comment: str = ""

class SendMessageRequest(BaseModel):
    text: str

# ===== Helpers =====
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def create_token(user_id: str) -> str:
    payload = {
        'user_id': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(hours=JWT_EXPIRATION_HOURS),
        'iat': datetime.now(timezone.utc)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Токен истёк")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Невалидный токен")

async def get_current_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Требуется авторизация")
    token = authorization.split(' ')[1]
    payload = decode_token(token)
    user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Пользователь не найден")
    return user

async def get_optional_user(authorization: Optional[str] = Header(None)):
    if not authorization or not authorization.startswith('Bearer '):
        return None
    try:
        token = authorization.split(' ')[1]
        payload = decode_token(token)
        user = await db.users.find_one({"id": payload['user_id']}, {"_id": 0})
        return user
    except Exception:
        return None

STATUSES = [
    {"name": "Новичок", "emoji": "🌱", "min_games": 0, "cashback_rate": 5.0},
    {"name": "Авантюрист", "emoji": "⚔️", "min_games": 3, "cashback_rate": 7.0},
    {"name": "Герой", "emoji": "🛡️", "min_games": 10, "cashback_rate": 10.0},
    {"name": "Легенда", "emoji": "👑", "min_games": 25, "cashback_rate": 15.0},
    {"name": "Мифический", "emoji": "🐉", "min_games": 50, "cashback_rate": 20.0},
]

def get_user_status(sessions_count: int):
    current = STATUSES[0]
    next_status = STATUSES[1] if len(STATUSES) > 1 else STATUSES[0]
    for i, s in enumerate(STATUSES):
        if sessions_count >= s["min_games"]:
            current = s
            next_status = STATUSES[i + 1] if i + 1 < len(STATUSES) else s
    progress = 0.0
    if current != next_status:
        done = sessions_count - current["min_games"]
        total = next_status["min_games"] - current["min_games"]
        progress = min((done / total) * 100, 100) if total > 0 else 100
    else:
        progress = 100.0
    return current, next_status, progress

def user_to_response(user: dict) -> UserResponse:
    sc = user.get('sessions_count', 0)
    current, nxt, prog = get_user_status(sc)
    return UserResponse(
        id=user.get('id', ''),
        username=user.get('username', ''),
        first_name=user.get('first_name'),
        email=user.get('email', ''),
        phone=user.get('phone'),
        balance=user.get('balance', 0.0),
        prepaid_hours=user.get('prepaid_hours', 0.0),
        status_name=current["name"],
        status_emoji=current["emoji"],
        cashback_rate=current["cashback_rate"],
        sessions_count=sc,
        active_bookings=user.get('active_bookings', 0),
        avatar=user.get('avatar'),
        achievements=user.get('achievements', []),
        created_at=user.get('created_at', ''),
        next_status_name=nxt["name"],
        next_status_emoji=nxt["emoji"],
        next_status_games=nxt["min_games"],
        progress_percent=prog,
    )

def format_duration(hours: float) -> str:
    h = int(hours)
    if h == 1:
        return "1 час"
    elif 2 <= h <= 4:
        return f"{h} часа"
    else:
        return f"{h} часов"

# ===== Auth =====
@api_router.post("/register", response_model=AuthResponse)
async def register(req: RegisterRequest):
    if len(req.username) < 3:
        raise HTTPException(status_code=400, detail="Никнейм должен быть минимум 3 символа")
    if not re.match(r'^[a-zA-Z0-9_]+$', req.username):
        raise HTTPException(status_code=400, detail="Никнейм: только латиница, цифры и _")
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Пароль должен быть минимум 6 символов")
    existing = await db.users.find_one({"$or": [
        {"username": req.username.lower()},
        {"email": req.email.lower()}
    ]}, {"_id": 0})
    if existing:
        if existing.get('username') == req.username.lower():
            raise HTTPException(status_code=400, detail="Этот никнейм уже занят")
        raise HTTPException(status_code=400, detail="Этот email уже зарегистрирован")
    user_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    user = {
        "id": user_id, "username": req.username.lower(), "display_name": req.username,
        "first_name": req.username, "email": req.email.lower(),
        "password_hash": hash_password(req.password), "phone": None,
        "balance": 0.0, "prepaid_hours": 0.0, "sessions_count": 0,
        "active_bookings": 0, "avatar": None, "achievements": [],
        "is_admin": False, "created_at": now,
    }
    await db.users.insert_one(user)
    token = create_token(user_id)
    return AuthResponse(token=token, user=user_to_response(user))

@api_router.post("/login", response_model=AuthResponse)
async def login(req: LoginRequest):
    login_lower = req.login.lower()
    user = await db.users.find_one({"$or": [
        {"username": login_lower}, {"email": login_lower}
    ]}, {"_id": 0})
    if not user or not verify_password(req.password, user['password_hash']):
        raise HTTPException(status_code=401, detail="Неверный логин или пароль")
    token = create_token(user['id'])
    return AuthResponse(token=token, user=user_to_response(user))

@api_router.get("/me", response_model=UserResponse)
async def get_me(user: dict = Depends(get_current_user)):
    return user_to_response(user)

@api_router.put("/profile", response_model=UserResponse)
async def update_profile(req: ProfileUpdateRequest, user: dict = Depends(get_current_user)):
    updates = {}
    if req.first_name is not None:
        updates['first_name'] = req.first_name
    if req.email is not None:
        email_lower = req.email.lower()
        existing = await db.users.find_one({"email": email_lower, "id": {"$ne": user['id']}}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="Этот email уже зарегистрирован")
        updates['email'] = email_lower
    if req.phone is not None:
        updates['phone'] = req.phone
    if updates:
        await db.users.update_one({"id": user['id']}, {"$set": updates})
        user.update(updates)
    return user_to_response(user)

@api_router.put("/profile/password")
async def change_password(req: PasswordChangeRequest, user: dict = Depends(get_current_user)):
    if not verify_password(req.old_password, user['password_hash']):
        raise HTTPException(status_code=400, detail="Неверный текущий пароль")
    if len(req.new_password) < 6:
        raise HTTPException(status_code=400, detail="Новый пароль минимум 6 символов")
    await db.users.update_one({"id": user['id']}, {"$set": {"password_hash": hash_password(req.new_password)}})
    return {"message": "Пароль успешно изменён"}

# ===== Games =====
@api_router.get("/games")
async def get_games(upcoming: bool = True):
    query = {"is_active": True}
    games = await db.games.find(query, {"_id": 0}).sort("date_time", 1).to_list(100)
    for g in games:
        booked = await db.bookings.count_documents({"game_id": g["id"], "status": "active"})
        g["booked_count"] = booked
        g["spots_left"] = g.get("max_players", 6) - booked
        g["duration_text"] = format_duration(g.get("duration_hours", 4))
    return games

@api_router.get("/games/{game_id}")
async def get_game(game_id: str, user: Optional[dict] = Depends(get_optional_user)):
    game = await db.games.find_one({"id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Игра не найдена")
    booked = await db.bookings.count_documents({"game_id": game_id, "status": "active"})
    game["booked_count"] = booked
    game["spots_left"] = game.get("max_players", 6) - booked
    game["duration_text"] = format_duration(game.get("duration_hours", 4))
    game["is_booked"] = False
    if user:
        my_booking = await db.bookings.find_one({"game_id": game_id, "user_id": user["id"], "status": "active"}, {"_id": 0})
        game["is_booked"] = my_booking is not None
    # participants
    bookings = await db.bookings.find({"game_id": game_id, "status": "active"}, {"_id": 0}).to_list(100)
    participants = []
    for b in bookings:
        u = await db.users.find_one({"id": b["user_id"]}, {"_id": 0, "password_hash": 0})
        if u:
            sc = u.get('sessions_count', 0)
            cur, _, _ = get_user_status(sc)
            participants.append({
                "id": u["id"], "username": u.get("username", ""),
                "first_name": u.get("first_name", ""), "avatar": u.get("avatar"),
                "status_name": cur["name"], "status_emoji": cur["emoji"]
            })
    game["participants"] = participants
    # ratings
    ratings = await db.game_ratings.find({"game_id": game_id}, {"_id": 0}).to_list(100)
    game["ratings"] = ratings
    if ratings:
        game["avg_rating"] = sum(r["rating"] for r in ratings) / len(ratings)
    else:
        game["avg_rating"] = 0
    return game

@api_router.post("/games/{game_id}/book")
async def book_game(game_id: str, req: BookingRequest = BookingRequest(), user: dict = Depends(get_current_user)):
    game = await db.games.find_one({"id": game_id}, {"_id": 0})
    if not game:
        raise HTTPException(status_code=404, detail="Игра не найдена")
    if not game.get("is_active", False):
        raise HTTPException(status_code=400, detail="Игра неактивна")
    existing = await db.bookings.find_one({"game_id": game_id, "user_id": user["id"], "status": "active"}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Вы уже записаны на эту игру")
    booked = await db.bookings.count_documents({"game_id": game_id, "status": "active"})
    if booked >= game.get("max_players", 6):
        raise HTTPException(status_code=400, detail="Все места заняты")
    booking_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    price = game.get("hourly_rate", 350) * game.get("duration_hours", 4)
    booking = {
        "id": booking_id, "user_id": user["id"], "game_id": game_id,
        "status": "active", "booking_date": now,
        "actual_payment": price, "cashback_used": req.use_cashback, "hours_used": 0,
    }
    await db.bookings.insert_one(booking)
    await db.users.update_one({"id": user["id"]}, {"$inc": {"active_bookings": 1}})
    return {"message": "Вы записаны на игру!", "booking_id": booking_id}

@api_router.delete("/games/{game_id}/book")
async def cancel_booking(game_id: str, user: dict = Depends(get_current_user)):
    booking = await db.bookings.find_one({"game_id": game_id, "user_id": user["id"], "status": "active"}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    await db.bookings.update_one({"id": booking["id"]}, {"$set": {"status": "cancelled"}})
    await db.users.update_one({"id": user["id"]}, {"$inc": {"active_bookings": -1}})
    return {"message": "Запись отменена"}

@api_router.get("/games/{game_id}/participants")
async def get_participants(game_id: str):
    bookings = await db.bookings.find({"game_id": game_id, "status": "active"}, {"_id": 0}).to_list(100)
    participants = []
    for b in bookings:
        u = await db.users.find_one({"id": b["user_id"]}, {"_id": 0, "password_hash": 0})
        if u:
            sc = u.get('sessions_count', 0)
            cur, _, _ = get_user_status(sc)
            participants.append({
                "id": u["id"], "username": u.get("username", ""),
                "first_name": u.get("first_name"), "avatar": u.get("avatar"),
                "status_name": cur["name"], "status_emoji": cur["emoji"]
            })
    return participants

@api_router.post("/games/{game_id}/rate")
async def rate_game(game_id: str, req: RatingRequest, user: dict = Depends(get_current_user)):
    if req.rating < 1 or req.rating > 5:
        raise HTTPException(status_code=400, detail="Оценка от 1 до 5")
    booking = await db.bookings.find_one({"game_id": game_id, "user_id": user["id"], "status": "completed"}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=400, detail="Нельзя оценить — нет завершённой записи")
    existing = await db.game_ratings.find_one({"game_id": game_id, "user_id": user["id"]}, {"_id": 0})
    if existing:
        await db.game_ratings.update_one(
            {"game_id": game_id, "user_id": user["id"]},
            {"$set": {"rating": req.rating, "comment": req.comment}}
        )
        return {"message": "Оценка обновлена"}
    rating_doc = {
        "id": str(uuid.uuid4()), "game_id": game_id, "user_id": user["id"],
        "rating": req.rating, "comment": req.comment,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.game_ratings.insert_one(rating_doc)
    return {"message": "Спасибо за оценку!"}

# ===== Bookings =====
@api_router.get("/bookings")
async def get_bookings(user: dict = Depends(get_current_user)):
    bookings = await db.bookings.find({"user_id": user["id"]}, {"_id": 0}).sort("booking_date", -1).to_list(100)
    result = {"active": [], "past": []}
    for b in bookings:
        game = await db.games.find_one({"id": b["game_id"]}, {"_id": 0})
        if game:
            booked = await db.bookings.count_documents({"game_id": game["id"], "status": "active"})
            b["game"] = {
                "id": game["id"], "title": game.get("title", ""),
                "image_url": game.get("image_url", ""), "date_time": game.get("date_time", ""),
                "duration_hours": game.get("duration_hours", 4),
                "duration_text": format_duration(game.get("duration_hours", 4)),
                "game_master": game.get("game_master", ""),
                "master_login": game.get("master_login", ""),
                "location": game.get("location", ""),
                "booked_count": booked, "max_players": game.get("max_players", 6),
                "hourly_rate": game.get("hourly_rate", 350),
            }
        # check if rated
        rating = await db.game_ratings.find_one({"game_id": b["game_id"], "user_id": user["id"]}, {"_id": 0})
        b["is_rated"] = rating is not None
        b["rating"] = rating.get("rating") if rating else None
        if b["status"] == "active":
            result["active"].append(b)
        else:
            result["past"].append(b)
    return result

# ===== Chat =====
@api_router.get("/bookings/{booking_id}/messages")
async def get_messages(booking_id: str, user: dict = Depends(get_current_user)):
    booking = await db.bookings.find_one({"id": booking_id, "user_id": user["id"]}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    # Get game and master info
    game = await db.games.find_one({"id": booking["game_id"]}, {"_id": 0})
    master_name = game.get("game_master", "Мастер") if game else "Мастер"
    game_title = game.get("title", "") if game else ""
    messages = await db.messages.find({"booking_id": booking_id}, {"_id": 0}).sort("created_at", 1).to_list(500)
    # Mark master messages as read
    await db.messages.update_many(
        {"booking_id": booking_id, "sender_type": "master", "is_read": False},
        {"$set": {"is_read": True}}
    )
    return {
        "messages": messages,
        "master_name": master_name,
        "game_title": game_title,
        "booking_status": booking.get("status", "active"),
    }

@api_router.post("/bookings/{booking_id}/messages")
async def send_message(booking_id: str, req: SendMessageRequest, user: dict = Depends(get_current_user)):
    if not req.text.strip():
        raise HTTPException(status_code=400, detail="Сообщение не может быть пустым")
    booking = await db.bookings.find_one({"id": booking_id, "user_id": user["id"]}, {"_id": 0})
    if not booking:
        raise HTTPException(status_code=404, detail="Запись не найдена")
    msg = {
        "id": str(uuid.uuid4()),
        "booking_id": booking_id,
        "sender_id": user["id"],
        "sender_type": "player",
        "sender_name": user.get("first_name") or user.get("username", ""),
        "text": req.text.strip(),
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.messages.insert_one(msg)
    return {"id": msg["id"], "message": "Сообщение отправлено"}

@api_router.get("/bookings/{booking_id}/unread_count")
async def get_unread_count(booking_id: str, user: dict = Depends(get_current_user)):
    count = await db.messages.count_documents({"booking_id": booking_id, "sender_type": "master", "is_read": False})
    return {"unread_count": count}

# ===== Wallet =====
@api_router.get("/wallet")
async def get_wallet(type: Optional[str] = None, page: int = 1, user: dict = Depends(get_current_user)):
    query = {"user_id": user["id"]}
    if type == "income":
        query["amount"] = {"$gt": 0}
    elif type == "expense":
        query["amount"] = {"$lt": 0}
    elif type == "achievement":
        query["type"] = "achievement"
    total = await db.cashback_transactions.count_documents(query)
    per_page = 20
    skip = (page - 1) * per_page
    transactions = await db.cashback_transactions.find(query, {"_id": 0}).sort("created_at", -1).skip(skip).limit(per_page).to_list(per_page)
    # stats
    all_tx = await db.cashback_transactions.find({"user_id": user["id"]}, {"_id": 0}).to_list(1000)
    total_received = sum(t["amount"] for t in all_tx if t["amount"] > 0)
    total_spent = sum(abs(t["amount"]) for t in all_tx if t["amount"] < 0)
    sc = user.get('sessions_count', 0)
    cur, _, _ = get_user_status(sc)
    return {
        "balance": user.get("balance", 0),
        "prepaid_hours": user.get("prepaid_hours", 0),
        "status_name": cur["name"],
        "status_emoji": cur["emoji"],
        "cashback_rate": cur["cashback_rate"],
        "total_received": total_received,
        "total_spent": total_spent,
        "transactions": transactions,
        "total": total,
        "page": page,
        "pages": (total + per_page - 1) // per_page,
    }

# ===== Masters =====
@api_router.get("/masters")
async def get_masters():
    masters = await db.masters.find({"is_active": True}, {"_id": 0}).to_list(100)
    for m in masters:
        ratings = await db.game_ratings.find({"game_id": {"$in": [g["id"] async for g in db.games.find({"master_login": m.get("username", "")}, {"id": 1, "_id": 0})]}}, {"_id": 0}).to_list(1000)
        if ratings:
            m["avg_rating"] = round(sum(r["rating"] for r in ratings) / len(ratings), 1)
            m["ratings_count"] = len(ratings)
        else:
            m["avg_rating"] = 0
            m["ratings_count"] = 0
        m["sessions_count"] = await db.games.count_documents({"master_login": m.get("username", ""), "status": "completed"})
        m["total_sessions"] = await db.games.count_documents({"master_login": m.get("username", "")})
    return masters

@api_router.get("/masters/{master_id}")
async def get_master(master_id: str):
    master = await db.masters.find_one({"id": master_id}, {"_id": 0})
    if not master:
        raise HTTPException(status_code=404, detail="Мастер не найден")
    upcoming = await db.games.find(
        {"master_login": master.get("username", ""), "is_active": True},
        {"_id": 0}
    ).sort("date_time", 1).to_list(10)
    for g in upcoming:
        booked = await db.bookings.count_documents({"game_id": g["id"], "status": "active"})
        g["booked_count"] = booked
        g["spots_left"] = g.get("max_players", 6) - booked
        g["duration_text"] = format_duration(g.get("duration_hours", 4))
    master["upcoming_sessions"] = upcoming
    master["total_sessions"] = await db.games.count_documents({"master_login": master.get("username", "")})
    return master

# ===== Leaderboard =====
@api_router.get("/leaderboard")
async def get_leaderboard(sort_by: str = "sessions"):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(1000)
    for u in users:
        sc = u.get('sessions_count', 0)
        cur, _, _ = get_user_status(sc)
        u["status_name"] = cur["name"]
        u["status_emoji"] = cur["emoji"]
        u["achievement_count"] = len(u.get("achievements", []))
    if sort_by == "sessions":
        users.sort(key=lambda x: x.get("sessions_count", 0), reverse=True)
    elif sort_by == "gold":
        users.sort(key=lambda x: x.get("balance", 0), reverse=True)
    elif sort_by == "achievements":
        users.sort(key=lambda x: x.get("achievement_count", 0), reverse=True)
    top = users[:20]
    result = []
    for i, u in enumerate(top):
        result.append({
            "rank": i + 1, "id": u["id"], "username": u.get("username", ""),
            "first_name": u.get("first_name", ""), "avatar": u.get("avatar"),
            "status_name": u["status_name"], "status_emoji": u["status_emoji"],
            "sessions_count": u.get("sessions_count", 0),
            "balance": u.get("balance", 0),
            "achievement_count": u.get("achievement_count", 0),
        })
    return result

# ===== Public Profile =====
@api_router.get("/player/{player_id}")
async def get_player(player_id: str):
    u = await db.users.find_one({"id": player_id}, {"_id": 0, "password_hash": 0, "email": 0, "phone": 0, "balance": 0, "prepaid_hours": 0})
    if not u:
        raise HTTPException(status_code=404, detail="Игрок не найден")
    sc = u.get('sessions_count', 0)
    cur, _, _ = get_user_status(sc)
    return {
        "id": u["id"], "username": u.get("username"), "first_name": u.get("first_name"),
        "avatar": u.get("avatar"), "status_name": cur["name"], "status_emoji": cur["emoji"],
        "sessions_count": sc, "achievements": u.get("achievements", []),
    }

# ===== Calendar =====
@api_router.get("/calendar/events")
async def get_calendar_events():
    games = await db.games.find({"is_active": True}, {"_id": 0}).to_list(100)
    events = []
    for g in games:
        booked = await db.bookings.count_documents({"game_id": g["id"], "status": "active"})
        spots = g.get("max_players", 6) - booked
        color = "#4ead6a" if spots > 2 else "#e8d5a8" if spots > 0 else "#c74848"
        events.append({
            "id": g["id"], "title": g.get("title", ""),
            "start": g.get("date_time", ""), "color": color,
            "extendedProps": {
                "game_master": g.get("game_master", ""),
                "location": g.get("location", ""),
                "spots_left": spots, "max_players": g.get("max_players", 6),
                "booked_count": booked,
            }
        })
    return events

# ===== Health =====
@api_router.get("/")
async def root():
    return {"message": "Гильдия API v1.0"}

@api_router.get("/health")
async def health():
    return {"status": "ok"}

# ===== Audio Waveform Analysis =====
_waveform_cache: dict = {}  # url -> bars[]

@app.get("/api/proxy/waveform")
async def get_waveform(url: str):
    """Download audio file, analyze amplitude, return waveform bars."""
    if url in _waveform_cache:
        return {"bars": _waveform_cache[url]}

    full_url = url if url.startswith("http") else f"{GUILD_API_URL}{url}"

    try:
        async with httpx.AsyncClient(timeout=15) as http:
            resp = await http.get(full_url)
            if resp.status_code != 200:
                raise HTTPException(status_code=404, detail="Audio file not found")

        # Save to temp file
        with tempfile.NamedTemporaryFile(suffix=".webm", delete=False) as tmp:
            tmp.write(resp.content)
            tmp_path = tmp.name

        # Convert to raw PCM using ffmpeg
        pcm_path = tmp_path + ".raw"
        proc = subprocess.run(
            ["ffmpeg", "-y", "-i", tmp_path, "-ac", "1", "-ar", "8000",
             "-f", "s16le", "-acodec", "pcm_s16le", pcm_path],
            capture_output=True, timeout=10
        )

        if proc.returncode != 0:
            os.unlink(tmp_path)
            # Return fallback bars
            return {"bars": [0.3] * 40}

        # Read PCM data
        with open(pcm_path, "rb") as f:
            pcm_data = f.read()

        os.unlink(tmp_path)
        os.unlink(pcm_path)

        if len(pcm_data) < 4:
            return {"bars": [0.1] * 40}

        # Parse 16-bit signed samples
        num_samples = len(pcm_data) // 2
        samples = struct.unpack(f"<{num_samples}h", pcm_data[:num_samples * 2])

        # Split into N chunks and get RMS amplitude for each
        num_bars = 48
        chunk_size = max(1, num_samples // num_bars)
        bars = []
        max_amp = 1.0

        for i in range(num_bars):
            start = i * chunk_size
            end = min(start + chunk_size, num_samples)
            if start >= num_samples:
                bars.append(0.0)
                continue
            chunk = samples[start:end]
            # RMS amplitude
            rms = (sum(s * s for s in chunk) / len(chunk)) ** 0.5
            bars.append(rms)

        # Normalize to 0.0-1.0
        max_amp = max(bars) if bars else 1.0
        if max_amp > 0:
            bars = [min(1.0, max(0.05, b / max_amp)) for b in bars]
        else:
            bars = [0.1] * num_bars

        _waveform_cache[url] = bars
        return {"bars": bars}

    except Exception as e:
        logger.error(f"Waveform error: {e}")
        return {"bars": [0.3] * 40}


# ===== Proxy to guildkhv.com =====
GUILD_API_URL = "https://guildkhv.com"
GUILD_API_KEY = os.environ.get("GUILD_API_KEY", "gld-k8v-2026-xQ9mP4rT7wLz")

# ===== Web Session Manager (for file uploads) =====
# The website's API only supports text messages.
# File/voice uploads go through web routes with Flask session + CSRF.
_web_sessions: dict = {}  # token_hash -> {"cookie": str, "csrf": str, "expires": datetime}

async def _get_web_session(bearer_token: str) -> dict:
    """Get or create a web session for file uploads."""
    import hashlib
    token_hash = hashlib.sha256(bearer_token.encode()).hexdigest()[:16]

    cached = _web_sessions.get(token_hash)
    if cached and cached.get("expires", datetime.min) > datetime.now():
        return cached

    # First, get the user info from the API to find their credentials
    # We need to decode the JWT token to get user_id, then do web login
    async with httpx.AsyncClient(timeout=15, follow_redirects=False) as http:
        # Step 1: Get the login page to obtain CSRF token and initial cookie
        login_page = await http.get(f"{GUILD_API_URL}/guild/login")
        cookies = dict(login_page.cookies)

        # Extract CSRF token
        import re as _re
        csrf_match = _re.search(r'name="csrf_token"\s+value="([^"]+)"', login_page.text)
        if not csrf_match:
            raise HTTPException(status_code=500, detail="Не удалось получить CSRF токен")
        csrf_token = csrf_match.group(1)

        # Step 2: Get user info via API to determine login credentials
        me_resp = await http.get(
            f"{GUILD_API_URL}/api/me",
            headers={"Authorization": f"Bearer {bearer_token}", "X-API-Key": GUILD_API_KEY}
        )
        if me_resp.status_code != 200:
            raise HTTPException(status_code=401, detail="Невалидный токен")
        user_data = me_resp.json()
        username = user_data.get("username", "")

        # Step 3: We can't do web login without the password.
        # But we can try a workaround: the API token shares the same JWT secret,
        # so we'll try to use the API auth to create a message via an alternative method.
        # Actually, we need to store the password during login.
        # Check if we have cached credentials
        cred = _web_sessions.get(f"cred_{token_hash}")
        if not cred:
            raise HTTPException(
                status_code=400,
                detail="Требуется повторный вход для отправки файлов"
            )

        # Step 4: Web login with the cached credentials
        login_resp = await http.post(
            f"{GUILD_API_URL}/guild/login",
            data={
                "login": cred["login"],
                "password": cred["password"],
                "csrf_token": csrf_token
            },
            cookies=cookies
        )

        if login_resp.status_code not in (200, 302):
            raise HTTPException(status_code=401, detail="Не удалось создать веб-сессию")

        # Get session cookie from response
        session_cookie = None
        for cookie_name, cookie_value in login_resp.cookies.items():
            if cookie_name == "session":
                session_cookie = cookie_value
                break

        if not session_cookie:
            raise HTTPException(status_code=500, detail="Веб-сессия не создана")

        # Step 5: Get a fresh CSRF token from the chat page
        # We'll get it when needed per-request

        session_data = {
            "cookie": session_cookie,
            "expires": datetime.now() + timedelta(hours=12),
        }
        _web_sessions[token_hash] = session_data
        return session_data


async def _get_csrf_for_chat(session_cookie: str, game_id: int) -> str:
    """Get CSRF token from the chat page."""
    async with httpx.AsyncClient(timeout=15, follow_redirects=True) as http:
        chat_page = await http.get(
            f"{GUILD_API_URL}/guild/chat/{game_id}",
            cookies={"session": session_cookie}
        )
        import re as _re
        csrf_match = _re.search(r'csrf-token"\s+content="([^"]+)"', chat_page.text)
        if not csrf_match:
            # Try hidden field
            csrf_match = _re.search(r'name="csrf_token"\s+value="([^"]+)"', chat_page.text)
        if not csrf_match:
            raise HTTPException(status_code=500, detail="Не удалось получить CSRF токен чата")
        return csrf_match.group(1)


async def _get_game_id_for_booking(booking_id: int, bearer_token: str) -> int:
    """Get game_id from booking data via API."""
    async with httpx.AsyncClient(timeout=15) as http:
        resp = await http.get(
            f"{GUILD_API_URL}/api/bookings",
            headers={"Authorization": f"Bearer {bearer_token}", "X-API-Key": GUILD_API_KEY}
        )
        if resp.status_code != 200:
            raise HTTPException(status_code=resp.status_code, detail="Не удалось получить бронирования")
        data = resp.json()
        for group in ["active", "past"]:
            for booking in data.get(group, []):
                if booking.get("id") == booking_id:
                    return booking.get("game_id")
        raise HTTPException(status_code=404, detail="Бронирование не найдено")


# ===== Login proxy that caches credentials for web session =====
@app.post("/api/proxy/login")
async def proxy_login(request: Request):
    """Proxy login that also caches credentials for web session."""
    body = await request.body()
    data = json.loads(body) if body else {}

    # Forward to API
    async with httpx.AsyncClient(timeout=30) as http:
        resp = await http.post(
            f"{GUILD_API_URL}/api/login",
            headers={
                "X-API-Key": GUILD_API_KEY,
                "Content-Type": "application/json"
            },
            content=body
        )

    if resp.status_code == 200:
        # Cache credentials for web session
        resp_data = resp.json()
        token = resp_data.get("token", "")
        import hashlib
        token_hash = hashlib.sha256(token.encode()).hexdigest()[:16]
        _web_sessions[f"cred_{token_hash}"] = {
            "login": data.get("login", ""),
            "password": data.get("password", ""),
        }

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers={"content-type": resp.headers.get("content-type", "application/json")},
    )


# ===== Voice Upload Proxy =====
@app.post("/api/proxy/bookings/{booking_id}/voice")
async def proxy_voice_upload(
    booking_id: int,
    request: Request,
    audio: UploadFile = File(...),
):
    """Upload voice message to the website via web session."""
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Требуется авторизация")
    bearer_token = auth.split(" ")[1]

    # Get web session
    session_data = await _get_web_session(bearer_token)

    # Get game_id for the booking
    game_id = await _get_game_id_for_booking(booking_id, bearer_token)

    # Get CSRF token
    csrf = await _get_csrf_for_chat(session_data["cookie"], game_id)

    # Upload the voice file
    audio_bytes = await audio.read()

    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as http:
        resp = await http.post(
            f"{GUILD_API_URL}/guild/chat/{game_id}/voice",
            cookies={"session": session_data["cookie"]},
            headers={"X-CSRFToken": csrf},
            files={"audio": (audio.filename or "voice.webm", audio_bytes, audio.content_type or "audio/webm")},
        )

    if resp.status_code == 200:
        return {"ok": True, "message": "Голосовое сообщение отправлено"}
    else:
        # Session might be expired, clear cache and retry
        import hashlib
        token_hash = hashlib.sha256(bearer_token.encode()).hexdigest()[:16]
        _web_sessions.pop(token_hash, None)
        raise HTTPException(status_code=resp.status_code, detail="Ошибка отправки голосового сообщения")


# ===== File Upload Proxy =====
@app.post("/api/proxy/bookings/{booking_id}/upload")
async def proxy_file_upload(
    booking_id: int,
    request: Request,
    file: UploadFile = File(...),
    text: str = Form(default=""),
):
    """Upload file (image/doc) to chat via web session."""
    auth = request.headers.get("authorization", "")
    if not auth.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Требуется авторизация")
    bearer_token = auth.split(" ")[1]

    # Get web session
    session_data = await _get_web_session(bearer_token)

    # Get game_id
    game_id = await _get_game_id_for_booking(booking_id, bearer_token)

    # Get CSRF token
    csrf = await _get_csrf_for_chat(session_data["cookie"], game_id)

    # Upload the file
    file_bytes = await file.read()

    async with httpx.AsyncClient(timeout=30, follow_redirects=True) as http:
        resp = await http.post(
            f"{GUILD_API_URL}/guild/chat/{game_id}",
            cookies={"session": session_data["cookie"]},
            headers={"X-CSRFToken": csrf},
            data={"text": text or ""},
            files={"file": (file.filename or "file", file_bytes, file.content_type or "application/octet-stream")},
        )

    if resp.status_code in (200, 302):
        return {"ok": True, "message": "Файл отправлен"}
    else:
        import hashlib
        token_hash = hashlib.sha256(bearer_token.encode()).hexdigest()[:16]
        _web_sessions.pop(token_hash, None)
        raise HTTPException(status_code=resp.status_code, detail="Ошибка отправки файла")


@app.api_route("/api/proxy/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"])
async def proxy_to_guild(path: str, request: Request):
    target_url = f"{GUILD_API_URL}/api/{path}"
    query = str(request.url.query)
    if query:
        target_url += f"?{query}"

    headers = {}
    headers["X-API-Key"] = GUILD_API_KEY
    if request.headers.get("authorization"):
        headers["Authorization"] = request.headers["authorization"]
    if request.headers.get("content-type"):
        headers["Content-Type"] = request.headers["content-type"]

    body = await request.body()

    async with httpx.AsyncClient(timeout=30) as client_http:
        resp = await client_http.request(
            method=request.method,
            url=target_url,
            headers=headers,
            content=body if body else None,
        )

    return Response(
        content=resp.content,
        status_code=resp.status_code,
        headers={"content-type": resp.headers.get("content-type", "application/json")},
    )

app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ===== Seed Data =====
async def seed_data():
    games_count = await db.games.count_documents({})
    if games_count > 0:
        return

    logger.info("Seeding database...")

    # Seed masters
    masters = [
        {
            "id": str(uuid.uuid4()), "username": "kira_shibashi", "full_name": "Kira Shibashi",
            "role": "game_master", "avatar": None, "bio": "Опытный мастер с 5-летним стажем. Специализируюсь на хоррор-приключениях и глубоких сюжетах.",
            "style": "Хоррор атмосфера", "experience_years": 5,
            "systems": ["D&D", "Pathfinder"], "is_active": True,
        },
        {
            "id": str(uuid.uuid4()), "username": "dark_lord", "full_name": "Дмитрий Тёмный",
            "role": "game_master", "avatar": None, "bio": "Мастер эпических кампаний. Каждая сессия — незабываемое приключение.",
            "style": "Эпическое фэнтези", "experience_years": 8,
            "systems": ["D&D", "Warhammer", "Savage Worlds"], "is_active": True,
        },
        {
            "id": str(uuid.uuid4()), "username": "fox_master", "full_name": "Алиса Лисова",
            "role": "game_master", "avatar": None, "bio": "Создаю уютные и тёплые истории с глубокими персонажами.",
            "style": "Narrative-driven RP", "experience_years": 3,
            "systems": ["Fate", "PBTA", "D&D"], "is_active": True,
        },
    ]
    await db.masters.insert_many(masters)

    # Seed games
    now = datetime.now(timezone.utc)
    games = [
        {
            "id": str(uuid.uuid4()), "title": "Легенда о бездне",
            "description": "Древнее зло пробудилось в глубинах подземелья. Группа смельчаков должна спуститься в бездну, чтобы остановить ритуал тёмного культа. На пути их ждут ловушки, монстры и моральные дилеммы. Готовы ли вы заглянуть в лицо тьме?",
            "game_master": "Kira Shibashi", "master_login": "kira_shibashi",
            "date_time": (now + timedelta(days=2)).isoformat(),
            "duration_hours": 4, "max_players": 6, "hourly_rate": 350,
            "price": 1400, "location": "Клуб Гильдия",
            "is_active": True, "status": "upcoming", "image_url": "",
        },
        {
            "id": str(uuid.uuid4()), "title": "Проклятие Серебряного Леса",
            "description": "Таинственное проклятие обрушилось на Серебряный Лес. Деревья шепчут имена мёртвых, а туман скрывает забытые тайны. Вам предстоит разгадать загадку древнего друида и снять проклятие, пока лес не поглотил всё вокруг.",
            "game_master": "Дмитрий Тёмный", "master_login": "dark_lord",
            "date_time": (now + timedelta(days=5)).isoformat(),
            "duration_hours": 5, "max_players": 5, "hourly_rate": 400,
            "price": 2000, "location": "Кафе Дракон",
            "is_active": True, "status": "upcoming", "image_url": "",
        },
        {
            "id": str(uuid.uuid4()), "title": "Хроники Звёздного Странника",
            "description": "Космическая одиссея в мире фэнтези. Ваш корабль потерпел крушение на неизвестной планете. Местные жители обладают магией, а технологии бесполезны. Найдите способ починить корабль и вернуться домой.",
            "game_master": "Алиса Лисова", "master_login": "fox_master",
            "date_time": (now + timedelta(days=7)).isoformat(),
            "duration_hours": 3, "max_players": 4, "hourly_rate": 300,
            "price": 900, "location": "Онлайн (Discord)",
            "is_active": True, "status": "upcoming", "image_url": "",
        },
        {
            "id": str(uuid.uuid4()), "title": "Тени Вальхаллы",
            "description": "Мир скандинавской мифологии. Рагнарёк приближается, и боги ищут героев среди смертных. Вас призвали в Асгард для последней битвы. Но не всё так просто — среди богов есть предатель.",
            "game_master": "Дмитрий Тёмный", "master_login": "dark_lord",
            "date_time": (now + timedelta(days=10)).isoformat(),
            "duration_hours": 6, "max_players": 6, "hourly_rate": 400,
            "price": 2400, "location": "Клуб Гильдия",
            "is_active": True, "status": "upcoming", "image_url": "",
        },
    ]
    await db.games.insert_many(games)

    # Seed sample users for leaderboard
    sample_users = [
        {"id": str(uuid.uuid4()), "username": "dragon_slayer", "first_name": "Артём", "email": "dragon@guild.com", "password_hash": hash_password("test123"), "balance": 450, "prepaid_hours": 5, "sessions_count": 12, "active_bookings": 1, "achievements": [{"name": "Первый шаг", "emoji": "👣"}, {"name": "Ветеран", "emoji": "⚔️"}], "is_admin": False, "created_at": now.isoformat(), "avatar": None, "phone": None},
        {"id": str(uuid.uuid4()), "username": "shadow_mage", "first_name": "Ирина", "email": "shadow@guild.com", "password_hash": hash_password("test123"), "balance": 230, "prepaid_hours": 2, "sessions_count": 7, "active_bookings": 0, "achievements": [{"name": "Первый шаг", "emoji": "👣"}], "is_admin": False, "created_at": now.isoformat(), "avatar": None, "phone": None},
        {"id": str(uuid.uuid4()), "username": "elf_ranger", "first_name": "Максим", "email": "elf@guild.com", "password_hash": hash_password("test123"), "balance": 780, "prepaid_hours": 10, "sessions_count": 28, "active_bookings": 2, "achievements": [{"name": "Первый шаг", "emoji": "👣"}, {"name": "Ветеран", "emoji": "⚔️"}, {"name": "Легенда", "emoji": "🏆"}], "is_admin": False, "created_at": now.isoformat(), "avatar": None, "phone": None},
        {"id": str(uuid.uuid4()), "username": "dwarf_king", "first_name": "Павел", "email": "dwarf@guild.com", "password_hash": hash_password("test123"), "balance": 120, "prepaid_hours": 0, "sessions_count": 4, "active_bookings": 1, "achievements": [{"name": "Первый шаг", "emoji": "👣"}], "is_admin": False, "created_at": now.isoformat(), "avatar": None, "phone": None},
    ]
    await db.users.insert_many(sample_users)

    # Seed transactions for sample user
    for u in sample_users:
        txs = [
            {"id": str(uuid.uuid4()), "user_id": u["id"], "amount": 100, "balance_after": 100, "type": "manual", "description": "Ручное начисление админом", "game_id": None, "created_by": "admin", "created_at": (now - timedelta(days=10)).isoformat()},
        ]
        if u["balance"] > 100:
            txs.append({"id": str(uuid.uuid4()), "user_id": u["id"], "amount": u["balance"] - 100, "balance_after": u["balance"], "type": "cashback", "description": f"Кэшбэк за игры", "game_id": None, "created_by": "system", "created_at": (now - timedelta(days=5)).isoformat()})
        await db.cashback_transactions.insert_many(txs)

    logger.info("Seed data inserted successfully")

@app.on_event("startup")
async def startup():
    await db.users.create_index("username", unique=True)
    await db.users.create_index("email", unique=True)
    await db.users.create_index("id", unique=True)
    await db.games.create_index("id", unique=True)
    await db.bookings.create_index("id", unique=True)
    await db.masters.create_index("id", unique=True)
    await db.messages.create_index([("booking_id", 1), ("created_at", 1)])
    await seed_data()
    logger.info("Гильдия API started")

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
