import { MealPlan, GroceryList, ChatMessage, ChatResponse, Recipe, MediaLink } from '../types';

const API_BASE = '/api';

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

export async function deleteGroceryItem(itemId: string): Promise<GroceryList> {
  const res = await fetch(`${API_BASE}/grocery/items/${itemId}`, {
    method: 'DELETE',
  });
  if (!res.ok) throw new Error('Failed to delete grocery item');
  return res.json();
}

export async function addGroceryItem(item: { name: string; amount: number; unit: string; category?: string; notes?: string }): Promise<GroceryList> {
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

export async function fetchChatHistory(): Promise<ChatMessage[]> {
  const res = await fetch(`${API_BASE}/chat/history`);
  if (!res.ok) throw new Error('Failed to fetch chat history');
  return res.json();
}

export async function sendChatMessage(message: string): Promise<ChatResponse> {
  const res = await fetch(`${API_BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message }),
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
