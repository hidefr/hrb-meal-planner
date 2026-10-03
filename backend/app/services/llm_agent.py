import json
import logging
import re
from typing import List, Dict, Any, Tuple, Optional
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
4. GROCERY SYNC & STORES: Setting meals will automatically consolidate ingredients into the grocery list categorized by store aisle (Produce, Meat, Dairy, etc.). If the user asks for snacks, drinks, or pantry items, use 'add_grocery_item'. If the user mentions a store (e.g., "tag it to Amazon", "from Trader Joe's", "buy at Fred Meyer"), pass that store in the 'store' parameter of 'add_grocery_item' or call 'tag_grocery_item'. Do NOT put the store name into the 'category' field!
5. MEDIA ENRICHMENT: The system automatically searches for real-world cooking videos (YouTube) and appetizing photos for every recipe you create. Mention that videos and guides will be attached to their recipe cards!
6. TONE: Warm, culinary-savvy, concise, and proactive.
7. MULTIMODAL PHOTO / RECEIPT / RECIPE CARD ANALYSIS:
When the user shares or uploads a photo:
- Dish or restaurant meal photo: Identify the dish, analyze its ingredients, and generate a complete, tailored recipe with accurate measurements and step-by-step instructions. Suggest scheduling it on any day, or call 'set_meal_slot' if a day was specified!
- Handwritten recipe card, cookbook, or menu photo: Extract the title, ingredients, and instructions, and offer to schedule it.
- Grocery receipt photo: Parse the grocery items and call 'add_grocery_item' for each item to sync their kitchen stock or grocery list. If the receipt identifies a store (e.g. Costco, Trader Joe's, Safeway), pass that store in 'store'.
- Fridge or pantry photo: Identify the visible ingredients and recommend 2-3 delicious dinners they can cook immediately!
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
            "description": "Directly adds a grocery or household item to the shopping list (for snacks, pantry staples, toiletries, etc.). Can also assign a store tag.",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Item name, e.g. 'Oat Milk' or 'Peanut Butter'"},
                    "amount": {"type": "number", "description": "Quantity"},
                    "unit": {"type": "string", "description": "Unit e.g. 'carton', 'jar', 'bottle', 'item', 'lb'"},
                    "category": {"type": "string", "description": "Aisle category (Produce, Meat & Seafood, Dairy & Refrigerated, Bakery, Pantry, Spices & Seasonings, Frozen, Other)"},
                    "store": {"type": "string", "description": "Store to purchase from, e.g. 'Amazon', 'Fred Meyer', 'Trader Joe\\'s', 'Safeway', 'New Seasons'"},
                    "notes": {"type": "string", "description": "Optional notes"}
                },
                "required": ["name"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "tag_grocery_item",
            "description": "Tags or updates the store for an existing grocery item (e.g. tag peanut butter to Amazon).",
            "parameters": {
                "type": "object",
                "properties": {
                    "name": {"type": "string", "description": "Name of the item to tag"},
                    "store": {"type": "string", "description": "Store to assign, e.g. 'Amazon', 'Fred Meyer', 'Trader Joe\\'s', 'Safeway', 'New Seasons'"}
                },
                "required": ["name", "store"]
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
            store_val = arguments.get("store")
            if store_val:
                store_val = store_val.strip()
            
            raw_category = arguments.get("category")
            # If the LLM mistakenly put the store into the category field, clean it up
            known_stores = ["amazon", "fred meyer", "trader joe's", "safeway", "new seasons"]
            if raw_category and raw_category.strip().lower() in known_stores:
                if not store_val:
                    store_val = raw_category.strip()
                category = guess_category(name_val)
            elif raw_category:
                category = raw_category.strip()
            else:
                category = guess_category(name_val)

            notes = arguments.get("notes")

            # Check if exists
            exists = False
            for item in grocery_list.items:
                if item.name.lower() == name_val.lower() and item.unit.lower() == unit.lower():
                    item.amount += amount
                    if store_val:
                        item.store = store_val
                    exists = True
                    break
            
            if not exists:
                grocery_list.items.append(GroceryItem(
                    name=name_val,
                    amount=round(amount, 2),
                    unit=unit,
                    category=category,
                    manual=True,
                    store=store_val,
                    notes=notes
                ))
            
            store_suffix = f" tagged to {store_val}" if store_val else ""
            action_msg = f"Added {amount} {unit} '{name_val}'{store_suffix} to grocery list"
            actions.append(action_msg)
            return f"Success: Added {name_val}{store_suffix} to shopping list.", actions

        elif name == "tag_grocery_item":
            name_val = arguments.get("name", "").strip().lower()
            store_val = arguments.get("store", "").strip()
            found = False
            for item in grocery_list.items:
                if name_val in item.name.lower() or item.name.lower() in name_val:
                    item.store = store_val
                    found = True
                    action_msg = f"Tagged '{item.name}' to {store_val}"
                    actions.append(action_msg)
                    return f"Success: Tagged {item.name} to {store_val}.", actions
            
            return f"Could not find an item matching '{arguments.get('name')}' on the grocery list to tag.", actions

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
        grocery_list: GroceryList,
        image_data: Optional[str] = None
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
            if msg.role == "user" and msg.image_url:
                messages.append({
                    "role": "user",
                    "content": [
                        {"type": "text", "text": msg.content or "Uploaded photo"},
                        {"type": "image_url", "image_url": {"url": msg.image_url}}
                    ]
                })
            elif msg.role in ["user", "assistant"]:
                messages.append({"role": msg.role, "content": msg.content})
        
        if image_data:
            text_part = user_message.strip() if user_message and user_message.strip() else "Analyze this photo and create a recipe, meal plan suggestion, or extract receipt details from it."
            messages.append({
                "role": "user",
                "content": [
                    {"type": "text", "text": text_part},
                    {"type": "image_url", "image_url": {"url": image_data}}
                ]
            })
        else:
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

    async def suggest_recipe_for_day(
        self,
        day_of_week: str,
        preferences: Optional[List[str]],
        current_plan: MealPlan,
        custom_prompt: Optional[str] = None
    ) -> Recipe:
        """
        Instantly generates a tailored, creative dinner recipe for a specific day based on user preferences.
        """
        pref_str = ", ".join(preferences) if preferences else "Fast, fresh, under 35 mins, high quality ingredients"
        plan_summary = format_meal_plan_summary(current_plan)

        prompt = f"""You are TasteCraft's culinary AI. Generate 1 exciting, delicious dinner recipe for {day_of_week}.
Household Preferences:
{pref_str}
{f'Custom notes: {custom_prompt}' if custom_prompt else ''}

Current meals already on this week's plan:
{plan_summary}

Requirements:
1. Provide great variety compared to other planned meals (different protein, cuisine, or style).
2. Realistic cook times and ingredient measurements (amounts, units like g, tbsp, cup, cloves, can, item).
3. Return ONLY a single raw JSON object (no markdown, no backticks, no commentary) matching this schema:
{{
  "title": "Recipe Title",
  "description": "Appetizing 1-2 sentence description",
  "prep_time_mins": 15,
  "cook_time_mins": 25,
  "servings": 2,
  "tags": ["quick", "one-pot", "sheet-pan"],
  "ingredients": [
    {{"name": "Salmon fillet", "amount": 2, "unit": "item", "category": "Meat & Seafood", "notes": "skin on"}},
    {{"name": "Asparagus", "amount": 1, "unit": "bunch", "category": "Produce", "notes": "trimmed"}}
  ],
  "instructions": [
    "Step 1...",
    "Step 2..."
  ]
}}"""

        try:
            resp = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a professional chef. Output only valid JSON."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.75
            )
            raw = resp.choices[0].message.content or ""
            # Strip markdown if present
            raw = re.sub(r"^```(?:json)?", "", raw.strip(), flags=re.IGNORECASE)
            raw = re.sub(r"```$", "", raw.strip())
            data = json.loads(raw.strip())
        except Exception as e:
            logger.warning(f"LLM generation failed for {day_of_week}, using curated fallback: {e}")
            data = {
                "title": f"Crispy Lemon Garlic Chicken & Roasted Veggies",
                "description": "Golden pan-seared chicken with blistered tomatoes, baby spinach, and a bright garlic butter sauce.",
                "prep_time_mins": 10,
                "cook_time_mins": 20,
                "servings": 2,
                "tags": ["one-pan", "30-min", "high-protein"],
                "ingredients": [
                    {"name": "Chicken Thighs", "amount": 1.2, "unit": "lb", "category": "Meat & Seafood", "notes": "boneless skinless"},
                    {"name": "Cherry Tomatoes", "amount": 1, "unit": "pint", "category": "Produce", "notes": ""},
                    {"name": "Garlic", "amount": 4, "unit": "cloves", "category": "Produce", "notes": "minced"},
                    {"name": "Baby Spinach", "amount": 5, "unit": "oz", "category": "Produce", "notes": "fresh"},
                    {"name": "Lemon", "amount": 1, "unit": "item", "category": "Produce", "notes": "juiced"},
                    {"name": "Olive Oil", "amount": 2, "unit": "tbsp", "category": "Pantry", "notes": ""},
                    {"name": "Butter", "amount": 2, "unit": "tbsp", "category": "Dairy & Refrigerated", "notes": ""}
                ],
                "instructions": [
                    "Season chicken thighs generously with salt, pepper, and Italian herbs.",
                    "Heat olive oil in a large skillet over medium-high heat. Sear chicken for 6-7 mins per side until golden and cooked through. Transfer to a plate.",
                    "In the same skillet, melt butter and add minced garlic and cherry tomatoes. Sauté for 3 mins until tomatoes begin to blister.",
                    "Toss in baby spinach and fresh lemon juice. Simmer 1 minute until spinach wilts.",
                    "Return chicken to the skillet to coat in pan juices and serve hot!"
                ]
            }

        # Build Recipe object
        ingredients = []
        for ing in data.get("ingredients", []):
            cat = ing.get("category") or guess_category(ing.get("name", ""))
            ingredients.append(Ingredient(
                name=ing.get("name", "Ingredient"),
                amount=float(ing.get("amount", 1.0)),
                unit=ing.get("unit", "item"),
                category=cat,
                notes=ing.get("notes")
            ))

        recipe = Recipe(
            title=data.get("title", f"Delicious {day_of_week} Dinner"),
            description=data.get("description", ""),
            prep_time_mins=int(data.get("prep_time_mins", 15)),
            cook_time_mins=int(data.get("cook_time_mins", 25)),
            servings=int(data.get("servings", 2)),
            tags=data.get("tags", []),
            ingredients=ingredients,
            instructions=data.get("instructions", [])
        )

        try:
            media = await search_recipe_media(recipe.title, recipe.tags)
            recipe.media_links = media
        except Exception as e:
            logger.warning(f"Error enriching media for {recipe.title}: {e}")

        return recipe

    async def plan_entire_week(
        self,
        preferences: Optional[List[str]],
        current_plan: MealPlan,
        custom_prompt: Optional[str] = None,
        overwrite_all: bool = False
    ) -> List[Tuple[str, Recipe]]:
        """
        Generates dinner recipes for all empty days (or all 7 days if overwrite_all is True) with balanced variety.
        """
        pref_str = ", ".join(preferences) if preferences else "Quick weeknight dinners, diverse cuisines, fresh produce"
        
        target_days = []
        for slot in current_plan.slots:
            if overwrite_all or not slot.recipe:
                target_days.append(slot.day_of_week)

        if not target_days:
            return []

        days_list_str = ", ".join(target_days)

        prompt = f"""You are TasteCraft's culinary AI. Plan creative, varied dinner recipes for the household for these specific days: {days_list_str}.
Household Preferences:
{pref_str}
{f'Custom notes: {custom_prompt}' if custom_prompt else ''}

Requirements:
1. Provide a balanced variety across the days (e.g. mix chicken, seafood, pasta, sheet-pan, beef, or vegetarian across the days).
2. Keep ingredients realistic and easy to find.
3. Return ONLY a single raw JSON array of objects (no markdown, no backticks, no commentary).
Schema for the array:
[
  {{
    "day_of_week": "Monday",
    "title": "Recipe Title",
    "description": "Appetizing description",
    "prep_time_mins": 15,
    "cook_time_mins": 25,
    "servings": 2,
    "tags": ["quick", "one-pan"],
    "ingredients": [
      {{"name": "Ingredient 1", "amount": 1, "unit": "item", "category": "Produce", "notes": ""}}
    ],
    "instructions": ["Step 1", "Step 2"]
  }}
]"""

        try:
            resp = await self.client.chat.completions.create(
                model=self.model,
                messages=[
                    {"role": "system", "content": "You are a professional chef. Output only valid JSON array of recipes."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.8
            )
            raw = resp.choices[0].message.content or ""
            raw = re.sub(r"^```(?:json)?", "", raw.strip(), flags=re.IGNORECASE)
            raw = re.sub(r"```$", "", raw.strip())
            results_data = json.loads(raw.strip())
            if isinstance(results_data, dict) and "recipes" in results_data:
                results_data = results_data["recipes"]
        except Exception as e:
            logger.warning(f"LLM week planning failed, falling back to curated options: {e}")
            results_data = []
            sample_recipes = [
                ("Monday", "Sheet Pan Lemon Garlic Salmon with Asparagus", 10, 20, ["sheet-pan", "seafood", "quick"], [
                    {"name": "Salmon Fillets", "amount": 2, "unit": "item", "category": "Meat & Seafood", "notes": ""},
                    {"name": "Asparagus", "amount": 1, "unit": "bunch", "category": "Produce", "notes": "trimmed"},
                    {"name": "Lemon", "amount": 1, "unit": "item", "category": "Produce", "notes": "sliced"},
                    {"name": "Olive Oil", "amount": 2, "unit": "tbsp", "category": "Pantry", "notes": ""}
                ]),
                ("Tuesday", "20-Minute Beef & Broccoli Noodle Stir Fry", 10, 15, ["stir-fry", "quick", "asian"], [
                    {"name": "Flank Steak", "amount": 1, "unit": "lb", "category": "Meat & Seafood", "notes": "thinly sliced"},
                    {"name": "Broccoli Florets", "amount": 2, "unit": "cup", "category": "Produce", "notes": ""},
                    {"name": "Soy Sauce", "amount": 3, "unit": "tbsp", "category": "Pantry", "notes": ""},
                    {"name": "Udon or Ramen Noodles", "amount": 8, "unit": "oz", "category": "Pantry", "notes": ""}
                ]),
                ("Wednesday", "One-Pot Creamy Tuscan Chicken", 10, 25, ["one-pot", "comfort-food"], [
                    {"name": "Chicken Cutlets", "amount": 1.2, "unit": "lb", "category": "Meat & Seafood", "notes": ""},
                    {"name": "Sun-Dried Tomatoes", "amount": 0.5, "unit": "cup", "category": "Pantry", "notes": ""},
                    {"name": "Heavy Cream", "amount": 0.75, "unit": "cup", "category": "Dairy & Refrigerated", "notes": ""},
                    {"name": "Baby Spinach", "amount": 4, "unit": "oz", "category": "Produce", "notes": ""}
                ]),
                ("Thursday", "Crispy Fish Tacos with Lime Crema & Slaw", 15, 15, ["tacos", "mexican", "fresh"], [
                    {"name": "White Fish Fillets", "amount": 1, "unit": "lb", "category": "Meat & Seafood", "notes": "cod or tilapia"},
                    {"name": "Corn Tortillas", "amount": 8, "unit": "item", "category": "Bakery", "notes": ""},
                    {"name": "Shredded Cabbage Slaw", "amount": 2, "unit": "cup", "category": "Produce", "notes": ""},
                    {"name": "Sour Cream", "amount": 0.5, "unit": "cup", "category": "Dairy & Refrigerated", "notes": ""},
                    {"name": "Lime", "amount": 2, "unit": "item", "category": "Produce", "notes": ""}
                ]),
                ("Friday", "Homemade Cast Iron Skillet Pizza", 15, 20, ["comfort-food", "pizza", "friday-night"], [
                    {"name": "Pizza Dough", "amount": 1, "unit": "lb", "category": "Bakery", "notes": "store-bought or fresh"},
                    {"name": "Mozzarella Cheese", "amount": 8, "unit": "oz", "category": "Dairy & Refrigerated", "notes": "shredded"},
                    {"name": "Pizza Sauce", "amount": 1, "unit": "cup", "category": "Pantry", "notes": ""},
                    {"name": "Fresh Basil", "amount": 1, "unit": "bunch", "category": "Produce", "notes": ""}
                ]),
                ("Saturday", "Grilled Steak with Chimichurri & Sweet Potato Fries", 15, 25, ["steak", "weekend", "fresh"], [
                    {"name": "Ribeye or Sirloin Steak", "amount": 1.5, "unit": "lb", "category": "Meat & Seafood", "notes": ""},
                    {"name": "Fresh Parsley", "amount": 1, "unit": "bunch", "category": "Produce", "notes": ""},
                    {"name": "Sweet Potatoes", "amount": 2, "unit": "item", "category": "Produce", "notes": "sliced into fries"},
                    {"name": "Red Wine Vinegar", "amount": 2, "unit": "tbsp", "category": "Pantry", "notes": ""}
                ]),
                ("Sunday", "Slow-Braised Chicken & Veggie Stew", 15, 45, ["stew", "cozy", "comfort-food"], [
                    {"name": "Chicken Thighs", "amount": 1.5, "unit": "lb", "category": "Meat & Seafood", "notes": "bone-in"},
                    {"name": "Carrots", "amount": 4, "unit": "item", "category": "Produce", "notes": "chopped"},
                    {"name": "Yukon Gold Potatoes", "amount": 3, "unit": "item", "category": "Produce", "notes": "cubed"},
                    {"name": "Chicken Broth", "amount": 4, "unit": "cup", "category": "Pantry", "notes": ""}
                ])
            ]
            for day in target_days:
                match = next((s for s in sample_recipes if s[0].lower() == day.lower()), None)
                if not match:
                    match = sample_recipes[0]
                results_data.append({
                    "day_of_week": day,
                    "title": match[1],
                    "description": f"A delightful {day} dinner tailored to your week.",
                    "prep_time_mins": match[2],
                    "cook_time_mins": match[3],
                    "servings": 2,
                    "tags": match[4],
                    "ingredients": match[5],
                    "instructions": [
                        "Prep and measure all fresh ingredients.",
                        "Cook main protein and veggies according to standard high heat / sear technique.",
                        "Combine sauces and seasonings, let simmer to marry flavors.",
                        "Serve hot and enjoy!"
                    ]
                })

        planned_output: List[Tuple[str, Recipe]] = []
        for item in results_data:
            day_name = item.get("day_of_week", "").strip().capitalize()
            if not day_name:
                continue

            ings = []
            for raw_ing in item.get("ingredients", []):
                cat = raw_ing.get("category") or guess_category(raw_ing.get("name", ""))
                ings.append(Ingredient(
                    name=raw_ing.get("name", "Ingredient"),
                    amount=float(raw_ing.get("amount", 1.0)),
                    unit=raw_ing.get("unit", "item"),
                    category=cat,
                    notes=raw_ing.get("notes")
                ))

            recipe = Recipe(
                title=item.get("title", f"{day_name} Dinner"),
                description=item.get("description", ""),
                prep_time_mins=int(item.get("prep_time_mins", 15)),
                cook_time_mins=int(item.get("cook_time_mins", 25)),
                servings=int(item.get("servings", 2)),
                tags=item.get("tags", []),
                ingredients=ings,
                instructions=item.get("instructions", [])
            )

            try:
                media = await search_recipe_media(recipe.title, recipe.tags)
                recipe.media_links = media
            except Exception as e:
                logger.warning(f"Error enriching media for {recipe.title}: {e}")

            planned_output.append((day_name, recipe))

        return planned_output

llm_agent = LLMAgent()

