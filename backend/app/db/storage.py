import json
from pathlib import Path
from typing import List, Optional
import datetime
from app.config import settings
from app.models.schemas import MealPlan, MealSlot, Recipe, Ingredient, GroceryList, GroceryItem, ChatMessage

class Storage:
    def __init__(self):
        self.data_dir = settings.data_dir
        self.meal_plan_file = self.data_dir / "meal_plan.json"
        self.grocery_list_file = self.data_dir / "grocery_list.json"
        self.chat_history_file = self.data_dir / "chat_history.json"
        self._ensure_init()

    def _ensure_init(self):
        if not self.meal_plan_file.exists():
            default_plan = self._create_default_meal_plan()
            self.save_meal_plan(default_plan)
        
        if not self.grocery_list_file.exists():
            default_grocery = GroceryList(items=[])
            self.save_grocery_list(default_grocery)
            
        if not self.chat_history_file.exists():
            self.save_chat_history([])

    def _create_default_meal_plan(self) -> MealPlan:
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        slots = [MealSlot(day_of_week=d, meal_type="dinner") for d in days]
        return MealPlan(
            week_title="Weekly Dinners",
            slots=slots,
            notes="Ready to plan! Tell the AI what you feel like having this week."
        )

    def get_meal_plan(self) -> MealPlan:
        try:
            with open(self.meal_plan_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return MealPlan(**data)
        except Exception:
            plan = self._create_default_meal_plan()
            self.save_meal_plan(plan)
            return plan

    def save_meal_plan(self, plan: MealPlan):
        plan.updated_at = datetime.datetime.now().isoformat()
        with open(self.meal_plan_file, "w", encoding="utf-8") as f:
            f.write(plan.model_dump_json(indent=2))

    def get_grocery_list(self) -> GroceryList:
        try:
            with open(self.grocery_list_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return GroceryList(**data)
        except Exception:
            g_list = GroceryList(items=[])
            self.save_grocery_list(g_list)
            return g_list

    def save_grocery_list(self, g_list: GroceryList):
        g_list.updated_at = datetime.datetime.now().isoformat()
        with open(self.grocery_list_file, "w", encoding="utf-8") as f:
            f.write(g_list.model_dump_json(indent=2))

    def get_chat_history(self) -> List[ChatMessage]:
        try:
            with open(self.chat_history_file, "r", encoding="utf-8") as f:
                data = json.load(f)
                return [ChatMessage(**item) for item in data]
        except Exception:
            return []

    def save_chat_history(self, history: List[ChatMessage]):
        with open(self.chat_history_file, "w", encoding="utf-8") as f:
            json.dump([item.model_dump() for item in history], f, indent=2)

    def add_chat_message(self, message: ChatMessage):
        history = self.get_chat_history()
        history.append(message)
        # Keep last 50 messages to prevent unbounded growth
        if len(history) > 50:
            history = history[-50:]
        self.save_chat_history(history)

    def clear_chat_history(self):
        self.save_chat_history([])

storage = Storage()
