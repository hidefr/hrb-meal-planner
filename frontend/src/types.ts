export interface MediaLink {
  id: string;
  type: 'video' | 'recipe_page' | 'photo';
  title: string;
  url: string;
  thumbnail_url?: string | null;
  source_name?: string | null;
}

export interface Ingredient {
  name: string;
  amount: number;
  unit: string;
  category: string;
  notes?: string | null;
}

export interface Recipe {
  id: string;
  title: string;
  description: string;
  prep_time_mins: number;
  cook_time_mins: number;
  servings: number;
  tags: string[];
  ingredients: Ingredient[];
  instructions: string[];
  media_links: MediaLink[];
  source_reference?: string | null;
}

export interface MealSlot {
  id: string;
  day_of_week: string;
  meal_type: 'dinner' | 'lunch' | 'breakfast';
  recipe?: Recipe | null;
  custom_notes?: string | null;
}

export interface MealPlan {
  id: string;
  week_title: string;
  slots: MealSlot[];
  notes?: string | null;
  updated_at: string;
}

export interface GroceryItem {
  id: string;
  name: string;
  amount: number;
  unit: string;
  category: string;
  checked: boolean;
  recipe_references: string[];
  manual: boolean;
  notes?: string | null;
}

export interface GroceryList {
  id: string;
  items: GroceryItem[];
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  timestamp: string;
  applied_actions?: string[] | null;
}

export interface ChatResponse {
  reply: string;
  actions_performed: string[];
  meal_plan: MealPlan;
  grocery_list: GroceryList;
}
