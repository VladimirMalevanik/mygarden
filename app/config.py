from pydantic_settings import BaseSettings
from pydantic import Field

class Settings(BaseSettings):
    APP_NAME: str = "MyGarden TMA Backend"
    DEBUG: bool = True
    DATABASE_URL: str = "sqlite:///./mygarden.db"
    TELEGRAM_BOT_TOKEN: str = "REPLACE_ME"
    SCHEDULER_TIMEZONE: str = "UTC"   # внутренний TZ джоба; пользовательские TZ учитываются отдельно
    DAILY_CLOSE_HOUR_UTC: int = 0     # fallback, если юзер без TZ

    class Config:
        env_file = ".env"

settings = Settings()
