from typing import List, Dict
import re
from app.models.schemas import GroceryList, GroceryItem, MealPlan, Ingredient

CATEGORY_KEYWORDS = {
    "Produce": [
        "onion", "garlic", "shallot", "scallion", "ginger", "potato", "carrot", "celery",
        "tomato", "bell pepper", "pepper", "chili", "jalapeno", "lemon", "lime", "cilantro",
        "parsley", "basil", "spinach", "kale", "lettuce", "arugula", "cucumber", "zucchini",
        "broccoli", "cauliflower", "mushroom", "avocado", "apple", "banana", "berry", "herbs",
        "rosemary", "thyme", "mint", "cabbage", "asparagus", "sweet potato"
    ],
    "Meat & Seafood": [
        "chicken", "beef", "pork", "steak", "ground beef", "turkey", "salmon", "shrimp",
        "prawn", "tuna", "cod", "bacon", "sausage", "ham", "lamb", "tofu", "tempeh", "fish"
    ],
    "Dairy & Refrigerated": [
        "milk", "heavy cream", "sour cream", "yogurt", "butter", "cheese", "cheddar", "parmesan",
        "mozzarella", "feta", "egg", "eggs", "cream cheese", "ricotta", "oat milk", "almond milk"
    ],
    "Bakery": [
        "bread", "tortilla", "tortillas", "bun", "buns", "bagel", "pita", "crust", "naan", "wrap"
    ],
    "Spices & Seasonings": [
        "salt", "black pepper", "paprika", "cumin", "oregano", "cinnamon", "nutmeg",
        "curry powder", "turmeric", "chili powder", "cayenne", "soy sauce", "olive oil",
        "vegetable oil", "sesame oil", "vinegar", "balsamic", "hot sauce", "sriracha",
        "mustard", "mayo", "mayonnaise", "honey", "maple syrup"
    ],
    "Pantry": [
        "rice", "pasta", "spaghetti", "penne", "noodle", "noodles", "canned", "beans",
        "black beans", "chickpeas", "lentils", "broth", "stock", "chicken broth", "beef broth",
        "vegetable broth", "diced tomatoes", "tomato paste", "tomato sauce", "coconut milk",
        "flour", "sugar", "baking powder", "yeast", "cornstarch", "oats", "quinoa", "nuts", "peanuts"
    ],
    "Frozen": [
        "frozen", "ice cream", "frozen peas", "frozen berries", "frozen corn"
    ]
}

def guess_category(ingredient_name: str) -> str:
    name_lower = ingredient_name.lower()
    for cat, keywords in CATEGORY_KEYWORDS.items():
        for kw in keywords:
            if re.search(r'\b' + re.escape(kw) + r'\b', name_lower):
                return cat
    return "Pantry"

def sync_grocery_list_from_meal_plan(meal_plan: MealPlan, current_grocery: GroceryList) -> GroceryList:
    """
    Consolidates ingredients from all recipes in the meal plan while
    preserving manually added items and user check-states where possible.
    """
    manual_items = [item for item in current_grocery.items if item.manual]
    existing_checked = {item.name.lower().strip(): item.checked for item in current_grocery.items}
    
    # Aggregate recipe ingredients
    aggregated: Dict[str, GroceryItem] = {}

    for slot in meal_plan.slots:
        if not slot.recipe:
            continue
        recipe_title = slot.recipe.title
        for ing in slot.recipe.ingredients:
            clean_name = ing.name.strip().title()
            key = (clean_name.lower(), ing.unit.lower())

            if key in aggregated:
                aggregated[key].amount += ing.amount
                if recipe_title not in aggregated[key].recipe_references:
                    aggregated[key].recipe_references.append(recipe_title)
            else:
                cat = ing.category if ing.category and ing.category != "Pantry" else guess_category(clean_name)
                # Check if user already had this checked
                was_checked = existing_checked.get(clean_name.lower(), False)
                aggregated[key] = GroceryItem(
                    name=clean_name,
                    amount=round(ing.amount, 2),
                    unit=ing.unit,
                    category=cat,
                    checked=was_checked,
                    recipe_references=[recipe_title],
                    manual=False,
                    notes=ing.notes
                )

    new_items = list(aggregated.values()) + manual_items
    
    # Sort items by category then name
    category_order = ["Produce", "Meat & Seafood", "Dairy & Refrigerated", "Bakery", "Pantry", "Spices & Seasonings", "Frozen", "Other"]
    def sort_key(item: GroceryItem):
        cat_idx = category_order.index(item.category) if item.category in category_order else 99
        return (cat_idx, item.checked, item.name)

    new_items.sort(key=sort_key)
    return GroceryList(items=new_items)
