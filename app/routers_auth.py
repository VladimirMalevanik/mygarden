from fastapi import APIRouter, Depends, HTTPException, Header, Form
from sqlalchemy.orm import Session
from .database import get_db
from . import models, schemas
from .utils import validate_tma_init_data

router = APIRouter(prefix="/api/v1/tma", tags=["Auth/TMA"])

@router.post("/handshake", response_model=schemas.HandshakeOut)
def handshake(init_data: str = Form(...), db: Session = Depends(get_db)):
    try:
        data = validate_tma_init_data(init_data)
    except ValueError:
        raise HTTPException(status_code=401, detail={"error_code":"INVALID_INITDATA","message":"Bad initData"})
    tg_user = data.get("user")
    # Telegram присылает user как JSON строку; для MVP допустим tg_user_id в поле "id"
    import json
    uid = None
    try:
        uid = str(json.loads(tg_user)["id"])
    except Exception:
        uid = data.get("user", "unknown")
    user = db.query(models.User).filter_by(tg_user_id=uid).first()
    if not user:
        user = models.User(tg_user_id=uid, locale=data.get("language_code","en"), tz="Europe/Warsaw")
        db.add(user)
        db.commit()
        # дефолтная стратегия
        db.add(models.Strategy(user_id=user.id, title="Учёба", color="#22c55e", icon="book"))
        db.commit()
    # ответ «сад»
    garden = {
        "slots": user.garden_slots,
        "moisture": user.moisture,
        "cleanliness": user.cleanliness,
        "plants": [
            {"id": p.id, "species_id": p.species_id, "slot_index": p.slot_index, "stage": p.stage, "health": p.health}
            for p in user.plants
        ]
    }
    return schemas.HandshakeOut(user=user, garden=garden, streak=user.streak)
