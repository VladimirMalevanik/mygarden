from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime
from .database import get_db
from . import models, schemas
from .routers_me import get_user
from .services import ensure_instances_for_user, today_str, award_for_completion, day_progress

router = APIRouter(prefix="/api/v1", tags=["Tasks"])

@router.get("/tasks/templates", response_model=list[schemas.TemplateOut])
def list_templates(db: Session = Depends(get_db)):
    u = get_user(db)
    return db.query(models.TaskTemplate).filter_by(user_id=u.id).all()

@router.post("/tasks/templates", response_model=schemas.TemplateOut)
def create_template(payload: schemas.TemplateIn, db: Session = Depends(get_db)):
    u = get_user(db)
    t = models.TaskTemplate(
        user_id=u.id,
        strategy_id=payload.strategy_id,
        title=payload.title,
        category=payload.category,
        difficulty=payload.difficulty,
        effort_min_est=payload.effort_min_est,
        mode=payload.mode,
        repeat_rule=payload.repeat_rule,
        planned_windows=payload.planned_windows
    )
    db.add(t); db.commit(); db.refresh(t)
    return t

@router.get("/tasks/instances")
def list_instances(date: str | None = None, db: Session = Depends(get_db)):
    u = get_user(db)
    if date is None:
        date = today_str(u.tz)
    ensure_instances_for_user(db, u)
    qs = db.query(models.TaskInstance).filter_by(user_id=u.id, date=date).all()
    return [schemas.InstanceOut.model_validate(x) for x in qs]

@router.post("/tasks/instances/{iid}/start")
def start_instance(iid: int, db: Session = Depends(get_db)):
    u = get_user(db)
    inst = db.query(models.TaskInstance).filter_by(id=iid, user_id=u.id).first()
    if not inst: raise HTTPException(404, "Instance not found")
    if inst.status not in ("planned",):
        raise HTTPException(409, "Already started or finished")
    inst.status = "started"
    inst.started_at = datetime.utcnow()
    db.commit()
    return {"ok": True}

@router.post("/tasks/instances/{iid}/complete", response_model=schemas.CompleteResult)
def complete_instance(iid: int, payload: schemas.InstanceCompleteIn, db: Session = Depends(get_db)):
    u = get_user(db)
    inst = db.query(models.TaskInstance).filter_by(id=iid, user_id=u.id).first()
    if not inst: raise HTTPException(404, "Instance not found")
    if inst.status not in ("started", "planned"):
        raise HTTPException(409, "Already finalized")
    # анти-абьюз: таймер < 60с → нулевой вес
    focus = payload.focus_minutes or 0
    if inst.started_at:
        import math
        secs = (datetime.utcnow() - inst.started_at).total_seconds()
        if secs < 60:
            inst.weight_cost = 0.0
            focus = 0
    inst.status = "done"
    inst.finished_at = datetime.utcnow()
    inst.focus_minutes = focus
    tmpl = db.query(models.TaskTemplate).filter_by(id=inst.template_id).first()
    xp, gp, coins = award_for_completion(tmpl, focus)
    # применяем
    u.xp += xp
    u.gp += gp
    u.coins += coins
    db.commit()
    prog = day_progress(db, u, inst.date)
    return schemas.CompleteResult(xp_awarded=xp, gp_awarded=gp, coins=coins, progress_after=prog)

@router.post("/tasks/instances/{iid}/skip")
def skip_instance(iid: int, reason: dict, db: Session = Depends(get_db)):
    u = get_user(db)
    inst = db.query(models.TaskInstance).filter_by(id=iid, user_id=u.id).first()
    if not inst: raise HTTPException(404, "Instance not found")
    inst.status = "skipped"
    db.commit()
    return {"ok": True}

@router.post("/tasks/instances/{iid}/fail")
def fail_instance(iid: int, reason: dict, db: Session = Depends(get_db)):
    u = get_user(db)
    inst = db.query(models.TaskInstance).filter_by(id=iid, user_id=u.id).first()
    if not inst: raise HTTPException(404, "Instance not found")
    inst.status = "failed"
    db.commit()
    return {"ok": True}
