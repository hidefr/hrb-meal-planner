import json
from pathlib import Path
from typing import List, Optional, Dict
import datetime
import uuid
from app.config import settings
from app.models.schemas import (
    MealPlan, MealSlot, Recipe, Ingredient, GroceryList, GroceryItem,
    ChatMessage, Conversation, ConversationSummary, MealHistoryEntry,
    ClearedGroceryItem, UserSettings
)

class Storage:
    def __init__(self):
        self.data_dir = settings.data_dir
        self.meal_plan_file = self.data_dir / "meal_plan.json"
        self.grocery_list_file = self.data_dir / "grocery_list.json"
        self.chat_history_file = self.data_dir / "chat_history.json" # legacy fallback
        self.conversations_file = self.data_dir / "conversations.json"
        self.meal_history_file = self.data_dir / "meal_history.json"
        self.cleared_grocery_file = self.data_dir / "cleared_grocery_history.json"
        self.settings_file = self.data_dir / "settings.json"
        self._ensure_init()

    def _ensure_init(self):
        if not self.meal_plan_file.exists():
            default_plan = self._create_default_meal_plan()
            self.save_meal_plan(default_plan)
        
        if not self.grocery_list_file.exists():
            default_grocery = GroceryList(items=[])
            self.save_grocery_list(default_grocery)
            
        if not self.meal_history_file.exists():
            self._save_raw_json(self.meal_history_file, [])

        if not self.cleared_grocery_file.exists():
            self._save_raw_json(self.cleared_grocery_file, [])

        if not self.settings_file.exists():
            self.save_settings(UserSettings())

        if not self.conversations_file.exists():
            # Migrate legacy chat_history.json if present
            initial_convs = []
            if self.chat_history_file.exists():
                try:
                    with open(self.chat_history_file, "r", encoding="utf-8") as f:
                        data = json.load(f)
                    if data:
                        legacy_messages = [ChatMessage(**m) for m in data]
                        initial_convs.append(Conversation(
                            id="default",
                            title="Initial Conversation",
                            messages=legacy_messages
                        ))
                except Exception:
                    pass
            if not initial_convs:
                initial_convs.append(Conversation(
                    id=str(uuid.uuid4()),
                    title="Welcome to TasteCraft",
                    messages=[]
                ))
            self._save_conversations(initial_convs)

    def _save_raw_json(self, path: Path, data: any):
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2)

    def _read_raw_json(self, path: Path, default: any = None) -> any:
        try:
            if not path.exists():
                return default
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return default

    # ==================== User Settings ====================
    def get_settings(self) -> UserSettings:
        data = self._read_raw_json(self.settings_file)
        if data:
            try:
                if "available_preferences" not in data:
                    data["available_preferences"] = [
                        "Quick meals under 30 mins",
                        "One-pot or sheet-pan meals",
                        "Healthy & fresh veggies",
                        "High protein",
                        "Low-carb comfort",
                        "Budget-friendly",
                        "Kid-friendly",
                        "Comfort food"
                    ]
                    # Also include any active preferences not in the default list
                    for p in data.get("preferences", []):
                        if p not in data["available_preferences"]:
                            data["available_preferences"].append(p)
                return UserSettings(**data)
            except Exception:
                pass
        default_s = UserSettings()
        self.save_settings(default_s)
        return default_s

    def save_settings(self, user_settings: UserSettings) -> UserSettings:
        self._save_raw_json(self.settings_file, user_settings.model_dump())
        return user_settings

    # ==================== Meal Plan ====================
    def _create_default_meal_plan(self) -> MealPlan:
        days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
        slots = [MealSlot(day_of_week=d, meal_type="dinner") for d in days]
        return MealPlan(
            week_title="Weekly Dinners",
            slots=slots,
            notes="Ready to plan! Tell the AI what you feel like having this week."
        )

    def get_meal_plan(self) -> MealPlan:
        data = self._read_raw_json(self.meal_plan_file)
        if data:
            try:
                return MealPlan(**data)
            except Exception:
                pass
        plan = self._create_default_meal_plan()
        self.save_meal_plan(plan)
        return plan

    def save_meal_plan(self, plan: MealPlan):
        plan.updated_at = datetime.datetime.now().isoformat()
        with open(self.meal_plan_file, "w", encoding="utf-8") as f:
            f.write(plan.model_dump_json(indent=2))

        # Log any planned recipes to meal history automatically
        for slot in plan.slots:
            if slot.recipe:
                self.record_meal_to_history(slot.recipe)

    # ==================== Meal History (Last 50 + Pinned) ====================
    def get_meal_history(self) -> List[MealHistoryEntry]:
        data = self._read_raw_json(self.meal_history_file, [])
        entries = []
        for item in data:
            try:
                entries.append(MealHistoryEntry(**item))
            except Exception:
                pass
        # Return pinned items first, then sorted by last_planned desc
        entries.sort(key=lambda x: (not x.pinned, x.last_planned), reverse=False)
        # To order pinned first, but within pinned sort newest first:
        pinned = sorted([e for e in entries if e.pinned], key=lambda x: x.last_planned, reverse=True)
        unpinned = sorted([e for e in entries if not e.pinned], key=lambda x: x.last_planned, reverse=True)
        return pinned + unpinned

    def record_meal_to_history(self, recipe: Recipe) -> MealHistoryEntry:
        history = self.get_meal_history()
        now_str = datetime.datetime.now().isoformat()

        # Check if already exists in history (by title or recipe id)
        existing = next((e for e in history if e.recipe.title.strip().lower() == recipe.title.strip().lower()), None)

        if existing:
            existing.recipe = recipe
            existing.last_planned = now_str
            existing.times_planned += 1
            entry = existing
        else:
            entry = MealHistoryEntry(
                recipe=recipe,
                first_planned=now_str,
                last_planned=now_str,
                times_planned=1,
                pinned=False
            )
            history.insert(0, entry)

        # Enforce history limit: keep pinned permanently, keep up to 50 unpinned
        pinned_items = [e for e in history if e.pinned]
        unpinned_items = [e for e in history if not e.pinned]
        # Keep newest 50 unpinned
        unpinned_items = sorted(unpinned_items, key=lambda x: x.last_planned, reverse=True)[:50]

        combined = pinned_items + unpinned_items
        self._save_raw_json(self.meal_history_file, [e.model_dump() for e in combined])
        return entry

    def toggle_pin_history(self, entry_id: str) -> Optional[MealHistoryEntry]:
        history = self.get_meal_history()
        target = next((e for e in history if e.id == entry_id or e.recipe.id == entry_id), None)
        if target:
            target.pinned = not target.pinned
            self._save_raw_json(self.meal_history_file, [e.model_dump() for e in history])
            return target
        return None

    def delete_history_item(self, entry_id: str) -> bool:
        history = self.get_meal_history()
        initial_len = len(history)
        history = [e for e in history if e.id != entry_id and e.recipe.id != entry_id]
        if len(history) < initial_len:
            self._save_raw_json(self.meal_history_file, [e.model_dump() for e in history])
            return True
        return False

    def get_history_entry(self, entry_id: str) -> Optional[MealHistoryEntry]:
        history = self.get_meal_history()
        return next((e for e in history if e.id == entry_id or e.recipe.id == entry_id), None)

    # ==================== Grocery List & Cleared History ====================
    def get_grocery_list(self) -> GroceryList:
        data = self._read_raw_json(self.grocery_list_file)
        if data:
            try:
                return GroceryList(**data)
            except Exception:
                pass
        g_list = GroceryList(items=[])
        self.save_grocery_list(g_list)
        return g_list

    def save_grocery_list(self, g_list: GroceryList):
        g_list.updated_at = datetime.datetime.now().isoformat()
        with open(self.grocery_list_file, "w", encoding="utf-8") as f:
            f.write(g_list.model_dump_json(indent=2))

    def update_grocery_item_store(self, item_id: str, store: Optional[str]) -> Optional[GroceryItem]:
        g_list = self.get_grocery_list()
        for item in g_list.items:
            if item.id == item_id:
                item.store = store
                self.save_grocery_list(g_list)
                return item
        return None

    def update_grocery_item_quantity(
        self,
        item_id: str,
        amount: Optional[float] = None,
        have_amount: Optional[float] = None,
        notes: Optional[str] = None
    ) -> Optional[GroceryItem]:
        g_list = self.get_grocery_list()
        for item in g_list.items:
            if item.id == item_id:
                if amount is not None:
                    item.amount = round(amount, 2)
                if have_amount is not None:
                    item.have_amount = round(have_amount, 2) if have_amount > 0 else None
                if notes is not None:
                    item.notes = notes.strip() or None

                # Automatically update checked state based on have_amount
                if item.have_amount is not None and item.have_amount >= item.amount:
                    item.checked = True
                elif item.have_amount is None or item.have_amount == 0:
                    # Not fully acquired
                    pass

                self.save_grocery_list(g_list)
                return item
        return None

    def get_cleared_grocery_history(self) -> List[ClearedGroceryItem]:
        data = self._read_raw_json(self.cleared_grocery_file, [])
        items = []
        for d in data:
            try:
                items.append(ClearedGroceryItem(**d))
            except Exception:
                pass
        return sorted(items, key=lambda x: x.cleared_at, reverse=True)

    def record_cleared_grocery_items(self, cleared: List[GroceryItem]):
        if not cleared:
            return
        history = self.get_cleared_grocery_history()
        now_str = datetime.datetime.now().isoformat()

        for c in cleared:
            # Check if already in cleared history, update cleared_at and store/notes
            existing = next((h for h in history if h.name.lower() == c.name.lower()), None)
            if existing:
                existing.amount = c.amount
                existing.unit = c.unit
                existing.category = c.category
                existing.store = c.store
                existing.notes = c.notes
                existing.cleared_at = now_str
            else:
                history.insert(0, ClearedGroceryItem(
                    name=c.name,
                    amount=c.amount,
                    unit=c.unit,
                    category=c.category,
                    store=c.store,
                    notes=c.notes,
                    cleared_at=now_str
                ))

        # Enforce max 200 items in cleared history
        history = history[:200]
        self._save_raw_json(self.cleared_grocery_file, [h.model_dump() for h in history])

    def clear_checked_grocery_items(self) -> GroceryList:
        g_list = self.get_grocery_list()
        checked = [i for i in g_list.items if i.checked]
        unchecked = [i for i in g_list.items if not i.checked]

        if checked:
            self.record_cleared_grocery_items(checked)
            g_list.items = unchecked
            self.save_grocery_list(g_list)

        return g_list

    def restore_cleared_item(self, cleared_id: str) -> Optional[GroceryItem]:
        history = self.get_cleared_grocery_history()
        target = next((h for h in history if h.id == cleared_id), None)
        if not target:
            return None

        g_list = self.get_grocery_list()
        # Check if item with same name already on active list
        existing = next((i for i in g_list.items if i.name.lower() == target.name.lower() and i.unit.lower() == target.unit.lower()), None)
        if existing:
            existing.amount += target.amount
            if target.store and not existing.store:
                existing.store = target.store
            restored = existing
        else:
            restored = GroceryItem(
                name=target.name,
                amount=target.amount,
                unit=target.unit,
                category=target.category,
                checked=False,
                manual=True,
                notes=target.notes,
                store=target.store
            )
            g_list.items.append(restored)

        self.save_grocery_list(g_list)
        return restored

    # ==================== Conversations & Chat History ====================
    def _read_conversations(self) -> List[Conversation]:
        data = self._read_raw_json(self.conversations_file, [])
        convs = []
        for d in data:
            try:
                convs.append(Conversation(**d))
            except Exception:
                pass
        return sorted(convs, key=lambda c: c.updated_at, reverse=True)

    def _save_conversations(self, convs: List[Conversation]):
        self._save_raw_json(self.conversations_file, [c.model_dump() for c in convs])

    def get_conversations(self) -> List[ConversationSummary]:
        convs = self._read_conversations()
        summaries = []
        for c in convs:
            last_msg = ""
            for m in reversed(c.messages):
                if m.content and m.content.strip():
                    last_msg = m.content[:80] + ("..." if len(m.content) > 80 else "")
                    break
            summaries.append(ConversationSummary(
                id=c.id,
                title=c.title,
                created_at=c.created_at,
                updated_at=c.updated_at,
                message_count=len(c.messages),
                last_message_preview=last_msg or "No messages yet"
            ))
        return summaries

    def get_conversation(self, conv_id: str) -> Optional[Conversation]:
        convs = self._read_conversations()
        return next((c for c in convs if c.id == conv_id), None)

    def create_conversation(self, title: Optional[str] = None) -> Conversation:
        convs = self._read_conversations()
        new_conv = Conversation(
            id=str(uuid.uuid4()),
            title=title.strip() if title and title.strip() else f"Conversation {len(convs) + 1}",
            messages=[]
        )
        convs.insert(0, new_conv)
        self._save_conversations(convs)
        return new_conv

    def add_message_to_conversation(self, conv_id: str, message: ChatMessage) -> Conversation:
        convs = self._read_conversations()
        conv = next((c for c in convs if c.id == conv_id), None)
        if not conv:
            conv = Conversation(id=conv_id, title="New Conversation", messages=[])
            convs.insert(0, conv)

        conv.messages.append(message)
        conv.updated_at = datetime.datetime.now().isoformat()

        # Auto-title conversation on first user message if still default
        if len(conv.messages) <= 2 and message.role == "user" and (conv.title.startswith("New Conversation") or conv.title.startswith("Conversation")):
            cleaned = message.content.strip()
            # Remove punctuation/emojis if practical and shorten to ~30 chars
            clean_title = cleaned[:35].strip()
            if len(cleaned) > 35:
                clean_title += "..."
            conv.title = clean_title

        # Keep last 100 messages per conversation to avoid unbounded files
        if len(conv.messages) > 100:
            conv.messages = conv.messages[-100:]

        self._save_conversations(convs)
        return conv

    def delete_conversation(self, conv_id: str) -> bool:
        convs = self._read_conversations()
        initial_len = len(convs)
        convs = [c for c in convs if c.id != conv_id]
        if len(convs) < initial_len:
            # Ensure at least one conversation exists
            if not convs:
                convs.append(Conversation(title="New Conversation", messages=[]))
            self._save_conversations(convs)
            return True
        return False

    def rename_conversation(self, conv_id: str, new_title: str) -> Optional[Conversation]:
        convs = self._read_conversations()
        conv = next((c for c in convs if c.id == conv_id), None)
        if conv:
            conv.title = new_title.strip() or "Untitled Chat"
            conv.updated_at = datetime.datetime.now().isoformat()
            self._save_conversations(convs)
            return conv
        return None

    # Legacy compatibility methods
    def get_chat_history(self) -> List[ChatMessage]:
        convs = self._read_conversations()
        if convs:
            return convs[0].messages
        return []

    def clear_chat_history(self):
        convs = self._read_conversations()
        if convs:
            convs[0].messages = []
            self._save_conversations(convs)

storage = Storage()
