from fastapi import APIRouter
from pydantic import BaseModel
from typing import List, Optional
from app.models.schemas import MediaLink
from app.services.media_search import search_recipe_media
from app.db.storage import storage

router = APIRouter(prefix="/api/media", tags=["media"])

class SearchMediaRequest(BaseModel):
    recipe_title: str
    tags: Optional[List[str]] = None
    day_of_week: Optional[str] = None # If provided, automatically updates that slot's recipe

@router.post("/search", response_model=List[MediaLink])
async def search_media(req: SearchMediaRequest):
    media = await search_recipe_media(req.recipe_title, req.tags)
    
    # If day_of_week is provided, persist media into that recipe
    if req.day_of_week:
        plan = storage.get_meal_plan()
        for slot in plan.slots:
            if slot.day_of_week.lower() == req.day_of_week.lower() and slot.recipe:
                slot.recipe.media_links = media
                storage.save_meal_plan(plan)
                break

    return media
