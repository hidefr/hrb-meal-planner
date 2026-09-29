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

export interface MealHistoryEntry {
  id: string;
  recipe: Recipe;
  first_planned: string;
  last_planned: string;
  times_planned: number;
  pinned: boolean;
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
  store?: string | null;
}

export interface ClearedGroceryItem {
  id: string;
  name: string;
  amount: number;
  unit: string;
  category: string;
  store?: string | null;
  notes?: string | null;
  cleared_at: string;
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

export interface ConversationSummary {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count: number;
  last_message_preview: string;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  messages: ChatMessage[];
}

export interface UserSettings {
  stores: string[];
  preferences: string[];
  servings: number;
  custom_notes: string;
}

export interface ChatResponse {
  reply: string;
  conversation_id: string;
  actions_performed: string[];
  meal_plan: MealPlan;
  grocery_list: GroceryList;
}
