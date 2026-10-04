import React, { useState, useEffect } from 'react';
import { MessageSquare, Calendar, ShoppingBag, Sparkles, ChefHat, BookOpen, Settings } from 'lucide-react';
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
  updateGroceryItemQuantity,
  clearCheckedGroceryItems,
  syncGroceryList,
  aiSuggestMealForDay,
  aiPlanEntireWeek,
  applyHistoryMeal
} from './services/api';

import { ChatCopilot } from './components/ChatCopilot';
import { MealPlanBoard } from './components/MealPlanBoard';
import { GroceryListView } from './components/GroceryListView';
import { UserGuideView } from './components/UserGuideView';
import { RecipeDetailModal } from './components/RecipeDetailModal';
import { ManualMealModal } from './components/ManualMealModal';
import { ManualGroceryModal } from './components/ManualGroceryModal';
import { SettingsModal } from './components/SettingsModal';
import { MealHistoryModal } from './components/MealHistoryModal';
import { ClearedGroceryModal } from './components/ClearedGroceryModal';
import { VoiceCookingMode } from './components/VoiceCookingMode';
import { AntiHomeworkBuilder } from './components/AntiHomeworkBuilder';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'chat' | 'plan' | 'grocery' | 'guide'>(() => {
    try {
      const saved = localStorage.getItem('tastecraft_active_tab');
      if (saved && ['chat', 'plan', 'grocery', 'guide'].includes(saved)) {
        return saved as 'chat' | 'plan' | 'grocery' | 'guide';
      }
    } catch {
      // Ignore localStorage errors (e.g. private browsing restrictions)
    }
    return 'plan';
  });

  const handleSelectTab = (tab: 'chat' | 'plan' | 'grocery' | 'guide') => {
    setActiveTab(tab);
    try {
      localStorage.setItem('tastecraft_active_tab', tab);
    } catch {
      // Ignore
    }
  };

  const [mealPlan, setMealPlan] = useState<MealPlan | null>(null);
  const [groceryList, setGroceryList] = useState<GroceryList | null>(null);
  // Do NOT auto-restore cooking mode on app reboot - this prevents the app from getting stuck
  // in cooking mode when closing and reopening. Users always land cleanly on the Meal Plan board.
  const [cookingModeData, setCookingModeData] = useState<{ recipe: Recipe; day: string } | null>(null);

  const handleSetCookingMode = (data: { recipe: Recipe; day: string } | null) => {
    setCookingModeData(data);
    try {
      // Clear legacy stuck keys from localStorage
      localStorage.removeItem('tastecraft_cooking_mode');
    } catch {
      // Ignore
    }
  };
  const [userSettings, setUserSettings] = useState<UserSettings>({
    stores: ["Amazon", "Fred Meyer", "Trader Joe's", "Safeway", "New Seasons"],
    available_preferences: [
      "Quick meals under 30 mins",
      "One-pot or sheet-pan meals",
      "Healthy & fresh veggies",
      "High protein",
      "Low carb",
      "Comfort food",
      "Gluten-free friendly",
      "Dairy-free friendly",
      "Kid-friendly",
      "Budget friendly",
      "Minimal cleanup"
    ],
    preferences: ["Quick meals under 30 mins", "One-pot or sheet-pan meals", "Healthy & fresh veggies"],
    servings: 2,
    custom_notes: "",
    theme: "dark"
  });
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('tastecraft_cooking_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return 'dark';
  });

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.classList.remove('theme-dark', 'theme-light');
    document.body.classList.add(theme === 'light' ? 'theme-light' : 'theme-dark');
    try {
      localStorage.setItem('tastecraft_cooking_theme', theme);
    } catch {}
  }, [theme]);

  const [isSyncing, setIsSyncing] = useState(false);

  // Modals state
  const [selectedRecipeData, setSelectedRecipeData] = useState<{ recipe: Recipe; day: string } | null>(null);
  const [manualMealSlot, setManualMealSlot] = useState<{ day: string; recipe?: Recipe | null } | null>(null);
  const [isGroceryAddOpen, setIsGroceryAddOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isMealHistoryOpen, setIsMealHistoryOpen] = useState(false);
  const [historyTargetDay, setHistoryTargetDay] = useState<string | null>(null);
  const [isClearedGroceryOpen, setIsClearedGroceryOpen] = useState(false);
  const [isAntiHomeworkOpen, setIsAntiHomeworkOpen] = useState(false);

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
      if (settings?.theme === 'light' || settings?.theme === 'dark') {
        setTheme(settings.theme);
      }
    } catch (e) {
      console.error('Failed to load TasteCraft data:', e);
    } finally {
      setIsSyncing(false);
    }
  };

  useEffect(() => {
    try {
      localStorage.removeItem('tastecraft_cooking_mode');
    } catch {}
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
    try {
      const updated = await updateSlot(day, recipe);
      setMealPlan(updated);
      const updatedG = await fetchGroceryList();
      setGroceryList(updatedG);
    } catch (err) {
      console.warn("Failed to persist updated meal slot:", err);
    }
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

  const handleUpdateGroceryQuantity = async (
    id: string,
    amount?: number,
    haveAmount?: number | null,
    notes?: string
  ) => {
    const updated = await updateGroceryItemQuantity(id, amount, haveAmount, notes);
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
    if (updated.theme) {
      setTheme(updated.theme);
    }
    const saved = await updateSettings(updated);
    setUserSettings(saved);
  };

  const uncheckedGroceryCount = groceryList?.items.filter(i => !i.checked).length || 0;
  const daysOfWeek = mealPlan ? mealPlan.slots.map(s => s.day_of_week) : [
    "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"
  ];

  return (
    <div
      className="min-h-screen bg-[#0d0a08] flex flex-col antialiased text-[#f5eedf] transition-colors duration-200"
      data-theme={theme}
    >
      {/* Mobile Top App Bar (Ensures clock, battery, Wi-Fi notch have safe breathing room) */}
      <header className="md:hidden sticky top-0 z-30 bg-[#140f0c]/95 backdrop-blur-md border-b border-amber-950/50 px-4 pt-safe pb-3 shadow-md flex items-center justify-between transition-colors">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center text-white shadow-sm border border-amber-500/30">
            <ChefHat className="w-4 h-4 text-amber-200" />
          </div>
          <span className="font-serif font-bold text-base tracking-wide text-[#f5eedf]">TasteCraft</span>
        </div>
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="p-1.5 rounded-lg text-[#c8bba9] hover:bg-[#201712] hover:text-[#f5eedf] transition"
          title="Settings & Tools"
        >
          <Settings className="w-4 h-4" />
        </button>
      </header>

      {/* Unified Desktop & Tablet Navigation Bar (Safe area padded for Android tablets) */}
      <header className="sticky top-0 z-30 bg-[#140f0c]/90 backdrop-blur-md border-b border-amber-950/50 px-4 pt-safe pb-3 shadow-md hidden md:block transition-colors">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          {/* Brand */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-amber-600 to-amber-800 flex items-center justify-center text-white shadow-sm shadow-amber-950/50 border border-amber-500/30">
              <ChefHat className="w-4 h-4 text-amber-200" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-serif font-bold text-lg tracking-wide text-[#f5eedf]">TasteCraft</span>
              </div>
            </div>
          </div>

          {/* 5 Navigation Buttons */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => handleSelectTab('plan')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'plan'
                  ? 'bg-amber-600 text-white shadow-sm shadow-amber-950'
                  : 'text-[#c8bba9] hover:bg-[#201712] hover:text-[#f5eedf]'
              }`}
            >
              <Calendar className="w-4 h-4" />
              <span>Meal Plan</span>
            </button>

            <button
              onClick={() => handleSelectTab('grocery')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition relative cursor-pointer ${
                activeTab === 'grocery'
                  ? 'bg-amber-600 text-white shadow-sm shadow-amber-950'
                  : 'text-[#c8bba9] hover:bg-[#201712] hover:text-[#f5eedf]'
              }`}
            >
              <ShoppingBag className="w-4 h-4" />
              <span>Grocery List</span>
              {uncheckedGroceryCount > 0 && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  activeTab === 'grocery' ? 'bg-[#140f0c] text-amber-300' : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {uncheckedGroceryCount}
                </span>
              )}
            </button>

            <button
              onClick={() => handleSelectTab('chat')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'chat'
                  ? 'bg-amber-600 text-white shadow-sm shadow-amber-950'
                  : 'text-[#c8bba9] hover:bg-[#201712] hover:text-[#f5eedf]'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              <span>AI</span>
            </button>

            <button
              onClick={() => handleSelectTab('guide')}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer ${
                activeTab === 'guide'
                  ? 'bg-amber-600 text-white shadow-sm shadow-amber-950'
                  : 'text-[#c8bba9] hover:bg-[#201712] hover:text-[#f5eedf]'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>Guide</span>
            </button>

            {/* 5th button: Settings (with Copy Plan, Sync, Guide, Preferences) */}
            <button
              onClick={() => setIsSettingsOpen(true)}
              className="px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition cursor-pointer text-[#c8bba9] bg-[#1a1410] hover:bg-[#251d17] hover:text-[#f5eedf] border border-amber-950/60 shadow-2xs"
              title="Settings & Tools (Copy Plan, Sync, Guide, Preferences)"
            >
              <Settings className="w-4 h-4 text-[#a89988]" />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-3 sm:p-4 md:p-6 pb-20 md:pb-6 overflow-y-auto">
        {activeTab === 'plan' && mealPlan && (
          <MealPlanBoard
            mealPlan={mealPlan}
            onSelectRecipe={(recipe, day) => setSelectedRecipeData({ recipe, day })}
            onEditManual={(day, recipe) => setManualMealSlot({ day, recipe })}
            onClearSlot={handleClearSlot}
            onAiSuggestDay={handleAiSuggestDay}
            onAiPlanWeek={handleAiPlanWeek}
            onOpenHistory={handleOpenMealHistory}
            onStartCookingMode={(recipe, day) => handleSetCookingMode({ recipe, day })}
            onOpenAntiHomework={() => setIsAntiHomeworkOpen(true)}
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
            onUpdateQuantity={handleUpdateGroceryQuantity}
          />
        )}

        {activeTab === 'chat' && (
          <ChatCopilot
            onMessageSent={handleMessageSent}
            onRefresh={loadData}
          />
        )}

        {activeTab === 'guide' && (
          <UserGuideView />
        )}
      </main>

      {/* Mobile Sticky Bottom Navigation Bar (Compact Titles) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#140f0c]/95 backdrop-blur-md border-t border-amber-950/50 px-3 pt-2 pb-safe flex items-center justify-around shadow-lg">
        <button
          onClick={() => handleSelectTab('plan')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition cursor-pointer ${
            activeTab === 'plan' ? 'text-amber-400 font-bold' : 'text-[#8c7b6d]'
          }`}
        >
          <Calendar className="w-5 h-5" />
          <span className="text-[10px]">Meal Plan</span>
        </button>

        <button
          onClick={() => handleSelectTab('grocery')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition relative cursor-pointer ${
            activeTab === 'grocery' ? 'text-amber-400 font-bold' : 'text-[#8c7b6d]'
          }`}
        >
          <div className="relative">
            <ShoppingBag className="w-5 h-5" />
            {uncheckedGroceryCount > 0 && (
              <span className="absolute -top-1 -right-2 bg-amber-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                {uncheckedGroceryCount > 9 ? '9+' : uncheckedGroceryCount}
              </span>
            )}
          </div>
          <span className="text-[10px]">Grocery List</span>
        </button>

        <button
          onClick={() => handleSelectTab('chat')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition cursor-pointer ${
            activeTab === 'chat' ? 'text-amber-400 font-bold' : 'text-[#8c7b6d]'
          }`}
        >
          <MessageSquare className="w-5 h-5" />
          <span className="text-[10px]">AI</span>
        </button>

        <button
          onClick={() => handleSelectTab('guide')}
          className={`flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition cursor-pointer ${
            activeTab === 'guide' ? 'text-amber-400 font-bold' : 'text-[#8c7b6d]'
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-[10px]">Guide</span>
        </button>

        {/* 5th button: Settings */}
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="flex flex-col items-center gap-1 py-1 px-3 rounded-xl transition cursor-pointer text-[#8c7b6d] hover:text-amber-400"
          title="Settings & Tools"
        >
          <Settings className="w-5 h-5" />
          <span className="text-[10px]">Settings</span>
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
          onStartCookingMode={() => {
            const current = selectedRecipeData;
            setSelectedRecipeData(null);
            handleSetCookingMode(current);
          }}
        />
      )}

      {cookingModeData && (
        <VoiceCookingMode
          recipe={cookingModeData.recipe}
          dayOfWeek={cookingModeData.day}
          onClose={() => handleSetCookingMode(null)}
          onRecipeUpdated={(updatedRecipe) => {
            // Update cookingModeData state so cooking mode stays completely in sync
            setCookingModeData(prev => prev ? { ...prev, recipe: updatedRecipe } : null);
            // Save updated recipe directly to the day slot in the meal plan and database
            handleSaveManualMeal(cookingModeData.day, updatedRecipe);
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
          mealPlan={mealPlan}
          groceryList={groceryList}
          onClose={() => setIsSettingsOpen(false)}
          onSave={handleSaveSettings}
          onSelectTheme={setTheme}
          onRefreshData={loadData}
          onResetPlan={handleResetPlan}
          onOpenGuide={() => handleSelectTab('guide')}
          isSyncing={isSyncing}
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

      {isAntiHomeworkOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
          <div className="w-full max-w-2xl">
            <AntiHomeworkBuilder
              onCommitMeal={(recipe) => {
                setIsAntiHomeworkOpen(false);
                // Assign to today or first slot
                const today = daysOfWeek[0] || 'Monday';
                handleSaveManualMeal(today, recipe);
                handleSetCookingMode({ recipe, day: today });
              }}
              onClose={() => setIsAntiHomeworkOpen(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
