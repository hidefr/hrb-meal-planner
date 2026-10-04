import {
  MealPlan, GroceryList, ChatMessage, ChatResponse, Recipe, MediaLink,
  UserSettings, Conversation, ConversationSummary, MealHistoryEntry, ClearedGroceryItem
} from '../types';

const API_BASE = '/api';

/**
 * Robust clipboard copy utility that works on both HTTPS and non-secure HTTP (e.g. mobile LAN)
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (e) {
      console.warn('navigator.clipboard failed, attempting fallback:', e);
    }
  }

  // Fallback using textarea execCommand
  try {
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-999999px';
    textArea.style.top = '-999999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    const successful = document.execCommand('copy');
    document.body.removeChild(textArea);
    return successful;
  } catch (err) {
    console.error('Fallback clipboard copy failed:', err);
    return false;
  }
}

// ==================== User Settings ====================
export async function fetchSettings(): Promise<UserSettings> {
  const res = await fetch(`${API_BASE}/settings`);
  if (!res.ok) throw new Error('Failed to fetch settings');
  return res.json();
}

export async function updateSettings(settings: UserSettings): Promise<UserSettings> {
  const res = await fetch(`${API_BASE}/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(settings),
  });
  if (!res.ok) throw new Error('Failed to update settings');
  return res.json();
}

// ==================== Meal Plan ====================
export async function fetchMealPlan(): Promise<MealPlan> {
  const res = await fetch(`${API_BASE}/meal-plan`);
  if (!res.ok) throw new Error('Failed to fetch meal plan');
  return res.json();
}

export async function updateMealPlan(plan: MealPlan): Promise<MealPlan> {
  const res = await fetch(`${API_BASE}/meal-plan`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(plan),
  });
  if (!res.ok) throw new Error('Failed to update meal plan');
  return res.json();
}

export async function clearSlot(day: string): Promise<MealPlan> {
  const res = await fetch(`${API_BASE}/meal-plan/slots/${day}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to clear slot');
  return res.json();
}

export async function updateSlot(day: string, recipe: Recipe): Promise<MealPlan> {
  const res = await fetch(`${API_BASE}/meal-plan/slots/${day}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(recipe),
  });
  if (!res.ok) throw new Error('Failed to update slot');
  return res.json();
}

export async function resetMealPlan(): Promise<MealPlan> {
  const res = await fetch(`${API_BASE}/meal-plan/reset`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to reset meal plan');
  return res.json();
}

// ==================== Meal History ====================
export async function fetchMealHistory(): Promise<MealHistoryEntry[]> {
  const res = await fetch(`${API_BASE}/meal-plan/history`);
  if (!res.ok) throw new Error('Failed to fetch meal history');
  return res.json();
}

export async function togglePinMealHistory(id: string): Promise<MealHistoryEntry> {
  const res = await fetch(`${API_BASE}/meal-plan/history/${id}/pin`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to toggle pin');
  return res.json();
}

export async function deleteMealHistory(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/meal-plan/history/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete meal history entry');
}

export async function applyHistoryMeal(day_of_week: string, recipe_id: string): Promise<MealPlan> {
  const res = await fetch(`${API_BASE}/meal-plan/history/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ day_of_week, recipe_id }),
  });
  if (!res.ok) throw new Error('Failed to apply historical meal');
  return res.json();
}

// ==================== One-Click AI Suggestion & Week Planning ====================
export async function aiSuggestMealForDay(
  day_of_week: string,
  preferences?: string[],
  custom_prompt?: string
): Promise<MealPlan> {
  const res = await fetch(`${API_BASE}/meal-plan/ai-suggest-day`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      day_of_week,
      preferences,
      custom_prompt
    }),
  });
  if (!res.ok) throw new Error('Failed to generate AI suggestion for day');
  return res.json();
}

export async function aiPlanEntireWeek(
  preferences?: string[],
  custom_prompt?: string,
  overwrite_all: boolean = false
): Promise<MealPlan> {
  const res = await fetch(`${API_BASE}/meal-plan/ai-plan-week`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      preferences,
      custom_prompt,
      overwrite_all
    }),
  });
  if (!res.ok) throw new Error('Failed to plan entire week');
  return res.json();
}

// ==================== Grocery List & Cleared History ====================
export async function fetchGroceryList(): Promise<GroceryList> {
  const res = await fetch(`${API_BASE}/grocery`);
  if (!res.ok) throw new Error('Failed to fetch grocery list');
  return res.json();
}

export async function toggleGroceryItem(itemId: string): Promise<GroceryList> {
  const res = await fetch(`${API_BASE}/grocery/items/${itemId}/toggle`, {
    method: 'PATCH',
  });
  if (!res.ok) throw new Error('Failed to toggle item');
  return res.json();
}

export async function updateGroceryItemStore(itemId: string, store: string | null): Promise<GroceryList> {
  const res = await fetch(`${API_BASE}/grocery/items/${itemId}/store`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ store }),
  });
  if (!res.ok) throw new Error('Failed to update item store');
  return res.json();
}

export async function updateGroceryItemQuantity(
  itemId: string,
  amount?: number,
  have_amount?: number | null,
  notes?: string
): Promise<GroceryList> {
  const res = await fetch(`${API_BASE}/grocery/items/${itemId}/quantity`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, have_amount, notes }),
  });
  if (!res.ok) throw new Error('Failed to update item quantity');
  return res.json();
}

export async function deleteGroceryItem(itemId: string): Promise<GroceryList> {
  const res = await fetch(`${API_BASE}/grocery/items/${itemId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete grocery item');
  return res.json();
}

export async function addGroceryItem(item: {
  name: string;
  amount: number;
  unit: string;
  category?: string;
  notes?: string;
  store?: string;
}): Promise<GroceryList> {
  const res = await fetch(`${API_BASE}/grocery/items`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(item),
  });
  if (!res.ok) throw new Error('Failed to add grocery item');
  return res.json();
}

export async function clearCheckedGroceryItems(): Promise<GroceryList> {
  const res = await fetch(`${API_BASE}/grocery/clear-checked`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to clear checked grocery items');
  return res.json();
}

export async function syncGroceryList(): Promise<GroceryList> {
  const res = await fetch(`${API_BASE}/grocery/sync`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to sync grocery list');
  return res.json();
}

export async function fetchClearedGroceryHistory(): Promise<ClearedGroceryItem[]> {
  const res = await fetch(`${API_BASE}/grocery/cleared-history`);
  if (!res.ok) throw new Error('Failed to fetch cleared grocery history');
  return res.json();
}

export async function restoreClearedGroceryItem(clearedId: string): Promise<GroceryList> {
  const res = await fetch(`${API_BASE}/grocery/cleared-history/${clearedId}/restore`, {
    method: 'POST',
  });
  if (!res.ok) throw new Error('Failed to restore cleared item');
  return res.json();
}

export async function deleteClearedGroceryItem(clearedId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/grocery/cleared-history/${clearedId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete cleared item from history');
}

export async function clearAllClearedGroceryHistory(): Promise<void> {
  const res = await fetch(`${API_BASE}/grocery/cleared-history`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to clear history');
}

// ==================== Conversations & Chat ====================
export async function fetchConversations(): Promise<ConversationSummary[]> {
  const res = await fetch(`${API_BASE}/chat/conversations`);
  if (!res.ok) throw new Error('Failed to fetch conversations');
  return res.json();
}

export async function fetchConversation(id: string): Promise<Conversation> {
  const res = await fetch(`${API_BASE}/chat/conversations/${id}`);
  if (!res.ok) throw new Error('Failed to fetch conversation');
  return res.json();
}

export async function createConversation(title?: string): Promise<Conversation> {
  const res = await fetch(`${API_BASE}/chat/conversations`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error('Failed to create conversation');
  return res.json();
}

export async function deleteConversation(id: string): Promise<void> {
  const res = await fetch(`${API_BASE}/chat/conversations/${id}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete conversation');
}

export async function renameConversation(id: string, title: string): Promise<Conversation> {
  const res = await fetch(`${API_BASE}/chat/conversations/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  });
  if (!res.ok) throw new Error('Failed to rename conversation');
  return res.json();
}

export async function fetchChatHistory(): Promise<ChatMessage[]> {
  const res = await fetch(`${API_BASE}/chat/history`);
  if (!res.ok) throw new Error('Failed to fetch chat history');
  return res.json();
}

export async function sendChatMessage(
  message: string,
  conversation_id?: string,
  image_data?: string
): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message, conversation_id, image_data }),
  });
  if (!res.ok) throw new Error('Failed to send chat message');
  return res.json();
}

export async function clearChatHistory(): Promise<void> {
  const res = await fetch(`${API_BASE}/chat/history`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to clear chat history');
}

export async function searchMediaForRecipe(recipeTitle: string, tags?: string[], dayOfWeek?: string): Promise<MediaLink[]> {
  const res = await fetch(`${API_BASE}/media/search`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipe_title: recipeTitle,
      tags: tags || [],
      day_of_week: dayOfWeek
    }),
  });
  if (!res.ok) throw new Error('Failed to search recipe media');
  return res.json();
}

export interface IngredientAdaptation {
  old_name: string;
  new_name: string;
  new_amount?: number | null;
  new_unit?: string | null;
  notes?: string | null;
}

export interface VoiceAskResult {
  reply: string;
  ingredient_update?: IngredientAdaptation | null;
}

export async function askVoiceAssistant(params: {
  query: string;
  recipe_title: string;
  current_step?: string;
  step_number?: number;
  cookware?: string;
  ingredients?: string[];
  instructions?: string[];
}): Promise<VoiceAskResult> {
  const res = await fetch(`${API_BASE}/voice/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  if (!res.ok) throw new Error('Voice assistant query failed');
  return res.json();
}

