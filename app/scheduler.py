from apscheduler.schedulers.background import BackgroundScheduler
from sqlalchemy.orm import Session
from .database import SessionLocal
from . import models
from .services import day_progress
from dateutil import tz
from datetime import datetime

def close_day_for_user(db: Session, user: models.User):
    # локальная полночь юзера
    now_local = datetime.utcnow().replace(tzinfo=tz.UTC).astimezone(tz.gettz(user.tz))
    date_str = now_local.strftime("%Y-%m-%d")
    prog = day_progress(db, user, date_str)
    s = db.query(models.DailySummary).filter_by(user_id=user.id, date=date_str).first()
    if not s:
        s = models.DailySummary(user_id=user.id, date=date_str, progress=prog)
        db.add(s)
    else:
        s.progress = prog
    # стрик: >=0.8 → +1, иначе 0
    user.streak = (user.streak + 1) if prog >= 0.8 else 0
    db.commit()

def daily_close_job():
    db = SessionLocal()
    try:
        for u in db.query(models.User).all():
            close_day_for_user(db, u)
    finally:
        db.close()

def start_scheduler():
    sched = BackgroundScheduler()
    # каждые 15 минут проверяем — для MVP, чтобы не возиться с точной полуночью каждого TZ
    sched.add_job(daily_close_job, "interval", minutes=15, id="daily_close")
    sched.start()
    return sched
