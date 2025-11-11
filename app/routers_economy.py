from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from .database import get_db
from . import models
from .routers_me import get_user

router = APIRouter(prefix="/api/v1", tags=["Economy/Shop/Inventory"])

@router.get("/economy/wallet")
def wallet(db: Session = Depends(get_db)):
    u = get_user(db)
    return {"coins": u.coins, "xp": u.xp, "gp": u.gp}

@router.get("/shop/catalog")
def shop_catalog(db: Session = Depends(get_db)):
    items = [{"id": s.id, "type": "seed", "name": s.name, "price": s.price, "rarity": s.rarity}
             for s in db.query(models.PlantSpecies).all()]
    return items

@router.post("/shop/purchase")
def purchase(item_id: int, qty: int = 1, db: Session = Depends(get_db)):
    # MVP: монеты не списываем/инвентарь не ведём; заглушка
    u = get_user(db)
    return {"ok": True, "item_id": item_id, "qty": qty}
    
@router.get("/inventory")
def inventory():
    # MVP: пусто
    return {"items": []}
