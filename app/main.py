from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import secrets
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Optional

from fastapi import Depends, FastAPI, Header, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import Boolean, Date, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, create_engine, func, select
from sqlalchemy.orm import DeclarativeBase, Mapped, Session, mapped_column, sessionmaker

ROOT = Path(__file__).resolve().parent.parent
try:
    from dotenv import load_dotenv
    load_dotenv(ROOT / ".env")
except ImportError:
    pass
PUBLIC = ROOT / "public"
raw_url = os.getenv("DATABASE_URL", f"sqlite:///{ROOT / 'bloom-local.db'}")
if raw_url.startswith("postgres://"):
    raw_url = raw_url.replace("postgres://", "postgresql+psycopg://", 1)
elif raw_url.startswith("postgresql://") and "+psycopg" not in raw_url:
    raw_url = raw_url.replace("postgresql://", "postgresql+psycopg://", 1)
engine_args = {"pool_pre_ping": True}
if raw_url.startswith("sqlite"):
    engine_args["connect_args"] = {"check_same_thread": False}
engine = create_engine(raw_url, **engine_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)
SECRET = os.getenv("BLOOM_SECRET_KEY")
if not SECRET:
    # Local development convenience only. Set a stable secret in production.
    SECRET = "local-development-only-change-me"
TOKEN_TTL_DAYS = int(os.getenv("BLOOM_TOKEN_TTL_DAYS", "14"))

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    username: Mapped[str] = mapped_column(String(24), unique=True, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    display_name: Mapped[str] = mapped_column(String(48), default="")
    avatar: Mapped[str] = mapped_column(String(16), default="flower")
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    show_on_leaderboard: Mapped[bool] = mapped_column(Boolean, default=True)
    xp: Mapped[int] = mapped_column(Integer, default=0)
    seeds: Mapped[int] = mapped_column(Integer, default=20)
    active_world: Mapped[str] = mapped_column(String(32), default="window_sill")

class Task(Base):
    __tablename__ = "tasks"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(180))
    estimate_minutes: Mapped[int] = mapped_column(Integer, default=25)
    status: Mapped[str] = mapped_column(String(20), default="todo")
    due_date: Mapped[Optional[date]] = mapped_column(Date, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

class FocusSession(Base):
    __tablename__ = "focus_sessions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    task_id: Mapped[Optional[int]] = mapped_column(ForeignKey("tasks.id", ondelete="SET NULL"), nullable=True)
    mode: Mapped[str] = mapped_column(String(16), default="focus")
    status: Mapped[str] = mapped_column(String(16), default="running")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    ended_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    accumulated_seconds: Mapped[int] = mapped_column(Integer, default=0)
    duration_seconds: Mapped[int] = mapped_column(Integer, default=0)
    rewarded: Mapped[bool] = mapped_column(Boolean, default=False)

class Plant(Base):
    __tablename__ = "plants"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    species: Mapped[str] = mapped_column(String(32), default="tulip")
    nickname: Mapped[str] = mapped_column(String(48), default="Blush tulip")
    growth_points: Mapped[int] = mapped_column(Integer, default=0)
    stage: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class GardenItem(Base):
    __tablename__ = "garden_items"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    item_key: Mapped[str] = mapped_column(String(64))
    item_type: Mapped[str] = mapped_column(String(24))
    x: Mapped[int] = mapped_column(Integer, default=0)
    y: Mapped[int] = mapped_column(Integer, default=0)
    placed: Mapped[bool] = mapped_column(Boolean, default=False)
    acquired_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class RewardTransaction(Base):
    __tablename__ = "reward_transactions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    session_id: Mapped[Optional[int]] = mapped_column(ForeignKey("focus_sessions.id", ondelete="SET NULL"), nullable=True)
    source_key: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    xp_delta: Mapped[int] = mapped_column(Integer, default=0)
    seed_delta: Mapped[int] = mapped_column(Integer, default=0)
    reason: Mapped[str] = mapped_column(String(80))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

class QuestDefinition(Base):
    __tablename__ = "quest_definitions"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    quest_key: Mapped[str] = mapped_column(String(48), unique=True)
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(String(240))
    target: Mapped[int] = mapped_column(Integer)
    metric: Mapped[str] = mapped_column(String(32))
    xp_reward: Mapped[int] = mapped_column(Integer, default=20)
    seed_reward: Mapped[int] = mapped_column(Integer, default=5)
    cadence: Mapped[str] = mapped_column(String(16), default="daily")

class UserQuest(Base):
    __tablename__ = "user_quests"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    quest_id: Mapped[int] = mapped_column(ForeignKey("quest_definitions.id", ondelete="CASCADE"))
    period_key: Mapped[str] = mapped_column(String(16))
    progress: Mapped[int] = mapped_column(Integer, default=0)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    reward_claimed: Mapped[bool] = mapped_column(Boolean, default=False)
    __table_args__ = (UniqueConstraint("user_id", "quest_id", "period_key", name="uq_user_quest_period"),)

class Friendship(Base):
    __tablename__ = "friendships"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    requester_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    recipient_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(16), default="pending")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    __table_args__ = (UniqueConstraint("requester_id", "recipient_id", name="uq_friendship_pair"),)

class UserAchievement(Base):
    __tablename__ = "user_achievements"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    achievement_key: Mapped[str] = mapped_column(String(48))
    unlocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    __table_args__ = (UniqueConstraint("user_id", "achievement_key", name="uq_user_achievement"),)

class UserWorld(Base):
    __tablename__ = "user_worlds"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    world_key: Mapped[str] = mapped_column(String(32))
    unlocked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))
    __table_args__ = (UniqueConstraint("user_id", "world_key", name="uq_user_world"),)

Base.metadata.create_all(bind=engine)

QUESTS = [
    {"quest_key":"focus_25","title":"One little sprint","description":"Complete one focus session.","target":1,"metric":"sessions","xp_reward":20,"seed_reward":5,"cadence":"daily"},
    {"quest_key":"focus_50","title":"Find your rhythm","description":"Focus for 50 minutes today.","target":50,"metric":"minutes","xp_reward":35,"seed_reward":8,"cadence":"daily"},
    {"quest_key":"task_done","title":"Check it off","description":"Complete one task.","target":1,"metric":"tasks","xp_reward":25,"seed_reward":6,"cadence":"daily"},
    {"quest_key":"weekly_5","title":"A week of little wins","description":"Complete five focus sessions this week.","target":5,"metric":"weekly_sessions","xp_reward":100,"seed_reward":20,"cadence":"weekly"},
]
WORLDS = [
    {"key":"window_sill","name":"Window Sill","description":"Your original sunny little home.","cost":0,"emoji":"sprout"},
    {"key":"rainy_cafe","name":"Rainy Café","description":"Rain on the window and warm café energy.","cost":80,"emoji":"coffee"},
    {"key":"forest_cabin","name":"Forest Cabin","description":"A quiet cabin tucked between the trees.","cost":120,"emoji":"tree"},
    {"key":"moon_garden","name":"Moon Garden","description":"A dreamy garden under the stars.","cost":180,"emoji":"moon"},
]
ITEMS = [
    {"key":"terracotta_pot","name":"Terracotta pot","type":"pot","cost":0,"emoji":"pot"},
    {"key":"pink_pot","name":"Blush pot","type":"pot","cost":20,"emoji":"tulip"},
    {"key":"mushroom","name":"Tiny mushroom","type":"decoration","cost":15,"emoji":"mushroom"},
    {"key":"stepping_stones","name":"Stepping stones","type":"decoration","cost":25,"emoji":"stones"},
    {"key":"pond","name":"Little pond","type":"decoration","cost":60,"emoji":"pond"},
    {"key":"fairy_lights","name":"Fairy lights","type":"decoration","cost":45,"emoji":"lights"},
    {"key":"daisy_seed","name":"Moon daisy seed","type":"seed","cost":30,"emoji":"daisy"},
    {"key":"lavender_seed","name":"Lilac spire seed","type":"seed","cost":40,"emoji":"lavender"},
]
ACHIEVEMENTS = [
    {"key":"first_sprint","name":"First Sprout","description":"Complete your first focus session.","emoji":"sprout"},
    {"key":"five_sprints","name":"Finding Flow","description":"Complete five focus sessions.","emoji":"leaf"},
    {"key":"focus_300","name":"Deep Roots","description":"Accumulate 300 focused minutes.","emoji":"tree"},
    {"key":"first_task","name":"Little Finisher","description":"Complete your first task.","emoji":"check"},
    {"key":"social_bloom","name":"Garden Neighbor","description":"Become friends with another gardener.","emoji":"heart"},
]

def utcnow() -> datetime:
    return datetime.now(timezone.utc)

def elapsed_seconds(started_at: datetime, now: Optional[datetime] = None) -> int:
    now = now or utcnow()
    # SQLite commonly returns naive datetimes even for DateTime(timezone=True).
    if started_at.tzinfo is None:
        started_at = started_at.replace(tzinfo=timezone.utc)
    if now.tzinfo is None:
        now = now.replace(tzinfo=timezone.utc)
    return max(0, int((now - started_at).total_seconds()))

def password_hash(password: str) -> str:
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 240_000)
    return base64.urlsafe_b64encode(salt + digest).decode()

def verify_password(password: str, stored: str) -> bool:
    try:
        raw = base64.urlsafe_b64decode(stored.encode())
        salt, expected = raw[:16], raw[16:]
        actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, 240_000)
        return hmac.compare_digest(expected, actual)
    except Exception:
        return False

def b64(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()

def create_token(user_id: int) -> str:
    payload = {"sub": user_id, "exp": int((utcnow() + timedelta(days=TOKEN_TTL_DAYS)).timestamp())}
    body = b64(json.dumps(payload, separators=(",", ":")).encode())
    sig = b64(hmac.new(SECRET.encode(), body.encode(), hashlib.sha256).digest())
    return body + "." + sig

def token_user_id(token: str) -> int:
    try:
        body, sig = token.split(".", 1)
        expected = b64(hmac.new(SECRET.encode(), body.encode(), hashlib.sha256).digest())
        if not hmac.compare_digest(sig, expected):
            raise ValueError("bad signature")
        payload = json.loads(base64.urlsafe_b64decode(body + "=" * (-len(body) % 4)))
        if int(payload["exp"]) < int(utcnow().timestamp()):
            raise ValueError("expired")
        return int(payload["sub"])
    except Exception:
        raise HTTPException(status_code=401, detail="Your session expired. Please sign in again.")

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

def require_user(authorization: Optional[str] = Header(default=None), db: Session = Depends(get_db)) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Please sign in to use this feature.")
    uid = token_user_id(authorization.split(" ", 1)[1].strip())
    user = db.get(User, uid)
    if not user:
        raise HTTPException(status_code=401, detail="Account not found.")
    return user

def user_out(u: User) -> dict[str, Any]:
    level = u.xp // 250 + 1
    return {"id":u.id,"username":u.username,"display_name":u.display_name or u.username,"avatar":u.avatar,
            "email":u.email,"xp":u.xp,"level":level,"seeds":u.seeds,"is_public":u.is_public,
            "show_on_leaderboard":u.show_on_leaderboard,"active_world":u.active_world}

def owned_task(db: Session, user: User, task_id: int) -> Task:
    task = db.get(Task, task_id)
    if not task or task.user_id != user.id:
        raise HTTPException(status_code=404, detail="Task not found.")
    return task

def reward(db: Session, user: User, source_key: str, xp: int, seeds: int, reason: str,
           session_id: Optional[int] = None) -> bool:
    if db.scalar(select(RewardTransaction.id).where(RewardTransaction.source_key == source_key)):
        return False
    user.xp += xp
    user.seeds += seeds
    db.add(RewardTransaction(user_id=user.id, session_id=session_id, source_key=source_key,
                             xp_delta=xp, seed_delta=seeds, reason=reason))
    return True

def ensure_quests(db: Session, user: User) -> None:
    for q in QUESTS:
        existing = db.scalar(select(QuestDefinition).where(QuestDefinition.quest_key == q["quest_key"]))
        if not existing:
            db.add(QuestDefinition(**q))
    db.flush()
    today = date.today().isoformat()
    week = f"{date.today().isocalendar().year}-W{date.today().isocalendar().week:02d}"
    db.flush()
    for q in db.scalars(select(QuestDefinition)).all():
        period = week if q.cadence == "weekly" else today
        existing = db.scalar(select(UserQuest.id).where(UserQuest.user_id == user.id, UserQuest.quest_id == q.id, UserQuest.period_key == period))
        if not existing:
            db.add(UserQuest(user_id=user.id, quest_id=q.id, period_key=period, progress=0))
    db.flush()

def update_quest_progress(db: Session, user: User, metric: str, amount: int) -> None:
    ensure_quests(db, user)
    today = date.today().isoformat()
    week = f"{date.today().isocalendar().year}-W{date.today().isocalendar().week:02d}"
    quests = db.execute(select(UserQuest, QuestDefinition).join(QuestDefinition, UserQuest.quest_id == QuestDefinition.id).where(
        UserQuest.user_id == user.id,
        UserQuest.period_key.in_([today, week]),
        QuestDefinition.metric == metric
    )).all()
    for uq, q in quests:
        if uq.completed_at is None:
            uq.progress = min(q.target, uq.progress + amount)
            if uq.progress >= q.target:
                uq.completed_at = utcnow()

class RegisterBody(BaseModel):
    username: str = Field(min_length=3, max_length=24, pattern=r"^[A-Za-z0-9_]+$")
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)

class LoginBody(BaseModel):
    username: str = Field(min_length=3, max_length=24)
    password: str = Field(min_length=8, max_length=128)

class TaskBody(BaseModel):
    title: str = Field(min_length=1, max_length=180)
    estimate_minutes: int = Field(default=25, ge=5, le=480)
    due_date: Optional[date] = None

class TaskUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=180)
    estimate_minutes: Optional[int] = Field(default=None, ge=5, le=480)
    status: Optional[str] = None
    due_date: Optional[date] = None

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = Field(default=None, max_length=48)
    avatar: Optional[str] = Field(default=None, max_length=16)
    is_public: Optional[bool] = None
    show_on_leaderboard: Optional[bool] = None
    active_world: Optional[str] = None

class StartSessionBody(BaseModel):
    task_id: Optional[int] = None
    mode: str = "focus"

class PlaceBody(BaseModel):
    x: int = Field(ge=0, le=7)
    y: int = Field(ge=0, le=5)

class FriendBody(BaseModel):
    username: str = Field(min_length=3, max_length=24)

app = FastAPI(title="Bloom — Focus & Grow", version="1.0.0", description="Cozy gamified productivity app")
@app.on_event("startup")
def startup():
    with SessionLocal() as db:
        for q in QUESTS:
            if not db.scalar(select(QuestDefinition.id).where(QuestDefinition.quest_key == q["quest_key"])):
                db.add(QuestDefinition(**q))
        db.commit()

@app.get("/api/health")
def health():
    return {"status":"ok","app":"Bloom","version":"1.0.0"}

@app.post("/api/auth/register")
def register(body: RegisterBody, db: Session = Depends(get_db)):
    username = body.username.strip()
    email = body.email.strip().lower()
    if db.scalar(select(User.id).where(func.lower(User.username) == username.lower())):
        raise HTTPException(status_code=409, detail="That username is already taken.")
    if db.scalar(select(User.id).where(func.lower(User.email) == email)):
        raise HTTPException(status_code=409, detail="An account with that email already exists.")
    user = User(username=username, email=email, password_hash=password_hash(body.password),
                display_name=username, seeds=20, xp=0, avatar="flower")
    db.add(user); db.flush()
    db.add(Plant(user_id=user.id, species="tulip", nickname="Blush tulip", growth_points=0, stage=0, is_active=True))
    db.add(UserWorld(user_id=user.id, world_key="window_sill"))
    ensure_quests(db, user)
    db.commit()
    return {"token":create_token(user.id),"user":user_out(user)}

@app.post("/api/auth/login")
def login(body: LoginBody, db: Session = Depends(get_db)):
    user = db.scalar(select(User).where(func.lower(User.username) == body.username.lower()))
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Username or password is incorrect.")
    ensure_quests(db, user); db.commit()
    return {"token":create_token(user.id),"user":user_out(user)}

@app.get("/api/auth/me")
def me(user: User = Depends(require_user), db: Session = Depends(get_db)):
    ensure_quests(db, user); db.commit()
    return {"user":user_out(user)}

@app.get("/api/profile")
def get_profile(user: User = Depends(require_user)):
    return {"user":user_out(user)}

@app.patch("/api/profile")
def patch_profile(body: ProfileUpdate, user: User = Depends(require_user), db: Session = Depends(get_db)):
    data = body.model_dump(exclude_unset=True)
    if "active_world" in data:
        unlocked = db.scalar(select(UserWorld.id).where(UserWorld.user_id == user.id, UserWorld.world_key == data["active_world"]))
        if not unlocked:
            raise HTTPException(status_code=400, detail="Unlock that world first.")
    for key, value in data.items():
        setattr(user, key, value)
    db.commit()
    return {"user":user_out(user)}

@app.get("/api/tasks")
def list_tasks(user: User = Depends(require_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Task).where(Task.user_id == user.id).order_by(Task.status.asc(), Task.created_at.desc())).all()
    return {"tasks":[task_out(t) for t in rows]}

def task_out(t: Task) -> dict[str, Any]:
    return {"id":t.id,"title":t.title,"estimate_minutes":t.estimate_minutes,"status":t.status,
            "due_date":t.due_date.isoformat() if t.due_date else None,
            "created_at":t.created_at.isoformat(),"completed_at":t.completed_at.isoformat() if t.completed_at else None}

@app.post("/api/tasks", status_code=201)
def create_task(body: TaskBody, user: User = Depends(require_user), db: Session = Depends(get_db)):
    title = body.title.strip()
    if not title:
        raise HTTPException(status_code=422, detail="Task title cannot be blank.")
    task = Task(user_id=user.id, title=title, estimate_minutes=body.estimate_minutes, due_date=body.due_date)
    db.add(task); db.commit(); db.refresh(task)
    return {"task":task_out(task)}

@app.patch("/api/tasks/{task_id}")
def update_task(task_id: int, body: TaskUpdate, user: User = Depends(require_user), db: Session = Depends(get_db)):
    task = owned_task(db, user, task_id)
    data = body.model_dump(exclude_unset=True)
    if "title" in data and data["title"] is not None:
        data["title"] = data["title"].strip()
        if not data["title"]:
            raise HTTPException(status_code=422, detail="Task title cannot be blank.")
    if "status" in data and data["status"] not in ("todo","done","archived"):
        raise HTTPException(status_code=400, detail="Invalid task status.")
    was_done = task.status == "done"
    for key, value in data.items():
        setattr(task, key, value)
    if task.status == "done" and not was_done:
        task.completed_at = utcnow()
        newly_rewarded = reward(db, user, f"task:{task.id}:complete", 15, 3, "task_complete")
        if newly_rewarded:
            update_quest_progress(db, user, "tasks", 1)
            maybe_achievement(db, user, "first_task")
    elif task.status != "done":
        task.completed_at = None
    db.commit()
    return {"task":task_out(task),"user":user_out(user)}

@app.delete("/api/tasks/{task_id}")
def delete_task(task_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    task = owned_task(db, user, task_id)
    db.delete(task); db.commit()
    return {"ok":True}

@app.post("/api/sessions/start", status_code=201)
def start_session(body: StartSessionBody, user: User = Depends(require_user), db: Session = Depends(get_db)):
    if body.mode not in ("focus","short","long"):
        raise HTTPException(status_code=400, detail="Invalid session mode.")
    task_id = body.task_id
    if task_id is not None:
        owned_task(db, user, task_id)
    existing = db.scalar(select(FocusSession).where(FocusSession.user_id == user.id, FocusSession.status.in_(["running","paused"])))
    if existing:
        return {"session":session_out(existing)}
    session = FocusSession(user_id=user.id, task_id=task_id, mode=body.mode, status="running", started_at=utcnow())
    db.add(session); db.commit(); db.refresh(session)
    return {"session":session_out(session)}

def session_out(s: FocusSession) -> dict[str, Any]:
    return {"id":s.id,"task_id":s.task_id,"mode":s.mode,"status":s.status,"started_at":s.started_at.isoformat(),
            "ended_at":s.ended_at.isoformat() if s.ended_at else None,"duration_seconds":s.duration_seconds}

def owned_session(db: Session, user: User, session_id: int) -> FocusSession:
    s = db.get(FocusSession, session_id)
    if not s or s.user_id != user.id:
        raise HTTPException(status_code=404, detail="Session not found.")
    return s

@app.post("/api/sessions/{session_id}/pause")
def pause_session(session_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    s = owned_session(db, user, session_id)
    if s.status == "running":
        s.accumulated_seconds += elapsed_seconds(s.started_at)
        s.status = "paused"
    db.commit()
    return {"session":session_out(s)}

@app.post("/api/sessions/{session_id}/resume")
def resume_session(session_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    s = owned_session(db, user, session_id)
    if s.status == "paused":
        s.started_at = utcnow()
        s.status = "running"
    db.commit()
    return {"session":session_out(s)}

@app.post("/api/sessions/{session_id}/cancel")
def cancel_session(session_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    s = owned_session(db, user, session_id)
    if s.status in ("running","paused"):
        if s.status == "running":
            s.accumulated_seconds += elapsed_seconds(s.started_at)
        s.status = "cancelled"
        s.ended_at = utcnow()
        s.duration_seconds = s.accumulated_seconds
    db.commit()
    return {"ok":True}

@app.post("/api/sessions/{session_id}/complete")
def complete_session(session_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    s = owned_session(db, user, session_id)
    if s.status == "cancelled":
        raise HTTPException(status_code=409, detail="A cancelled session cannot be completed.")
    if s.status == "completed":
        # Idempotent response: retries must never award the same session twice.
        return {"session":session_out(s),"reward":{"xp":0,"seeds":0,"duplicate":True,"eligible":s.rewarded},"user":user_out(user)}
    if s.status not in ("running", "paused"):
        raise HTTPException(status_code=409, detail="This session cannot be completed in its current state.")
    if s.status == "running":
        elapsed = elapsed_seconds(s.started_at)
        s.accumulated_seconds += elapsed
    # A stale browser tab must not turn hours away from the app into hours of
    # rewarded focus. Cap recorded time at the configured Pomodoro mode length.
    mode_limits = {"focus": 25 * 60, "short": 5 * 60, "long": 15 * 60}
    seconds = min(s.accumulated_seconds, mode_limits.get(s.mode, 25 * 60))
    s.ended_at = utcnow()
    s.duration_seconds = seconds
    s.status = "completed"
    if s.mode != "focus" or seconds < 60:
        db.commit()
        return {"session":session_out(s),"reward":{"xp":0,"seeds":0,"eligible":False},"user":user_out(user)}
    minutes = seconds // 60
    xp = max(5, minutes * 2)
    seeds = max(1, minutes // 10)
    reward(db, user, f"session:{s.id}:completion", xp, seeds, "focus_session", s.id)
    s.rewarded = True
    if s.task_id:
        task = db.get(Task, s.task_id)
        if task and task.user_id == user.id and task.status != "done":
            # The session is associated with a task; completion of the task remains explicit.
            pass
    plant = db.scalar(select(Plant).where(Plant.user_id == user.id, Plant.is_active == True))
    if not plant:
        plant = Plant(user_id=user.id, species="tulip", nickname="Blush tulip", is_active=True)
        db.add(plant); db.flush()
    plant.growth_points += minutes
    plant.stage = min(4, plant.growth_points // 25)
    update_quest_progress(db, user, "sessions", 1)
    update_quest_progress(db, user, "minutes", minutes)
    update_quest_progress(db, user, "weekly_sessions", 1)
    completed_count = db.scalar(select(func.count(FocusSession.id)).where(FocusSession.user_id == user.id, FocusSession.status == "completed")) or 0
    total_minutes = db.scalar(select(func.coalesce(func.sum(FocusSession.duration_seconds),0)).where(FocusSession.user_id == user.id, FocusSession.status == "completed")) or 0
    if completed_count >= 1: maybe_achievement(db, user, "first_sprint")
    if completed_count >= 5: maybe_achievement(db, user, "five_sprints")
    if total_minutes >= 300: maybe_achievement(db, user, "focus_300")
    db.commit()
    return {"session":session_out(s),"reward":{"xp":xp,"seeds":seeds,"minutes":minutes,"eligible":True},"user":user_out(user),"plant":{"id":plant.id,"species":plant.species,"stage":plant.stage,"growth_points":plant.growth_points}}

@app.get("/api/sessions")
def list_sessions(limit: int = 100, user: User = Depends(require_user), db: Session = Depends(get_db)):
    limit = max(1, min(200, limit))
    rows = db.scalars(select(FocusSession).where(FocusSession.user_id == user.id).order_by(FocusSession.id.desc()).limit(limit)).all()
    return {"sessions":[session_out(s) for s in rows]}

@app.get("/api/quests")
def get_quests(user: User = Depends(require_user), db: Session = Depends(get_db)):
    ensure_quests(db, user); db.commit()
    rows = db.execute(select(UserQuest, QuestDefinition).join(QuestDefinition, UserQuest.quest_id == QuestDefinition.id).where(UserQuest.user_id == user.id).order_by(QuestDefinition.cadence, QuestDefinition.id)).all()
    result=[]
    for uq,q in rows:
        result.append({"id":uq.id,"key":q.quest_key,"title":q.title,"description":q.description,"target":q.target,"metric":q.metric,
                       "progress":uq.progress,"completed":uq.completed_at is not None,"claimed":uq.reward_claimed,
                       "xp_reward":q.xp_reward,"seed_reward":q.seed_reward,"cadence":q.cadence,"period_key":uq.period_key})
    return {"quests":result}

@app.post("/api/quests/{user_quest_id}/claim")
def claim_quest(user_quest_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    uq = db.get(UserQuest, user_quest_id)
    if not uq or uq.user_id != user.id:
        raise HTTPException(status_code=404, detail="Quest not found.")
    q = db.get(QuestDefinition, uq.quest_id)
    if not uq.completed_at:
        raise HTTPException(status_code=400, detail="Complete the quest before claiming its reward.")
    if uq.reward_claimed:
        raise HTTPException(status_code=409, detail="Quest reward already claimed.")
    reward(db, user, f"quest:{uq.id}:claim", q.xp_reward, q.seed_reward, "quest_reward")
    uq.reward_claimed = True
    db.commit()
    return {"ok":True,"user":user_out(user)}

@app.get("/api/garden")
def get_garden(user: User = Depends(require_user), db: Session = Depends(get_db)):
    plants = db.scalars(select(Plant).where(Plant.user_id == user.id).order_by(Plant.id)).all()
    items = db.scalars(select(GardenItem).where(GardenItem.user_id == user.id).order_by(GardenItem.id)).all()
    return {"plants":[{"id":p.id,"species":p.species,"nickname":p.nickname,"growth_points":p.growth_points,"stage":p.stage,"is_active":p.is_active} for p in plants],
            "items":[{"id":i.id,"key":i.item_key,"type":i.item_type,"x":i.x,"y":i.y,"placed":i.placed} for i in items],
            "catalog":ITEMS}

@app.post("/api/garden/plants/{plant_id}/activate")
def activate_plant(plant_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    plants = db.scalars(select(Plant).where(Plant.user_id == user.id)).all()
    target = next((p for p in plants if p.id == plant_id), None)
    if not target: raise HTTPException(status_code=404, detail="Plant not found.")
    for p in plants: p.is_active = p.id == target.id
    db.commit()
    return {"ok":True}

@app.post("/api/garden/plants")
def add_plant(body: dict[str, Any], user: User = Depends(require_user), db: Session = Depends(get_db)):
    species = str(body.get("species","tulip"))
    if species not in ("tulip","daisy","lavender"): raise HTTPException(status_code=400, detail="Unknown plant species.")
    cost = {"tulip":20,"daisy":30,"lavender":40}[species]
    if user.seeds < cost: raise HTTPException(status_code=400, detail="Not enough seeds.")
    if cost:
        user.seeds -= cost
        db.add(RewardTransaction(user_id=user.id, source_key=f"plant-purchase:{user.id}:{secrets.token_hex(8)}", xp_delta=0, seed_delta=-cost, reason="plant_purchase"))
    p = Plant(user_id=user.id, species=species, nickname={"tulip":"Blush tulip","daisy":"Moon daisy","lavender":"Lilac spire"}[species], is_active=False)
    db.add(p); db.commit(); db.refresh(p)
    return {"plant":{"id":p.id,"species":p.species,"nickname":p.nickname,"stage":p.stage,"growth_points":p.growth_points,"is_active":p.is_active},"user":user_out(user)}

@app.post("/api/garden/shop/{item_key}/buy")
def buy_item(item_key: str, user: User = Depends(require_user), db: Session = Depends(get_db)):
    item = next((x for x in ITEMS if x["key"] == item_key), None)
    if not item: raise HTTPException(status_code=404, detail="Item not found.")
    if db.scalar(select(GardenItem.id).where(GardenItem.user_id == user.id, GardenItem.item_key == item_key)):
        raise HTTPException(status_code=409, detail="You already own this item.")
    if user.seeds < item["cost"]: raise HTTPException(status_code=400, detail="Not enough seeds.")
    user.seeds -= item["cost"]
    gi = GardenItem(user_id=user.id, item_key=item_key, item_type=item["type"], placed=False)
    db.add(gi)
    db.add(RewardTransaction(user_id=user.id, source_key=f"shop:{user.id}:{item_key}", xp_delta=0, seed_delta=-item["cost"], reason="shop_purchase"))
    db.commit()
    return {"ok":True,"user":user_out(user)}

@app.patch("/api/garden/items/{item_id}/place")
def place_item(item_id: int, body: PlaceBody, user: User = Depends(require_user), db: Session = Depends(get_db)):
    item = db.get(GardenItem, item_id)
    if not item or item.user_id != user.id: raise HTTPException(status_code=404, detail="Garden item not found.")
    collision = db.scalar(select(GardenItem.id).where(GardenItem.user_id == user.id, GardenItem.placed == True, GardenItem.x == body.x, GardenItem.y == body.y, GardenItem.id != item.id))
    if collision: raise HTTPException(status_code=409, detail="That garden tile is occupied.")
    item.x, item.y, item.placed = body.x, body.y, True
    db.commit()
    return {"ok":True}

@app.get("/api/worlds")
def get_worlds(user: User = Depends(require_user), db: Session = Depends(get_db)):
    unlocked = set(db.scalars(select(UserWorld.world_key).where(UserWorld.user_id == user.id)).all())
    return {"worlds":[{**w,"unlocked":w["key"] in unlocked,"active":user.active_world == w["key"]} for w in WORLDS]}

@app.post("/api/worlds/{world_key}/unlock")
def unlock_world(world_key: str, user: User = Depends(require_user), db: Session = Depends(get_db)):
    world = next((w for w in WORLDS if w["key"] == world_key), None)
    if not world: raise HTTPException(status_code=404, detail="World not found.")
    if db.scalar(select(UserWorld.id).where(UserWorld.user_id == user.id, UserWorld.world_key == world_key)):
        return {"ok":True,"user":user_out(user)}
    if user.seeds < world["cost"]: raise HTTPException(status_code=400, detail="Not enough seeds.")
    user.seeds -= world["cost"]
    db.add(UserWorld(user_id=user.id, world_key=world_key))
    db.add(RewardTransaction(user_id=user.id, source_key=f"world:{user.id}:{world_key}", xp_delta=0, seed_delta=-world["cost"], reason="world_unlock"))
    db.commit()
    return {"ok":True,"user":user_out(user)}

@app.post("/api/worlds/{world_key}/select")
def select_world(world_key: str, user: User = Depends(require_user), db: Session = Depends(get_db)):
    if not db.scalar(select(UserWorld.id).where(UserWorld.user_id == user.id, UserWorld.world_key == world_key)):
        raise HTTPException(status_code=400, detail="Unlock this world first.")
    user.active_world = world_key
    db.commit()
    return {"ok":True,"user":user_out(user)}

@app.get("/api/progress")
def progress(user: User = Depends(require_user), db: Session = Depends(get_db)):
    sessions = db.scalars(select(FocusSession).where(FocusSession.user_id == user.id, FocusSession.status == "completed").order_by(FocusSession.ended_at.desc())).all()
    today = date.today()
    daily = {}
    for s in sessions:
        if s.ended_at:
            d = s.ended_at.date().isoformat()
            daily[d] = daily.get(d,0) + s.duration_seconds // 60
    last7 = [(today - timedelta(days=i)) for i in range(6,-1,-1)]
    weekly = [{"date":d.isoformat(),"minutes":daily.get(d.isoformat(),0)} for d in last7]
    total_minutes = sum(s.duration_seconds // 60 for s in sessions if s.mode == "focus")
    today_minutes = daily.get(today.isoformat(),0)
    today_sessions = sum(1 for s in sessions if s.ended_at and s.ended_at.date().isoformat() == today.isoformat() and s.mode == "focus")
    streak=0
    cursor=today
    while daily.get(cursor.isoformat(),0)>0:
        streak += 1
        cursor -= timedelta(days=1)
    achievements = db.scalars(select(UserAchievement).where(UserAchievement.user_id == user.id).order_by(UserAchievement.unlocked_at.desc())).all()
    return {"today_minutes":today_minutes,"today_sessions":today_sessions,"total_minutes":total_minutes,"sessions":len(sessions),"streak":streak,
            "weekly":weekly,"achievements":[{"key":a.achievement_key,"unlocked_at":a.unlocked_at.isoformat()} for a in achievements],
            "recent_sessions":[session_out(s) for s in sessions[:15]]}

@app.get("/api/leaderboard")
def leaderboard(user: User = Depends(require_user), db: Session = Depends(get_db)):
    today = date.today()
    start = datetime.combine(today - timedelta(days=today.weekday()), datetime.min.time()).replace(tzinfo=timezone.utc)
    rows = db.execute(select(User, func.coalesce(func.sum(FocusSession.duration_seconds),0).label("seconds"))
        .outerjoin(FocusSession, (FocusSession.user_id == User.id) & (FocusSession.status == "completed") & (FocusSession.mode == "focus") & (FocusSession.ended_at >= start))
        .where(User.show_on_leaderboard == True)
        .group_by(User.id).order_by(func.coalesce(func.sum(FocusSession.duration_seconds),0).desc()).limit(50)).all()
    return {"period_start":start.date().isoformat(),"entries":[{"rank":i+1,"username":u.username,"display_name":u.display_name or u.username,"avatar":u.avatar,"level":u.xp//250+1,"minutes":int(seconds)//60,"is_me":u.id==user.id} for i,(u,seconds) in enumerate(rows)]}

@app.get("/api/friends")
def list_friends(user: User = Depends(require_user), db: Session = Depends(get_db)):
    rows = db.scalars(select(Friendship).where((Friendship.requester_id == user.id) | (Friendship.recipient_id == user.id)).order_by(Friendship.created_at.desc())).all()
    out=[]
    for f in rows:
        other_id = f.recipient_id if f.requester_id == user.id else f.requester_id
        other = db.get(User, other_id)
        if not other: continue
        out.append({"id":f.id,"username":other.username,"display_name":other.display_name or other.username,"avatar":other.avatar,
                    "level":other.xp//250+1,"status":f.status,"direction":"outgoing" if f.requester_id==user.id else "incoming",
                    "is_public":other.is_public})
    return {"friends":out}

@app.post("/api/friends/request", status_code=201)
def friend_request(body: FriendBody, user: User = Depends(require_user), db: Session = Depends(get_db)):
    other = db.scalar(select(User).where(func.lower(User.username) == body.username.lower()))
    if not other: raise HTTPException(status_code=404, detail="No gardener found with that username.")
    if other.id == user.id: raise HTTPException(status_code=400, detail="You can't add yourself.")
    existing = db.scalar(select(Friendship).where(
        ((Friendship.requester_id == user.id) & (Friendship.recipient_id == other.id)) |
        ((Friendship.requester_id == other.id) & (Friendship.recipient_id == user.id))))
    if existing:
        if existing.status == "blocked": raise HTTPException(status_code=403, detail="This connection is unavailable.")
        if existing.status == "pending" and existing.recipient_id == user.id:
            existing.status = "accepted"
            db.commit()
            return {"ok":True,"status":"accepted"}
        raise HTTPException(status_code=409, detail="A connection already exists.")
    db.add(Friendship(requester_id=user.id, recipient_id=other.id, status="pending"))
    db.commit()
    return {"ok":True,"status":"pending"}

@app.post("/api/friends/{friendship_id}/accept")
def accept_friend(friendship_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    f = db.get(Friendship, friendship_id)
    if not f or f.recipient_id != user.id or f.status != "pending": raise HTTPException(status_code=404, detail="Request not found.")
    f.status="accepted"; db.commit()
    maybe_achievement(db,user,"social_bloom"); db.commit()
    return {"ok":True}

@app.delete("/api/friends/{friendship_id}")
def remove_friend(friendship_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    f=db.get(Friendship,friendship_id)
    if not f or user.id not in (f.requester_id,f.recipient_id): raise HTTPException(status_code=404, detail="Connection not found.")
    db.delete(f); db.commit()
    return {"ok":True}

@app.post("/api/friends/{friendship_id}/block")
def block_friend(friendship_id: int, user: User = Depends(require_user), db: Session = Depends(get_db)):
    f = db.get(Friendship, friendship_id)
    if not f or user.id not in (f.requester_id, f.recipient_id):
        raise HTTPException(status_code=404, detail="Connection not found.")
    f.status = "blocked"
    db.commit()
    return {"ok": True}

@app.get("/api/friends/{username}/garden")
def friend_garden(username: str, user: User = Depends(require_user), db: Session = Depends(get_db)):
    other = db.scalar(select(User).where(func.lower(User.username) == username.lower()))
    if not other: raise HTTPException(status_code=404, detail="Gardener not found.")
    friendship = db.scalar(select(Friendship).where(Friendship.status=="accepted",
        ((Friendship.requester_id==user.id)&(Friendship.recipient_id==other.id)) |
        ((Friendship.requester_id==other.id)&(Friendship.recipient_id==user.id))))
    if not other.is_public and not friendship: raise HTTPException(status_code=403, detail="This garden is private.")
    plants=db.scalars(select(Plant).where(Plant.user_id==other.id)).all()
    return {"profile":{"username":other.username,"display_name":other.display_name or other.username,"avatar":other.avatar,"level":other.xp//250+1},
            "plants":[{"species":p.species,"nickname":p.nickname,"stage":p.stage,"growth_points":p.growth_points} for p in plants]}

@app.get("/api/settings")
def settings(user: User = Depends(require_user)):
    return {"profile":user_out(user)}

@app.get("/")
def index():
    return FileResponse(PUBLIC / "index.html")

def maybe_achievement(db: Session, user: User, key: str) -> None:
    if not db.scalar(select(UserAchievement.id).where(UserAchievement.user_id == user.id, UserAchievement.achievement_key == key)):
        db.add(UserAchievement(user_id=user.id, achievement_key=key))


@app.get("/api/achievements")
def get_achievements(user: User = Depends(require_user), db: Session = Depends(get_db)):
    unlocked = {a.achievement_key for a in db.scalars(select(UserAchievement).where(UserAchievement.user_id == user.id)).all()}
    return {"achievements":[{**a,"unlocked":a["key"] in unlocked} for a in ACHIEVEMENTS]}

# Register static files last so all /api routes take precedence.
app.mount("/", StaticFiles(directory=PUBLIC, html=True), name="static")
