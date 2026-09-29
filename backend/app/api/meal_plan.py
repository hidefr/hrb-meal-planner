from fastapi import APIRouter, HTTPException
from app.models.schemas import MealPlan, MealSlot, Recipe
from app.db.storage import storage
from app.services.grocery_engine import sync_grocery_list_from_meal_plan

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
