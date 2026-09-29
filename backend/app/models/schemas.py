from typing import List, Optional, Literal
from pydantic import BaseModel, Field
import uuid
import datetime

class MediaLink(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    type: Literal["video", "recipe_page", "photo"] = "recipe_page"
    title: str
    url: str
    thumbnail_url: Optional[str] = None
    source_name: Optional[str] = None # e.g. "YouTube", "Serious Eats", "TikTok", "Budget Bytes"

class Ingredient(BaseModel):
    name: str
    amount: float = 1.0
    unit: str = "item" # e.g., "g", "ml", "tbsp", "tsp", "cup", "cloves", "can", "lb", "item"
    category: str = "Pantry" # "Produce", "Meat & Seafood", "Dairy & Eggs", "Pantry", "Bakery", "Spices & Condiments", "Frozen"
    notes: Optional[str] = None

class Recipe(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str = ""
    prep_time_mins: int = 15
    cook_time_mins: int = 25
    servings: int = 2
    tags: List[str] = Field(default_factory=list) # e.g. ["one-pot", "30-min", "low-carb", "high-protein"]
    ingredients: List[Ingredient] = Field(default_factory=list)
    instructions: List[str] = Field(default_factory=list)
    media_links: List[MediaLink] = Field(default_factory=list)
    source_reference: Optional[str] = None

class MealSlot(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    day_of_week: str # "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
    meal_type: Literal["dinner", "lunch", "breakfast"] = "dinner"
    recipe: Optional[Recipe] = None
    custom_notes: Optional[str] = None

class MealPlan(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    week_title: str = "This Week's Plan"
    slots: List[MealSlot] = Field(default_factory=list)
    notes: Optional[str] = None
    updated_at: str = Field(default_factory=lambda: datetime.datetime.now().isoformat())

class GroceryItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    amount: float = 1.0
    unit: str = "item"
    category: str = "Pantry"
    checked: bool = False
    recipe_references: List[str] = Field(default_factory=list)
    manual: bool = False
    notes: Optional[str] = None

class GroceryList(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    items: List[GroceryItem] = Field(default_factory=list)
    updated_at: str = Field(default_factory=lambda: datetime.datetime.now().isoformat())

class ChatMessage(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    role: Literal["user", "assistant", "system", "tool"]
    content: str
    timestamp: str = Field(default_factory=lambda: datetime.datetime.now().isoformat())
    tool_calls: Optional[List[dict]] = None
    tool_call_id: Optional[str] = None
    applied_actions: Optional[List[str]] = None # Human-readable badges like ["Updated Tuesday Dinner", "Added 5 items to grocery list"]

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None

class ChatResponse(BaseModel):
    reply: str
    actions_performed: List[str] = Field(default_factory=list)
    meal_plan: MealPlan
    grocery_list: GroceryList
