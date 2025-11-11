from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .database import Base, engine
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

    # CORS: разрешаем фронту с любого домена (для продакшена подставь свой домен)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get("/health")
    def health():
        return {"ok": True}

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
