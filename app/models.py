from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Boolean, Float, JSON, UniqueConstraint
from sqlalchemy.orm import relationship, Mapped, mapped_column
from datetime import datetime
from .database import Base

class User(Base):
    __tablename__ = "users"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    tg_user_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    locale: Mapped[str] = mapped_column(String, default="en")
    tz: Mapped[str] = mapped_column(String, default="UTC")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    streak: Mapped[int] = mapped_column(Integer, default=0)
    coins: Mapped[int] = mapped_column(Integer, default=0)
    xp: Mapped[int] = mapped_column(Integer, default=0)
    gp: Mapped[int] = mapped_column(Integer, default=0)
    garden_slots: Mapped[int] = mapped_column(Integer, default=4)
    moisture: Mapped[int] = mapped_column(Integer, default=100)
    cleanliness: Mapped[int] = mapped_column(Integer, default=100)

    strategies = relationship("Strategy", back_populates="user", cascade="all, delete-orphan")
    task_templates = relationship("TaskTemplate", back_populates="user", cascade="all, delete-orphan")
    plants = relationship("Plant", back_populates="user", cascade="all, delete-orphan")

class Strategy(Base):
    __tablename__ = "strategies"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    title: Mapped[str] = mapped_column(String)
    color: Mapped[str] = mapped_column(String, default="#22c55e")
    icon: Mapped[str] = mapped_column(String, default="book")
    order_index: Mapped[int] = mapped_column(Integer, default=0)

    user = relationship("User", back_populates="strategies")

class TaskTemplate(Base):
    __tablename__ = "task_templates"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    strategy_id: Mapped[int] = mapped_column(ForeignKey("strategies.id"), nullable=True)

    title: Mapped[str] = mapped_column(String)
    category: Mapped[str] = mapped_column(String, default="general")
    difficulty: Mapped[int] = mapped_column(Integer, default=1)  # 1..5
    effort_min_est: Mapped[int] = mapped_column(Integer, default=25)
    mode: Mapped[str] = mapped_column(String, default="timer")  # checkbox|timer|counter
    repeat_rule: Mapped[str] = mapped_column(String, default="DAILY")  # упрощённо
    planned_windows: Mapped[str] = mapped_column(String, default="08:00-22:00")
    anti_abuse_tier: Mapped[int] = mapped_column(Integer, default=2)
    is_paused: Mapped[bool] = mapped_column(Boolean, default=False)

    user = relationship("User", back_populates="task_templates")

class TaskInstance(Base):
    __tablename__ = "task_instances"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    template_id: Mapped[int] = mapped_column(ForeignKey("task_templates.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))

    date: Mapped[str] = mapped_column(String, index=True)  # YYYY-MM-DD по TZ юзера
    status: Mapped[str] = mapped_column(String, default="planned")  # planned|started|done|skipped|failed
    weight_cost: Mapped[float] = mapped_column(Float, default=1.0)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    focus_minutes: Mapped[int | None] = mapped_column(Integer, nullable=True)
    proof: Mapped[dict | None] = mapped_column(JSON, nullable=True)

    __table_args__ = (UniqueConstraint("template_id", "user_id", "date", name="uq_task_instance"),)

class DailySummary(Base):
    __tablename__ = "daily_summaries"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    date: Mapped[str] = mapped_column(String, index=True)  # YYYY-MM-DD
    progress: Mapped[float] = mapped_column(Float, default=0.0)
    xp_awarded: Mapped[int] = mapped_column(Integer, default=0)
    gp_awarded: Mapped[int] = mapped_column(Integer, default=0)
    coins_awarded: Mapped[int] = mapped_column(Integer, default=0)
    late_change: Mapped[bool] = mapped_column(Boolean, default=False)

class PlantSpecies(Base):
    __tablename__ = "plant_species"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String, unique=True)
    rarity: Mapped[str] = mapped_column(String, default="common")
    gp_stage_thresholds: Mapped[dict] = mapped_column(JSON, default=lambda: {"1": 20, "2": 60, "3": 120})
    price: Mapped[int] = mapped_column(Integer, default=10)
    growth_factor: Mapped[float] = mapped_column(Float, default=1.0)

class Plant(Base):
    __tablename__ = "plants"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    species_id: Mapped[int] = mapped_column(ForeignKey("plant_species.id"))
    slot_index: Mapped[int] = mapped_column(Integer)
    stage: Mapped[int] = mapped_column(Integer, default=0)
    health: Mapped[int] = mapped_column(Integer, default=100)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    user = relationship("User", back_populates="plants")
