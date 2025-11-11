from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .database import get_db
from . import models, schemas

router = APIRouter(prefix="/api/v1", tags=["Profile"])

def get_user(db: Session) -> models.User:
    # в реальном проекте — аутентификация по сессии/токену; тут — берём первого для MVP
    u = db.query(models.User).first()
    if not u:
        raise HTTPException(401, "No user in DB. Call /tma/handshake first.")
    return u

@router.get("/me", response_model=schemas.UserOut)
def me(db: Session = Depends(get_db)):
    return get_user(db)

@router.patch("/me", response_model=schemas.UserOut)
def patch_me(payload: schemas.MePatch, db: Session = Depends(get_db)):
    u = get_user(db)
    if payload.tz:
        u.tz = payload.tz
    if payload.locale:
        u.locale = payload.locale
    db.commit()
    db.refresh(u)
    return u
