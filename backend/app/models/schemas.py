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

class MealHistoryEntry(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    recipe: Recipe
    first_planned: str = Field(default_factory=lambda: datetime.datetime.now().isoformat())
    last_planned: str = Field(default_factory=lambda: datetime.datetime.now().isoformat())
    times_planned: int = 1
    pinned: bool = False

class GroceryItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    amount: float = 1.0
    have_amount: Optional[float] = None # How much we already have (partial / half used)
    unit: str = "item"
    category: str = "Pantry"
    checked: bool = False
    recipe_references: List[str] = Field(default_factory=list)
    manual: bool = False
    notes: Optional[str] = None
    store: Optional[str] = None # e.g. "Amazon", "Fred Meyer", "Trader Joe's", "Safeway", "New Seasons"

class ClearedGroceryItem(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    name: str
    amount: float = 1.0
    have_amount: Optional[float] = None
    unit: str = "item"
    category: str = "Pantry"
    store: Optional[str] = None
    notes: Optional[str] = None
    cleared_at: str = Field(default_factory=lambda: datetime.datetime.now().isoformat())

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
    image_url: Optional[str] = None

class Conversation(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str = "New Conversation"
    created_at: str = Field(default_factory=lambda: datetime.datetime.now().isoformat())
    updated_at: str = Field(default_factory=lambda: datetime.datetime.now().isoformat())
    messages: List[ChatMessage] = Field(default_factory=list)

class ConversationSummary(BaseModel):
    id: str
    title: str
    created_at: str
    updated_at: str
    message_count: int
    last_message_preview: str

class UserSettings(BaseModel):
    stores: List[str] = Field(default_factory=lambda: [
        "Amazon",
        "Fred Meyer",
        "Trader Joe's",
        "Safeway",
        "New Seasons"
    ])
    available_preferences: List[str] = Field(default_factory=lambda: [
        "Quick meals under 30 mins",
        "One-pot or sheet-pan meals",
        "Healthy & fresh veggies",
        "High protein",
        "Low-carb comfort",
        "Budget-friendly",
        "Kid-friendly",
        "Comfort food"
    ])
    preferences: List[str] = Field(default_factory=lambda: [
        "Quick meals under 30 mins",
        "One-pot or sheet-pan meals",
        "Healthy & fresh veggies"
    ])
    servings: int = 2
    custom_notes: str = ""
    theme: str = "dark" # "dark" (warm espresso) or "light" (warm biscuit cream)

class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    image_data: Optional[str] = None # Base64 data URL or image URL

class ChatResponse(BaseModel):
    reply: str
    conversation_id: str
    actions_performed: List[str] = Field(default_factory=list)
    meal_plan: MealPlan
    grocery_list: GroceryList

class AISuggestDayRequest(BaseModel):
    day_of_week: str
    preferences: Optional[List[str]] = None
    custom_prompt: Optional[str] = None

class AIPlanWeekRequest(BaseModel):
    preferences: Optional[List[str]] = None
    custom_prompt: Optional[str] = None
    overwrite_all: bool = False

class ApplyHistoryMealRequest(BaseModel):
    day_of_week: str
    recipe_id: str

class UpdateStoreRequest(BaseModel):
    store: Optional[str] = None

class UpdateItemQuantityRequest(BaseModel):
    amount: Optional[float] = None
    have_amount: Optional[float] = None
    notes: Optional[str] = None

