from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .database import get_db
from . import models, schemas
from .routers_me import get_user
from .services import day_progress, today_str

router = APIRouter(prefix="/api/v1", tags=["Daily/Summaries"])

@router.get("/daily/summary", response_model=schemas.DailySummaryOut)
def daily_summary(date: str | None = None, db: Session = Depends(get_db)):
    u = get_user(db)
    if not date:
        date = today_str(u.tz)
    prog = day_progress(db, u, date)
    s = db.query(models.DailySummary).filter_by(user_id=u.id, date=date).first()
    if not s:
        s = models.DailySummary(user_id=u.id, date=date, progress=prog)
        db.add(s); db.commit(); db.refresh(s)
    return schemas.DailySummaryOut(
        date=date,
        progress=s.progress,
        xp_awarded=s.xp_awarded,
        gp_awarded=s.gp_awarded,
        coins_awarded=s.coins_awarded
    )

@router.get("/streak")
def get_streak(db: Session = Depends(get_db)):
    u = get_user(db)
    return {"streak": u.streak}
