import React, { useState, useEffect } from 'react';
import { MessageSquare, Calendar, ShoppingBag, Sparkles, ChefHat } from 'lucide-react';
import { MealPlan, GroceryList, ChatMessage, Recipe } from './types';
import {
  fetchMealPlan,
  fetchGroceryList,
  fetchChatHistory,
  updateSlot,
  clearSlot,
  resetMealPlan,
  toggleGroceryItem,
  deleteGroceryItem,
  addGroceryItem,
  clearCheckedGroceryItems,
  syncGroceryList
} from './services/api';

import { Navbar } from './components/Navbar';
import { ChatCopilot } from './components/ChatCopilot';
import { MealPlanBoard } from './components/MealPlanBoard';
import { GroceryListView } from './components/GroceryListView';
import { RecipeDetailModal } from './components/RecipeDetailModal';
import { ManualMealModal } from './components/ManualMealModal';
import { ManualGroceryModal } from './components/ManualGroceryModal';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'plan' | 'grocery'>('chat');
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [groceryList, setGroceryList] = useState<GroceryList | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  // Modals state
  const [selectedRecipeData, setSelectedRecipeData] = useState<{ recipe: Recipe; day: string } | null>(null);
  const [manualMealSlot, setManualMealSlot] = useState<{ day: string; recipe?: Recipe | null } | null>(null);
  const [isGroceryAddOpen, setIsGroceryAddOpen] = useState(false);

  const loadData = async () => {
    setIsSyncing(true);
    try {
      const [plan, grocery, history] = await Promise.all([
        fetchMealPlan(),
        fetchGroceryList(),
        fetchChatHistory()
      ]);
      setMealPlan(plan);
      setGroceryList(grocery);
      setChatHistory(history);
    } catch (e) {
      console.error('Failed to load TasteCraft data:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handlers for Chat Copilot
  const handleMessageSent = (newHistory: ChatMessage[], newPlan: MealPlan, newGrocery: GroceryList) => {
    setChatHistory(newHistory);
    if (newPlan && newPlan.slots) setMealPlan(newPlan);
    if (newGrocery && newGrocery.items) setGroceryList(newGrocery);
  };

  // Handlers for Meal Plan
  const handleClearSlot = async (day: string) => {
    const updated = await clearSlot(day);
    setMealPlan(updated);
    const updatedG = await fetchGroceryList();
    setGroceryList(updatedG);
  };

  const handleSaveManualMeal = async (day: string, recipe: Recipe) => {
    const updated = await updateSlot(day, recipe);
    setMealPlan(updated);
    const updatedG = await fetchGroceryList();
    setGroceryList(updatedG);
  };

  const handleResetPlan = async () => {
    const fresh = await resetMealPlan();
    setMealPlan(fresh);
    const updatedG = await fetchGroceryList();
    setGroceryList(updatedG);
  };

  // Triggering AI for a specific day or week
  const handleTriggerAiForDay = (day: string) => {
    setActiveTab('chat');
    // Scroll or trigger suggestion
  };

  // Handlers for Grocery List
  const handleToggleGroceryItem = async (id: string) => {
    const updated = await toggleGroceryItem(id);
    setGroceryList(updated);
  };

  const handleDeleteGroceryItem = async (id: string) => {
    const updated = await deleteGroceryItem(id);
    setGroceryList(updated);
  };

  const handleAddGroceryItem = async (item: { name: string; amount: number; unit: string; category?: string; notes?: string }) => {
    const updated = await addGroceryItem(item);
    setGroceryList(updated);
  };

  const handleClearCheckedGrocery = async () => {
    const updated = await clearCheckedGroceryItems();
    setGroceryList(updated);
  };

  const handleSyncGrocery = async () => {
    setIsSyncing(true);
    const updated = await syncGroceryList();
    setGroceryList(updated);
    setIsSyncing(false);
  };

  const uncheckedGroceryCount = groceryList?.items.filter(i => !i.checked).length || 0;

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased text-slate-900">
      {/* Top Navbar */}
      <Navbar
        mealPlan={mealPlan}
        groceryList={groceryList}
        onResetPlan={handleResetPlan}
        onRefreshData={loadData}
        isSyncing={isSyncing}
      />

      {/* Desktop / Tablet Subnav Tabs */}
      <div className="bg-white border-b border-slate-200 hidden md:block">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">
          <div className="flex gap-2 py-2">
            <button
              onClick={() => setActiveTab('chat')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                activeTab === 'chat'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>AI Copilot</span>
            </button>

            <button
              onClick={() => setActiveTab('plan')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition ${
                activeTab === 'plan'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Weekly Meal Plan</span>
            </button>

            <button
              onClick={() => setActiveTab('grocery')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition relative ${
                activeTab === 'grocery'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Manageable Grocery List</span>
              {uncheckedGroceryCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'grocery' ? 'bg-white text-emerald-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {uncheckedGroceryCount}
                </span>
              )}
            </button>
          </div>

          <div className="text-xs text-slate-400 font-medium">
            Couples Meal Copilot • iPhone & Android Synced
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-3 sm:p-4 md:p-6 overflow-y-auto">
        {activeTab === 'chat' && (
          <ChatCopilot
            messages={chatHistory}
            onMessageSent={handleMessageSent}
            onRefresh={loadData}
          />
        )}

        {activeTab === 'plan' && mealPlan && (
          <MealPlanBoard
            mealPlan={mealPlan}
            onSelectRecipe={(recipe, day) => setSelectedRecipeData({ recipe, day })}
            onEditManual={(day, recipe) => setManualMealSlot({ day, recipe })}
            onClearSlot={handleClearSlot}
            onTriggerAiForDay={handleTriggerAiForDay}
          />
        )}

        {activeTab === 'grocery' && groceryList && (
          <GroceryListView
            groceryList={groceryList}
            onToggleItem={handleToggleGroceryItem}
            onDeleteItem={handleDeleteGroceryItem}
            onOpenAddModal={() => setIsGroceryAddOpen(true)}
            onClearChecked={handleClearCheckedGrocery}
            onSync={handleSyncGrocery}
          />
        )}
      </main>

      {/* Mobile Sticky Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur border-t border-slate-200 px-3 py-2 flex items-center justify-around shadow-lg">
        <button
          onClick={() => setActiveTab('chat')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
            activeTab === 'chat' ? 'text-emerald-700 font-bold' : 'text-slate-500'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px]">Chat AI</span>
        </button>

        <button
          onClick={() => setActiveTab('plan')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition ${
            activeTab === 'plan' ? 'text-emerald-700 font-bold' : 'text-slate-500'
          }`}
        >
          <Calendar className="w-5 h-5" />
          <span className="text-[10px]">Meal Plan</span>
        </button>

        <button
          onClick={() => setActiveTab('grocery')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition relative ${
            activeTab === 'grocery' ? 'text-emerald-700 font-bold' : 'text-slate-500'
          }`}
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5" />
            {uncheckedGroceryCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-emerald-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {uncheckedGroceryCount > 9 ? '9+' : uncheckedGroceryCount}
              </span>
            )}
          </div>
          <span className="text-[10px]">Groceries</span>
        </button>
      </nav>

      {/* Modals */}
      {selectedRecipeData && (
        <RecipeDetailModal
          recipe={selectedRecipeData.recipe}
          dayOfWeek={selectedRecipeData.day}
          onClose={() => setSelectedRecipeData(null)}
          onEditManual={() => {
            const data = selectedRecipeData;
            setSelectedRecipeData(null);
            setManualMealSlot({ day: data.day, recipe: data.recipe });
          }}
          onRecipeUpdated={(updated) => {
            setSelectedRecipeData({ recipe: updated, day: selectedRecipeData.day });
            handleSaveManualMeal(selectedRecipeData.day, updated);
          }}
        />
      )}

      {manualMealSlot && (
        <ManualMealModal
          dayOfWeek={manualMealSlot.day}
          initialRecipe={manualMealSlot.recipe}
          onClose={() => setManualMealSlot(null)}
          onSave={(day, recipe) => handleSaveManualMeal(day, recipe)}
        />
      )}

      {isGroceryAddOpen && (
        <ManualGroceryModal
          onClose={() => setIsGroceryAddOpen(false)}
          onAdd={handleAddGroceryItem}
        />
      )}
    </div>
  );
};

export default App;
