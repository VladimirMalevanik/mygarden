from pydantic import BaseModel, Field
from typing import Optional, List, Literal, Dict

class UserOut(BaseModel):
    id: int
    tz: str
    locale: str
    streak: int
    coins: int
    xp: int
    gp: int
    garden_slots: int
    moisture: int
    cleanliness: int
    class Config: from_attributes = True

class HandshakeOut(BaseModel):
    user: UserOut
    garden: Dict
    streak: int

class MePatch(BaseModel):
    tz: Optional[str] = None
    locale: Optional[str] = None

class StrategyIn(BaseModel):
    title: str
    color: str = "#22c55e"
    icon: str = "book"

class StrategyOut(StrategyIn):
    id: int
    class Config: from_attributes = True

class TemplateIn(BaseModel):
    title: str
    category: str = "general"
    difficulty: int = Field(ge=1, le=5, default=1)
    effort_min_est: int = Field(ge=1, default=25)
    mode: Literal["checkbox", "timer", "counter"] = "timer"
    repeat_rule: str = "DAILY"
    planned_windows: str = "08:00-22:00"
    strategy_id: Optional[int] = None

class TemplateOut(TemplateIn):
    id: int
    is_paused: bool = False
    class Config: from_attributes = True

class InstanceOut(BaseModel):
    id: int
    date: str
    status: str
    weight_cost: float
    template_id: int
    class Config: from_attributes = True

class InstanceCompleteIn(BaseModel):
    finished_at: Optional[str] = None
    focus_minutes: Optional[int] = None
    proof: Optional[dict] = None

class CompleteResult(BaseModel):
    xp_awarded: int
    gp_awarded: int
    coins: int
    progress_after: float

class GardenOut(BaseModel):
    slots: int
    moisture: int
    cleanliness: int
    plants: List[dict]

class PlantIn(BaseModel):
    species_id: int
    slot_index: int

class PurchaseIn(BaseModel):
    item_id: int
    qty: int = Field(ge=1, default=1)

class DailySummaryOut(BaseModel):
    date: str
    progress: float
    xp_awarded: int
    gp_awarded: int
    coins_awarded: int
