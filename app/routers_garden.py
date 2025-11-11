from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from .database import get_db
from . import models, schemas
from .routers_me import get_user
from .services import stage_up_if_needed

router = APIRouter(prefix="/api/v1", tags=["Garden"])

@router.get("/garden", response_model=schemas.GardenOut)
def get_garden(db: Session = Depends(get_db)):
    u = get_user(db)
    plants = [
        {"id": p.id, "species_id": p.species_id, "slot_index": p.slot_index, "stage": p.stage, "health": p.health}
        for p in u.plants
    ]
    return {"slots": u.garden_slots, "moisture": u.moisture, "cleanliness": u.cleanliness, "plants": plants}

@router.post("/garden/plant")
def plant(payload: schemas.PlantIn, db: Session = Depends(get_db)):
    u = get_user(db)
    if payload.slot_index < 0 or payload.slot_index >= u.garden_slots:
        raise HTTPException(422, "Invalid slot")
    occupied = any(p.slot_index == payload.slot_index for p in u.plants)
    if occupied:
        raise HTTPException(409, "Slot occupied")
    species = db.query(models.PlantSpecies).filter_by(id=payload.species_id).first()
    if not species:
        raise HTTPException(404, "Species not found")
    # простая «покупка из инвентаря» опущена; MVP — бесплатно
    p = models.Plant(user_id=u.id, species_id=payload.species_id, slot_index=payload.slot_index, stage=0, health=100)
    db.add(p); db.commit()
    return {"ok": True, "plant_id": p.id}

@router.post("/garden/water")
def water(slot_index: int | None = None, db: Session = Depends(get_db)):
    u = get_user(db)
    u.moisture = min(100, u.moisture + 20)
    # бонус к GP на ближайшее повышение мы эмулируем как мгновенный stage_up чек
    stage_up_if_needed(db, u)
    db.commit()
    return {"ok": True}

@router.post("/garden/clean")
def clean(db: Session = Depends(get_db)):
    u = get_user(db)
    u.cleanliness = min(100, u.cleanliness + 20)
    db.commit()
    return {"ok": True}
