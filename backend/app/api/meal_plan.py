from fastapi import APIRouter, HTTPException
from typing import List, Optional
from app.models.schemas import (
    MealPlan, MealSlot, Recipe, MealHistoryEntry,
    AISuggestDayRequest, AIPlanWeekRequest, ApplyHistoryMealRequest
)
from app.db.storage import storage
from app.services.grocery_engine import sync_grocery_list_from_meal_plan
from app.services.llm_agent import llm_agent

router = APIRouter(prefix="/api/meal-plan", tags=["meal-plan"])

@router.get("", response_model=MealPlan)
async def get_meal_plan():
    return storage.get_meal_plan()

@router.put("", response_model=MealPlan)
async def update_meal_plan(plan: MealPlan):
    storage.save_meal_plan(plan)
    # Sync groceries
    current_grocery = storage.get_grocery_list()
    updated_grocery = sync_grocery_list_from_meal_plan(plan, current_grocery)
    storage.save_grocery_list(updated_grocery)
    return plan

@router.post("/slots/{day}", response_model=MealPlan)
async def update_slot(day: str, recipe: Recipe):
    plan = storage.get_meal_plan()
    found = False
    for slot in plan.slots:
        if slot.day_of_week.lower() == day.lower():
            slot.recipe = recipe
            found = True
            break
    if not found:
        plan.slots.append(MealSlot(day_of_week=day.capitalize(), recipe=recipe))
    
    storage.save_meal_plan(plan)
    current_grocery = storage.get_grocery_list()
    updated_grocery = sync_grocery_list_from_meal_plan(plan, current_grocery)
    storage.save_grocery_list(updated_grocery)
    return plan

@router.delete("/slots/{day}", response_model=MealPlan)
async def clear_slot(day: str):
    plan = storage.get_meal_plan()
    for slot in plan.slots:
        if slot.day_of_week.lower() == day.lower():
            slot.recipe = None
            break
    storage.save_meal_plan(plan)
    current_grocery = storage.get_grocery_list()
    updated_grocery = sync_grocery_list_from_meal_plan(plan, current_grocery)
    storage.save_grocery_list(updated_grocery)
    return plan

@router.post("/reset", response_model=MealPlan)
async def reset_meal_plan():
    days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    new_plan = MealPlan(
        week_title="Weekly Dinners",
        slots=[MealSlot(day_of_week=d, meal_type="dinner") for d in days]
    )
    storage.save_meal_plan(new_plan)
    current_grocery = storage.get_grocery_list()
    updated_grocery = sync_grocery_list_from_meal_plan(new_plan, current_grocery)
    storage.save_grocery_list(updated_grocery)
    return new_plan

# ==================== Meal History Endpoints ====================

@router.get("/history", response_model=List[MealHistoryEntry])
async def get_history():
    return storage.get_meal_history()

@router.post("/history/{entry_id}/pin", response_model=MealHistoryEntry)
async def toggle_pin_history(entry_id: str):
    entry = storage.toggle_pin_history(entry_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Meal history entry not found")
    return entry

@router.delete("/history/{entry_id}")
async def delete_history_item(entry_id: str):
    success = storage.delete_history_item(entry_id)
    if not success:
        raise HTTPException(status_code=404, detail="Meal history entry not found")
    return {"status": "deleted", "id": entry_id}

@router.post("/history/apply", response_model=MealPlan)
async def apply_history_meal(req: ApplyHistoryMealRequest):
    entry = storage.get_history_entry(req.recipe_id)
    if not entry:
        raise HTTPException(status_code=404, detail="Historical meal not found")

    plan = storage.get_meal_plan()
    found = False
    for slot in plan.slots:
        if slot.day_of_week.lower() == req.day_of_week.lower():
            slot.recipe = entry.recipe
            found = True
            break
    if not found:
        plan.slots.append(MealSlot(day_of_week=req.day_of_week.capitalize(), recipe=entry.recipe))

    storage.save_meal_plan(plan)
    current_grocery = storage.get_grocery_list()
    updated_grocery = sync_grocery_list_from_meal_plan(plan, current_grocery)
    storage.save_grocery_list(updated_grocery)
    return plan

# ==================== AI One-Click Suggestion & Week Planner ====================

@router.post("/ai-suggest-day", response_model=MealPlan)
async def ai_suggest_day(req: AISuggestDayRequest):
    plan = storage.get_meal_plan()
    user_settings = storage.get_settings()
    
    preferences = req.preferences if req.preferences is not None else user_settings.preferences
    custom_notes = req.custom_prompt or user_settings.custom_notes

    recipe = await llm_agent.suggest_recipe_for_day(
        day_of_week=req.day_of_week,
        preferences=preferences,
        current_plan=plan,
        custom_prompt=custom_notes
    )

    found = False
    for slot in plan.slots:
        if slot.day_of_week.lower() == req.day_of_week.lower():
            slot.recipe = recipe
            found = True
            break
    if not found:
        plan.slots.append(MealSlot(day_of_week=req.day_of_week.capitalize(), recipe=recipe))

    storage.save_meal_plan(plan)
    current_grocery = storage.get_grocery_list()
    updated_grocery = sync_grocery_list_from_meal_plan(plan, current_grocery)
    storage.save_grocery_list(updated_grocery)
    return plan

@router.post("/ai-plan-week", response_model=MealPlan)
async def ai_plan_week(req: AIPlanWeekRequest):
    plan = storage.get_meal_plan()
    user_settings = storage.get_settings()

    preferences = req.preferences if req.preferences is not None else user_settings.preferences
    custom_notes = req.custom_prompt or user_settings.custom_notes

    planned_pairs = await llm_agent.plan_entire_week(
        preferences=preferences,
        current_plan=plan,
        custom_prompt=custom_notes,
        overwrite_all=req.overwrite_all
    )

    for day_name, recipe in planned_pairs:
        found = False
        for slot in plan.slots:
            if slot.day_of_week.lower() == day_name.lower():
                slot.recipe = recipe
                found = True
                break
        if not found:
            plan.slots.append(MealSlot(day_of_week=day_name.capitalize(), recipe=recipe))

    storage.save_meal_plan(plan)
    current_grocery = storage.get_grocery_list()
    updated_grocery = sync_grocery_list_from_meal_plan(plan, current_grocery)
    storage.save_grocery_list(updated_grocery)
    return plan
