from fastapi import APIRouter, HTTPException
from typing import Optional, List
from pydantic import BaseModel
from app.models.schemas import (
    GroceryList, GroceryItem, ClearedGroceryItem,
    UpdateStoreRequest, UpdateItemQuantityRequest
)
from app.db.storage import storage
from app.services.grocery_engine import sync_grocery_list_from_meal_plan, guess_category

router = APIRouter(prefix="/api/grocery", tags=["grocery"])

class AddItemRequest(BaseModel):
    name: str
    amount: float = 1.0
    unit: str = "item"
    category: Optional[str] = None
    notes: Optional[str] = None
    store: Optional[str] = None

@router.get("", response_model=GroceryList)
async def get_grocery_list():
    return storage.get_grocery_list()

@router.put("", response_model=GroceryList)
async def update_grocery_list(grocery: GroceryList):
    storage.save_grocery_list(grocery)
    return grocery

@router.post("/sync", response_model=GroceryList)
async def sync_grocery():
    plan = storage.get_meal_plan()
    current_grocery = storage.get_grocery_list()
    synced = sync_grocery_list_from_meal_plan(plan, current_grocery)
    storage.save_grocery_list(synced)
    return synced

@router.post("/items", response_model=GroceryList)
async def add_item(req: AddItemRequest):
    grocery = storage.get_grocery_list()
    name_clean = req.name.strip().title()
    cat = req.category or guess_category(name_clean)
    
    # Check if duplicate exists
    for item in grocery.items:
        if item.name.lower() == name_clean.lower() and item.unit.lower() == req.unit.lower():
            item.amount += req.amount
            if req.store and not item.store:
                item.store = req.store
            storage.save_grocery_list(grocery)
            return grocery

    grocery.items.append(GroceryItem(
        name=name_clean,
        amount=round(req.amount, 2),
        unit=req.unit,
        category=cat,
        manual=True,
        notes=req.notes,
        store=req.store
    ))
    storage.save_grocery_list(grocery)
    return grocery

@router.patch("/items/{item_id}/toggle", response_model=GroceryList)
async def toggle_item(item_id: str):
    grocery = storage.get_grocery_list()
    for item in grocery.items:
        if item.id == item_id:
            item.checked = not item.checked
            break
    storage.save_grocery_list(grocery)
    return grocery

@router.patch("/items/{item_id}/store", response_model=GroceryList)
async def update_item_store(item_id: str, req: UpdateStoreRequest):
    storage.update_grocery_item_store(item_id, req.store)
    return storage.get_grocery_list()

@router.patch("/items/{item_id}/quantity", response_model=GroceryList)
async def update_item_quantity(item_id: str, req: UpdateItemQuantityRequest):
    storage.update_grocery_item_quantity(
        item_id=item_id,
        amount=req.amount,
        have_amount=req.have_amount,
        notes=req.notes
    )
    return storage.get_grocery_list()

@router.delete("/items/{item_id}", response_model=GroceryList)
async def delete_item(item_id: str):
    grocery = storage.get_grocery_list()
    grocery.items = [i for i in grocery.items if i.id != item_id]
    storage.save_grocery_list(grocery)
    return grocery

@router.post("/clear-checked", response_model=GroceryList)
async def clear_checked():
    return storage.clear_checked_grocery_items()

# ==================== Cleared History Endpoints ====================

@router.get("/cleared-history", response_model=List[ClearedGroceryItem])
async def get_cleared_history():
    return storage.get_cleared_grocery_history()

@router.post("/cleared-history/{cleared_id}/restore", response_model=GroceryList)
async def restore_cleared_item(cleared_id: str):
    restored = storage.restore_cleared_item(cleared_id)
    if not restored:
        raise HTTPException(status_code=404, detail="Cleared item not found in history")
    return storage.get_grocery_list()
