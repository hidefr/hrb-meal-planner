import React, { useState, useEffect } from 'react';
import { MessageSquare, Calendar, ShoppingBag, Sparkles, ChefHat } from 'lucide-react';
import { MealPlan, GroceryList, ChatMessage, Recipe, UserSettings } from './types';
import {
  fetchMealPlan,
  fetchGroceryList,
  fetchSettings,
  updateSettings,
  updateSlot,
  clearSlot,
  resetMealPlan,
  toggleGroceryItem,
  deleteGroceryItem,
  addGroceryItem,
  updateGroceryItemStore,
  clearCheckedGroceryItems,
  syncGroceryList,
  aiSuggestMealForDay,
  aiPlanEntireWeek,
  applyHistoryMeal
} from './services/api';

import { Navbar } from './components/Navbar';
import { ChatCopilot } from './components/ChatCopilot';
import { MealPlanBoard } from './components/MealPlanBoard';
import { GroceryListView } from './components/GroceryListView';
import { RecipeDetailModal } from './components/RecipeDetailModal';
import { ManualMealModal } from './components/ManualMealModal';
import { ManualGroceryModal } from './components/ManualGroceryModal';
import { SettingsModal } from './components/SettingsModal';
import { MealHistoryModal } from './components/MealHistoryModal';
import { ClearedGroceryModal } from './components/ClearedGroceryModal';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'plan' | 'grocery'>('plan');
  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [groceryList, setGroceryList] = useState<GroceryList | null>(null);
  const [userSettings, setUserSettings] = useState<UserSettings>({
    stores: ["Amazon", "Fred Meyer", "Trader Joe's", "Safeway", "New Seasons"],
    preferences: ["Quick meals under 30 mins", "One-pot or sheet-pan meals", "Healthy & fresh veggies"],
    servings: 2,
    custom_notes: ""
  });
  const [isSyncing, setIsSyncing] = useState(false);

  // Modals state
  const [selectedRecipeData, setSelectedRecipeData] = useState<{ recipe: Recipe; day: string } | null>(null);
  const [manualMealSlot, setManualMealSlot] = useState<{ day: string; recipe?: Recipe | null } | null>(null);
  const [isGroceryAddOpen, setIsGroceryAddOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMealHistoryOpen, setIsMealHistoryOpen] = useState(false);
  const [historyTargetDay, setHistoryTargetDay] = useState<string | null>(null);
  const [isClearedGroceryOpen, setIsClearedGroceryOpen] = useState(false);

  const loadData = async () => {
    setIsSyncing(true);
    try {
      const [plan, grocery, settings] = await Promise.all([
        fetchMealPlan(),
        fetchGroceryList(),
        fetchSettings()
      ]);
      setMealPlan(plan);
      setGroceryList(grocery);
      setUserSettings(settings);
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
  const handleMessageSent = (_newHistory: ChatMessage[], newPlan: MealPlan, newGrocery: GroceryList) => {
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

  // 1-Click AI Suggestion for single day
  const handleAiSuggestDay = async (day: string) => {
    try {
      const updated = await aiSuggestMealForDay(day, userSettings.preferences, userSettings.custom_notes);
      setMealPlan(updated);
      const updatedG = await fetchGroceryList();
      setGroceryList(updatedG);
    } catch (err) {
      console.error("AI Suggestion failed:", err);
      alert("Failed to generate AI suggestion. Make sure backend is running.");
    }
  };

  // 1-Click AI Plan Entire Week
  const handleAiPlanWeek = async () => {
    try {
      const updated = await aiPlanEntireWeek(userSettings.preferences, userSettings.custom_notes, false);
      setMealPlan(updated);
      const updatedG = await fetchGroceryList();
      setGroceryList(updatedG);
    } catch (err) {
      console.error("AI Week Plan failed:", err);
      alert("Failed to plan entire week. Make sure backend is running.");
    }
  };

  // Open Meal History
  const handleOpenMealHistory = (day?: string) => {
    setHistoryTargetDay(day || null);
    setIsMealHistoryOpen(true);
  };

  // Apply recipe from history
  const handleApplyHistoryRecipe = async (day: string, recipe: Recipe) => {
    try {
      const updated = await applyHistoryMeal(day, recipe.id);
      setMealPlan(updated);
      const updatedG = await fetchGroceryList();
      setGroceryList(updatedG);
    } catch (err) {
      console.error("Apply history meal failed:", err);
    }
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

  const handleUpdateGroceryStore = async (id: string, store: string | null) => {
    const updated = await updateGroceryItemStore(id, store);
    setGroceryList(updated);
  };

  const handleAddGroceryItem = async (item: {
    name: string;
    amount: number;
    unit: string;
    category?: string;
    notes?: string;
    store?: string;
  }) => {
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

  const handleSaveSettings = async (updated: UserSettings) => {
    const saved = await updateSettings(updated);
    setUserSettings(saved);
  };

  const uncheckedGroceryCount = groceryList?.items.filter(i => !i.checked).length || 0;
  const daysOfWeek = mealPlan ? mealPlan.slots.map(s => s.day_of_week) : [
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col antialiased text-slate-900">
      {/* Top Navbar */}
      <Navbar
        mealPlan={mealPlan}
        groceryList={groceryList}
        onResetPlan={handleResetPlan}
        onRefreshData={loadData}
        onOpenSettings={() => setIsSettingsOpen(true)}
        isSyncing={isSyncing}
      />

      {/* Desktop / Tablet Subnav Tabs (Compact Names) */}
      <div className="bg-white border-b border-slate-200 hidden md:block">
        <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">
          <div className="flex gap-2 py-2">
            <button
              onClick={() => setActiveTab('plan')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'plan'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Meal Plan</span>
            </button>

            <button
              onClick={() => setActiveTab('grocery')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition relative cursor-pointer ${
                activeTab === 'grocery'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Grocery List</span>
              {uncheckedGroceryCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'grocery' ? 'bg-white text-emerald-800' : 'bg-emerald-100 text-emerald-800'
                }`}>
                  {uncheckedGroceryCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('chat')}
              className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>AI</span>
            </button>
          </div>

          <div className="text-xs text-slate-400 font-medium">
            Couples Meal & Grocery Planner
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-3 sm:p-4 md:p-6 overflow-y-auto">
        {activeTab === 'plan' && mealPlan && (
          <MealPlanBoard
            mealPlan={mealPlan}
            onSelectRecipe={(recipe, day) => setSelectedRecipeData({ recipe, day })}
            onEditManual={(day, recipe) => setManualMealSlot({ day, recipe })}
            onClearSlot={handleClearSlot}
            onAiSuggestDay={handleAiSuggestDay}
            onAiPlanWeek={handleAiPlanWeek}
            onOpenHistory={handleOpenMealHistory}
          />
        )}

        {activeTab === 'grocery' && groceryList && (
          <GroceryListView
            groceryList={groceryList}
            stores={userSettings.stores}
            onToggleItem={handleToggleGroceryItem}
            onDeleteItem={handleDeleteGroceryItem}
            onUpdateStore={handleUpdateGroceryStore}
            onOpenAddModal={() => setIsGroceryAddOpen(true)}
            onClearChecked={handleClearCheckedGrocery}
            onOpenClearedHistory={() => setIsClearedGroceryOpen(true)}
            onSync={handleSyncGrocery}
          />
        )}

        {activeTab === 'chat' && (
          <ChatCopilot
            onMessageSent={handleMessageSent}
            onRefresh={loadData}
          />
        )}
      </main>

      {/* Mobile Sticky Bottom Navigation Bar (Compact Titles) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-xs border-t border-slate-200 px-3 py-2 flex items-center justify-around shadow-lg">
        <button
          onClick={() => setActiveTab('plan')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition cursor-pointer ${
            activeTab === 'plan' ? 'text-emerald-700 font-bold' : 'text-slate-500'
          }`}
        >
          <Calendar className="w-5 h-5" />
          <span className="text-[10px]">Meal Plan</span>
        </button>

        <button
          onClick={() => setActiveTab('grocery')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition relative cursor-pointer ${
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
          <span className="text-[10px]">Grocery List</span>
        </button>

        <button
          onClick={() => setActiveTab('chat')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition cursor-pointer ${
            activeTab === 'chat' ? 'text-emerald-700 font-bold' : 'text-slate-500'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px]">AI</span>
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

      {isSettingsOpen && (
        <SettingsModal
          settings={userSettings}
          onClose={() => setIsSettingsOpen(false)}
          onSave={handleSaveSettings}
        />
      )}

      {isMealHistoryOpen && (
        <MealHistoryModal
          initialDay={historyTargetDay}
          daysOfWeek={daysOfWeek}
          onClose={() => {
            setIsMealHistoryOpen(false);
            setHistoryTargetDay(null);
          }}
          onApplyRecipe={handleApplyHistoryRecipe}
          onViewRecipe={(recipe) => setSelectedRecipeData({ recipe, day: historyTargetDay || 'Selected' })}
        />
      )}

      {isClearedGroceryOpen && (
        <ClearedGroceryModal
          onClose={() => setIsClearedGroceryOpen(false)}
          onItemRestored={(updatedList) => setGroceryList(updatedList)}
        />
      )}
    </div>
  );
};

export default App;
