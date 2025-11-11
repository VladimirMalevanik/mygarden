from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .database import get_db
from . import models, schemas
from .routers_me import get_user

router = APIRouter(prefix="/api/v1/strategies", tags=["Strategies"])

@router.get("", response_model=list[schemas.StrategyOut])
def list_strats(db: Session = Depends(get_db)):
    u = get_user(db)
    return db.query(models.Strategy).filter_by(user_id=u.id).order_by(models.Strategy.order_index).all()

@router.post("", response_model=schemas.StrategyOut)
def create_strat(payload: schemas.StrategyIn, db: Session = Depends(get_db)):
    u = get_user(db)
    s = models.Strategy(user_id=u.id, title=payload.title, color=payload.color, icon=payload.icon)
    db.add(s); db.commit(); db.refresh(s)
    return s
