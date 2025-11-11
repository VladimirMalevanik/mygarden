from app.database import Base, engine, SessionLocal
from app import models

Base.metadata.create_all(bind=engine)
db = SessionLocal()
# базовые виды растений
if not db.query(models.PlantSpecies).first():
    db.add_all([
        models.PlantSpecies(name="Sprout", rarity="common", price=5),
        models.PlantSpecies(name="Fern", rarity="common", price=8),
        models.PlantSpecies(name="Lotus", rarity="rare", price=20, growth_factor=1.2),
    ])
    db.commit()
print("Seeded.")
