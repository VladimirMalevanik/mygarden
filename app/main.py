from fastapi import FastAPI
from .database import Base, engine
from . import models
from .config import settings
from .scheduler import start_scheduler

from .routers_auth import router as auth_router
from .routers_me import router as me_router
from .routers_strategies import router as strategies_router
from .routers_tasks import router as tasks_router
from .routers_garden import router as garden_router
from .routers_economy import router as economy_router
from .routers_daily import router as daily_router

def create_app():
    Base.metadata.create_all(bind=engine)
    app = FastAPI(title=settings.APP_NAME, debug=settings.DEBUG)
    app.include_router(auth_router)
    app.include_router(me_router)
    app.include_router(strategies_router)
    app.include_router(tasks_router)
    app.include_router(garden_router)
    app.include_router(economy_router)
    app.include_router(daily_router)
    start_scheduler()
    return app

app = create_app()
