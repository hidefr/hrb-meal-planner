import json
import logging
import re
from typing import List, Dict, Any, Tuple
from openai import AsyncOpenAI
from app.config import settings
from app.models.schemas import (
    MealPlan, MealSlot, Recipe, Ingredient, GroceryList, GroceryItem,
    ChatMessage, MediaLink
)
from app.services.grocery_engine import sync_grocery_list_from_meal_plan, guess_category
from app.services.media_search import search_recipe_media

logger = logging.getLogger(__name__)

SYSTEM_PROMPT = """You are TasteCraft, an expert culinary AI co-pilot and weekly meal planner for a household.
Your mission is to help the couple effortlessly plan delicious, realistic meals for the week, tailor recipes to their exact cravings/constraints (e.g., one-pot, under 30 minutes, low-carb, pantry ingredients, kid-friendly), and generate a clean, consolidated grocery list.

CURRENT MEAL PLAN:
{current_meal_plan}

CURRENT GROCERY LIST:
{current_grocery_list}

RULES & BEHAVIOR:
1. CONVERSATIONAL & PRACTICAL: Start by listening to what they crave, how busy certain days are, dietary preferences, or ingredients to use up.
2. RECOMMEND & CONFIRM: You can suggest a full or partial menu. When the user approves or asks to set meals, use your tools to update the actual meal plan!
3. RECIPE TAILORING: When setting or tweaking recipes, make sure ingredients have realistic amounts, units (e.g. 'g', 'cup', 'tbsp', 'cloves', 'can', 'item'), and clear step-by-step instructions.
4. GROCERY SYNC: Setting meals will automatically consolidate ingredients into the grocery list categorized by store aisle (Produce, Meat, Dairy, etc.). If the user asks for snacks, drinks, or pantry items, use 'add_grocery_item'.
5. MEDIA ENRICHMENT: The system automatically searches for real-world cooking videos (YouTube) and appetizing photos for every recipe you create. Mention that videos and guides will be attached to their recipe cards!
6. TONE: Warm, culinary-savvy, concise, and proactive.
"""

TOOLS_DEFINITIONS = [
    {
        "type": "function",
        "function": {
            "name": "set_meal_slot",
            "description": "Sets or replaces a meal on a specific day of the week with a tailored recipe.",
            "parameters": {
                "type": "object",
                "properties": {
                    "day_of_week": {
                        "type": "string",
                        "description": "Day of the week (e.g. 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday')"
                    },
                    "title": {"type": "string", "description": "Title of the recipe"},
                    "description": {"type": "string", "description": "Brief appetizing description"},
                    "prep_time_mins": {"type": "integer", "description": "Estimated prep time in minutes"},
                    "cook_time_mins": {"type": "integer", "description": "Estimated cook time in minutes"},
                    "servings": {"type": "integer", "description": "Number of servings (default 2)"},
                    "tags": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Tags e.g. ['one-pot', '30-min', 'high-protein']"
                    },
                    "ingredients": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string", "description": "Ingredient name"},
                                "amount": {"type": "number", "description": "Numeric quantity"},
                                "unit": {"type": "string", "description": "Unit (e.g., 'g', 'cloves', 'tbsp', 'cup', 'item', 'can')"},
                                "category": {"type": "string", "description": "Produce, Meat & Seafood, Dairy & Refrigerated, Bakery, Pantry, Spices & Seasonings, Frozen, etc."},
                                "notes": {"type": "string", "description": "Optional notes like diced, minced"}
                            },
                            "required": ["name", "amount", "unit"]
                        },
                        "description": "List of ingredients needed for this recipe"
                    },
                    "instructions": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Step-by-step cooking instructions"
                    }
                },
                "required": ["day_of_week", "title", "ingredients", "instructions"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "clear_meal_slot",
            "description": "Clears a meal slot for a specific day of the week.",
            "parameters": {
                "type": "object",
                "properties": {
                    "day_of_week": {"type": "string", "description": "Day of the week to clear"}
                },
                "required": ["day_of_week"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "add_grocery_item",
            "description": "Directly adds a grocery or household item to the shopping list (for snacks, pantry staples, toiletries, etc.).",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Item name, e.g. 'Oat Milk'"},
                    "amount": {"type": "number", "description": "Quantity"},
                    "unit": {"type": "string", "description": "Unit e.g. 'carton', 'bottle', 'item'"},
                    "category": {"type": "string", "description": "Aisle category"},
                    "notes": {"type": "string", "description": "Optional notes"}
                },
                "required": ["name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "remove_grocery_item",
            "description": "Removes an item from the grocery list by name.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Name of item to remove"}
                },
                "required": ["name"]
            }
        }
    }
]

def format_meal_plan_summary(plan: MealPlan) -> str:
    lines = []
    for slot in plan.slots:
        if slot.recipe:
            lines.append(f"- {slot.day_of_week} ({slot.meal_type}): {slot.recipe.title} ({slot.recipe.prep_time_mins + slot.recipe.cook_time_mins} mins)")
        else:
            lines.append(f"- {slot.day_of_week} ({slot.meal_type}): [Not planned]")
    return "\n".join(lines)

def format_grocery_summary(grocery: GroceryList) -> str:
    if not grocery.items:
        return "[Empty list]"
    by_cat: Dict[str, List[str]] = {}
    for item in grocery.items:
        check = "x" if item.checked else " "
        entry = f"[{check}] {item.amount} {item.unit} {item.name}"
        by_cat.setdefault(item.category, []).append(entry)
    
    out = []
    for cat, items in by_cat.items():
        out.append(f"{cat}: " + ", ".join(items[:6]) + ("..." if len(items) > 6 else ""))
    return "\n".join(out)

class LLMAgent:
    def __init__(self):
        self.client = AsyncOpenAI(
            base_url=settings.llm_base_url,
            api_key=settings.llm_api_key
        )
        self.model = settings.llm_model

    async def execute_tool_call(
        self,
        name: str,
        arguments: dict,
        meal_plan: MealPlan,
        grocery_list: GroceryList
    ) -> Tuple[str, List[str]]:
        """
        Executes a tool call and returns (result_text, list_of_human_actions)
        """
        actions = []
        
        if name == "set_meal_slot":
            day = arguments.get("day_of_week", "").strip().capitalize()
            title = arguments.get("title", "Untitled Recipe")
            
            # Build ingredients
            raw_ings = arguments.get("ingredients", [])
            ingredients = []
            for raw in raw_ings:
                cat = raw.get("category") or guess_category(raw.get("name", ""))
                ingredients.append(Ingredient(
                    name=raw.get("name", "Ingredient"),
                    amount=float(raw.get("amount", 1.0)),
                    unit=raw.get("unit", "item"),
                    category=cat,
                    notes=raw.get("notes")
                ))

            # Build recipe
            recipe = Recipe(
                title=title,
                description=arguments.get("description", ""),
                prep_time_mins=int(arguments.get("prep_time_mins", 15)),
                cook_time_mins=int(arguments.get("cook_time_mins", 25)),
                servings=int(arguments.get("servings", 2)),
                tags=arguments.get("tags", []),
                ingredients=ingredients,
                instructions=arguments.get("instructions", [])
            )

            # Enrich with real videos & web links in background
            try:
                media = await search_recipe_media(recipe.title, recipe.tags)
                recipe.media_links = media
            except Exception as e:
                logger.warning(f"Error enriching recipe '{title}': {e}")

            # Assign to slot
            found = False
            for slot in meal_plan.slots:
                if slot.day_of_week.lower() == day.lower():
                    slot.recipe = recipe
                    found = True
                    break
            if not found:
                meal_plan.slots.append(MealSlot(day_of_week=day, recipe=recipe))

            action_msg = f"Set {day} Dinner to '{title}'"
            actions.append(action_msg)
            return f"Success: Set {day} to {title} with {len(ingredients)} ingredients and attached cooking guides.", actions

        elif name == "clear_meal_slot":
            day = arguments.get("day_of_week", "").strip().capitalize()
            for slot in meal_plan.slots:
                if slot.day_of_week.lower() == day.lower():
                    slot.recipe = None
            action_msg = f"Cleared {day} meal slot"
            actions.append(action_msg)
            return f"Success: Cleared {day}.", actions

        elif name == "add_grocery_item":
            name_val = arguments.get("name", "").strip().title()
            amount = float(arguments.get("amount", 1.0))
            unit = arguments.get("unit", "item")
            category = arguments.get("category") or guess_category(name_val)
            notes = arguments.get("notes")

            # Check if exists
            exists = False
            for item in grocery_list.items:
                if item.name.lower() == name_val.lower() and item.unit.lower() == unit.lower():
                    item.amount += amount
                    exists = True
                    break
            
            if not exists:
                grocery_list.items.append(GroceryItem(
                    name=name_val,
                    amount=round(amount, 2),
                    unit=unit,
                    category=category,
                    manual=True,
                    notes=notes
                ))
            
            action_msg = f"Added {amount} {unit} '{name_val}' to grocery list"
            actions.append(action_msg)
            return f"Success: Added {name_val} to shopping list.", actions

        elif name == "remove_grocery_item":
            name_val = arguments.get("name", "").strip().lower()
            orig_len = len(grocery_list.items)
            grocery_list.items = [i for i in grocery_list.items if i.name.lower() != name_val]
            if len(grocery_list.items) < orig_len:
                action_msg = f"Removed '{name_val}' from grocery list"
                actions.append(action_msg)
                return f"Success: Removed {name_val}.", actions
            return f"Item '{name_val}' was not found in grocery list.", actions

        return f"Unknown tool: {name}", actions

    async def chat(
        self,
        user_message: str,
        history: List[ChatMessage],
        meal_plan: MealPlan,
        grocery_list: GroceryList
    ) -> Tuple[str, List[str], MealPlan, GroceryList]:
        """
        Processes a user message, runs tool calls against Hermes/LLM,
        and returns (reply_text, actions_performed, updated_plan, updated_grocery)
        """
        system_content = SYSTEM_PROMPT.format(
            current_meal_plan=format_meal_plan_summary(meal_plan),
            current_grocery_list=format_grocery_summary(grocery_list)
        )

        messages = [{"role": "system", "content": system_content}]
        for msg in history[-10:]:
            if msg.role in ["user", "assistant"]:
                messages.append({"role": msg.role, "content": msg.content})
        
        messages.append({"role": "user", "content": user_message})

        actions_performed: List[str] = []
        final_reply = ""

        try:
            # 1. Primary path: Call LLM with native function calling
            response = await self.client.chat.completions.create(
                model=self.model,
                messages=messages,
                tools=TOOLS_DEFINITIONS,
                tool_choice="auto",
                temperature=0.7
            )

            response_message = response.choices[0].message

            # Check if model produced tool calls
            if response_message.tool_calls:
                for tool_call in response_message.tool_calls:
                    fn_name = tool_call.function.name
                    try:
                        args = json.loads(tool_call.function.arguments)
                    except Exception:
                        args = {}
                    
                    _, acts = await self.execute_tool_call(
                        name=fn_name,
                        arguments=args,
                        meal_plan=meal_plan,
                        grocery_list=grocery_list
                    )
                    actions_performed.extend(acts)

                # Re-sync grocery list with meal plan
                grocery_list = sync_grocery_list_from_meal_plan(meal_plan, grocery_list)

                # If the assistant also provided conversational text, use it; otherwise provide a friendly summary
                if response_message.content and response_message.content.strip():
                    final_reply = response_message.content.strip()
                else:
                    final_reply = f"I've updated your plan: {', '.join(actions_performed)}. Recipes and grocery list are synced!"

            else:
                final_reply = response_message.content or "Let me know what you'd like to adjust or add to the plan!"

        except Exception as e:
            logger.error(f"Error calling LLM at {settings.llm_base_url}: {e}")
            final_reply = (
                f"I received your message: \"{user_message}\".\n\n"
                f"*(Note: Could not reach LLM endpoint at `{settings.llm_base_url}`. "
                f"Make sure your Hermes agent or local model server is running, or set `LLM_BASE_URL` and `LLM_API_KEY` in `.env`)*"
            )

        return final_reply, actions_performed, meal_plan, grocery_list

llm_agent = LLMAgent()
