from sqlalchemy.orm import Session
from datetime import datetime
from dateutil import tz
from . import models

def today_str(user_tz: str) -> str:
    now = datetime.utcnow().replace(tzinfo=tz.UTC).astimezone(tz.gettz(user_tz))
    return now.strftime("%Y-%m-%d")

def compute_weight(template: models.TaskTemplate) -> float:
    base = 1.0 + (template.difficulty - 1) * 0.2
    if template.mode == "timer":
        base += min(template.effort_min_est, 120) / 120 * 0.5
    return round(base, 3)

def ensure_instances_for_user(db: Session, user: models.User, horizon_days: int = 2):
    from datetime import timedelta
    # очень простой генератор: на сегодня и завтра, если нет
    base_date = datetime.utcnow().astimezone(tz.gettz(user.tz)).date()
    for delta in range(horizon_days):
        d = base_date + timedelta(days=delta)
        dstr = d.isoformat()
        templates = db.query(models.TaskTemplate).filter_by(user_id=user.id, is_paused=False).all()
        for t in templates:
            exists = db.query(models.TaskInstance).filter_by(user_id=user.id, template_id=t.id, date=dstr).first()
            if not exists:
                inst = models.TaskInstance(
                    user_id=user.id,
                    template_id=t.id,
                    date=dstr,
                    weight_cost=compute_weight(t),
                    status="planned"
                )
                db.add(inst)
    db.commit()

def day_progress(db: Session, user: models.User, date_str: str) -> float:
    q = db.query(models.TaskInstance).filter_by(user_id=user.id, date=date_str)
    total = sum(x.weight_cost for x in q)
    done = sum(x.weight_cost for x in q if x.status == "done")
    return round(done / total, 4) if total > 0 else 0.0

def award_for_completion(template: models.TaskTemplate, focus_minutes: int | None) -> tuple[int,int,int]:
    # простая экономика: XP и GP от веса + бонус за фокус
    weight = compute_weight(template)
    xp = int(10 * weight)
    gp = int(8 * weight)
    if template.mode == "timer" and focus_minutes:
        xp += int(0.5 * focus_minutes)
        gp += int(0.3 * focus_minutes)
    coins = int(weight)  # малыми шагами
    return xp, gp, coins

def stage_up_if_needed(db: Session, user: models.User):
    # суммарный GP юзера приводит к росту первого растения «в очереди»
    plants = db.query(models.Plant).filter_by(user_id=user.id).order_by(models.Plant.slot_index).all()
    if not plants:
        return
    # очень простой триггер: каждое +50 GP повышает стадию первого растения
    # (в реале — пороги вида; здесь — MVP эффектор)
    last = plants[0]
    target_stage = min(3, user.gp // 50)
    if target_stage > last.stage:
        last.stage = target_stage
        db.commit()
