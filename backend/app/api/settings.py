from fastapi import APIRouter
from app.models.schemas import UserSettings
from app.db.storage import storage

router = APIRouter(prefix="/api/settings", tags=["settings"])

@router.get("", response_model=UserSettings)
async def get_settings():
    return storage.get_settings()

@router.post("", response_model=UserSettings)
async def update_settings(new_settings: UserSettings):
    return storage.save_settings(new_settings)
