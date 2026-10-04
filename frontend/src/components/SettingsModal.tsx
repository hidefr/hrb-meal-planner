import React, { useState } from 'react';
import {
  X, Plus, Trash2, Check, Settings, Store, Sparkles,
  ChefHat, Copy, RefreshCw, RotateCcw, BookOpen, Sun, Moon
} from 'lucide-react';
import { UserSettings, MealPlan, GroceryList } from '../types';
import { copyToClipboard } from '../services/api';

interface SettingsModalProps {
  settings: UserSettings;
  mealPlan?: MealPlan | null;
  groceryList?: GroceryList | null;
  onClose: () => void;
  onSave: (updated: UserSettings) => Promise<void>;
  onRefreshData?: () => void;
  onResetPlan?: () => void;
  onOpenGuide?: () => void;
  isSyncing?: boolean;
}

const DEFAULT_AVAILABLE = [
  "Quick meals under 30 mins",
  "One-pot or sheet-pan meals",
  "Healthy & fresh veggies",
  "High protein",
  "Low-carb comfort",
  "Budget-friendly",
  "Kid-friendly",
  "Gluten-free friendly",
  "Comfort food"
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  mealPlan,
  groceryList,
  onClose,
  onSave,
  onRefreshData,
  onResetPlan,
  onOpenGuide,
  isSyncing = false,
}) => {
  const [stores, setStores] = useState<string[]>([...(settings.stores || [])]);
  const [copied, setCopied] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    try {
      const saved = localStorage.getItem('tastecraft_cooking_theme');
      if (saved === 'light' || saved === 'dark') return saved;
    } catch {}
    return (settings.theme as 'dark' | 'light') || 'dark';
  });

  const handleSelectTheme = (newTheme: 'dark' | 'light') => {
    setTheme(newTheme);
    try {
      localStorage.setItem('tastecraft_cooking_theme', newTheme);
    } catch {}
  };

  const handleCopySummary = async () => {
    if (!mealPlan) return;
    let text = `🍳 *${mealPlan.week_title}*\n\n`;
    text += `📅 *MEAL PLAN:*\n`;
    mealPlan.slots.forEach(slot => {
      text += `• ${slot.day_of_week}: ${slot.recipe ? slot.recipe.title : 'Free day'}\n`;
    });

    if (groceryList && groceryList.items.length > 0) {
      text += `\n🛒 *GROCERY LIST:*\n`;
      const byCat: { [key: string]: string[] } = {};
      groceryList.items.forEach(i => {
        byCat[i.category] = byCat[i.category] || [];
        const storeTag = i.store ? ` [@${i.store}]` : '';
        byCat[i.category].push(`- [${i.checked ? 'x' : ' '}] ${i.amount} ${i.unit} ${i.name}${storeTag}`);
      });
      Object.entries(byCat).forEach(([cat, items]) => {
        text += `\n*${cat}:*\n` + items.join('\n') + '\n';
      });
    }

    const success = await copyToClipboard(text);
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } else {
      alert("Could not copy automatically. Please copy manually.");
    }
  };

  // Combine initial available preferences
  const initialAvailable = Array.from(new Set([
    ...(settings.available_preferences || DEFAULT_AVAILABLE),
    ...(settings.preferences || [])
  ]));

  const [availablePrefs, setAvailablePrefs] = useState<string[]>(initialAvailable);
  const [activePrefs, setActivePrefs] = useState<string[]>([...(settings.preferences || [])]);
  const [servings, setServings] = useState<number>(settings.servings || 2);
  const [customNotes, setCustomNotes] = useState<string>(settings.custom_notes || '');
  const [newStoreInput, setNewStoreInput] = useState('');
  const [newPrefInput, setNewPrefInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  const handleAddStore = () => {
    const trimmed = newStoreInput.trim();
    if (trimmed && !stores.some(s => s.toLowerCase() === trimmed.toLowerCase())) {
      setStores([...stores, trimmed]);
      setNewStoreInput('');
    }
  };

  const handleRemoveStore = (storeToRemove: string) => {
    setStores(stores.filter(s => s !== storeToRemove));
  };

  const handleTogglePref = (pref: string) => {
    if (activePrefs.includes(pref)) {
      setActivePrefs(activePrefs.filter(p => p !== pref));
    } else {
      setActivePrefs([...activePrefs, pref]);
    }
  };

  const handleAddCustomPref = () => {
    const trimmed = newPrefInput.trim();
    if (!trimmed) return;

    if (!availablePrefs.some(p => p.toLowerCase() === trimmed.toLowerCase())) {
      setAvailablePrefs(prev => [...prev, trimmed]);
    }

    if (!activePrefs.some(p => p.toLowerCase() === trimmed.toLowerCase())) {
      setActivePrefs(prev => [...prev, trimmed]);
    }

    setNewPrefInput('');
  };

  const handleRemovePrefOption = (e: React.MouseEvent, prefToRemove: string) => {
    e.stopPropagation();
    setAvailablePrefs(prev => prev.filter(p => p !== prefToRemove));
    setActivePrefs(prev => prev.filter(p => p !== prefToRemove));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        stores,
        available_preferences: availablePrefs,
        preferences: activePrefs,
        servings,
        custom_notes: customNotes,
        theme
      });
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 700);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#181310] text-[#f5eedf] rounded-3xl shadow-2xl border border-[#34271D] w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#34271D] flex items-center justify-between bg-[#211A15]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#f5eedf]">Settings & Tools</h2>
              <p className="text-xs text-[#a89988]">Theme, plan utilities, AI dietary preferences, and stores</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#8c7b6d] hover:text-[#f5eedf] rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Theme Picking Section */}
        <div className="px-4 py-3 bg-[#241C16] border-b border-[#34271D] flex items-center justify-between gap-3">
          <div>
            <span className="text-xs font-bold text-[#f5eedf] flex items-center gap-1.5">
              <span>App Theme</span>
            </span>
            <p className="text-[11px] text-[#a89988]">Choose your preferred look across cooking and meal planning</p>
          </div>
          <div className="flex items-center p-1 bg-[#140F0C] rounded-xl border border-[#3B2C21] shrink-0">
            <button
              type="button"
              onClick={() => handleSelectTheme('dark')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                theme === 'dark'
                  ? 'bg-amber-600 text-white shadow-xs'
                  : 'text-[#8c7b6d] hover:text-[#f5eedf]'
              }`}
            >
              <Moon className="w-3.5 h-3.5" />
              <span>Espresso Dark</span>
            </button>
            <button
              type="button"
              onClick={() => handleSelectTheme('light')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                theme === 'light'
                  ? 'bg-[#EAE0CD] text-amber-950 shadow-xs'
                  : 'text-[#8c7b6d] hover:text-[#f5eedf]'
              }`}
            >
              <Sun className="w-3.5 h-3.5 text-amber-600" />
              <span>Biscuit Light</span>
            </button>
          </div>
        </div>

        {/* Quick Actions & Tools Bar */}
        <div className="p-3 sm:p-4 bg-[#1C1612] border-b border-[#34271D]">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Quick Actions & Tools</span>
            </span>
            <span className="text-[11px] text-[#8c7b6d]">1-click utilities</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {/* Copy Plan */}
            <button
              type="button"
              onClick={handleCopySummary}
              className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 text-center transition cursor-pointer ${
                copied
                  ? 'bg-amber-500/20 border-amber-500/50 text-amber-200'
                  : 'bg-[#241C16] border-[#3B2C21] text-[#d6c7b2] hover:bg-[#2C211A] hover:text-white shadow-xs'
              }`}
              title="Copy meal plan and grocery list"
            >
              {copied ? <Check className="w-4 h-4 text-amber-400" /> : <Copy className="w-4 h-4 text-[#a89988]" />}
              <span className="text-xs font-bold">{copied ? 'Copied!' : 'Copy Plan'}</span>
            </button>

            {/* Refresh / Sync */}
            {onRefreshData && (
              <button
                type="button"
                onClick={onRefreshData}
                disabled={isSyncing}
                className="p-2.5 rounded-xl border bg-[#241C16] border-[#3B2C21] text-[#d6c7b2] hover:bg-[#2C211A] hover:text-white shadow-xs flex flex-col items-center justify-center gap-1 text-center transition cursor-pointer"
                title="Refresh & sync data with server"
              >
                <RefreshCw className={`w-4 h-4 text-[#a89988] ${isSyncing ? 'animate-spin text-amber-400' : ''}`} />
                <span className="text-xs font-bold">{isSyncing ? 'Syncing...' : 'Sync Data'}</span>
              </button>
            )}

            {/* User Guide */}
            {onOpenGuide && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenGuide();
                }}
                className="p-2.5 rounded-xl border bg-[#241C16] border-[#3B2C21] text-[#d6c7b2] hover:bg-[#2C211A] hover:text-white shadow-xs flex flex-col items-center justify-center gap-1 text-center transition cursor-pointer"
                title="Open user guide"
              >
                <BookOpen className="w-4 h-4 text-[#a89988]" />
                <span className="text-xs font-bold">User Guide</span>
              </button>
            )}

            {/* Reset Week */}
            {onResetPlan && (
              <button
                type="button"
                onClick={() => {
                  if (window.confirm('Reset this week meal plan to start fresh?')) {
                    onResetPlan();
                    onClose();
                  }
                }}
                className="p-2.5 rounded-xl border bg-[#241C16] border-[#3B2C21] text-rose-400 hover:bg-rose-950/30 hover:border-rose-800 shadow-xs flex flex-col items-center justify-center gap-1 text-center transition cursor-pointer"
                title="Reset this week's plan"
              >
                <RotateCcw className="w-4 h-4" />
                <span className="text-xs font-bold">Reset Week</span>
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* AI Cooking Preferences (1-Click Suggestions) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-[#d6c7b2] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>AI Meal Preferences ({activePrefs.length} Active)</span>
              </label>
              <span className="text-[11px] text-amber-400 font-semibold">Tap to toggle on/off</span>
            </div>
            <p className="text-xs text-[#a89988]">
              When you click "AI Suggestion" for any day or "AI Plan Entire Week", TasteCraft immediately generates meals tailored to all active preferences:
            </p>

            {/* Grid of Available Preferences */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {availablePrefs.map((pref) => {
                const isActive = activePrefs.includes(pref);
                return (
                  <div
                    key={pref}
                    onClick={() => handleTogglePref(pref)}
                    className={`px-3 py-2 rounded-xl text-xs flex items-center justify-between border transition cursor-pointer select-none group ${
                      isActive
                        ? 'bg-amber-500/20 text-amber-200 border-amber-500/40 font-semibold shadow-2xs'
                        : 'bg-[#211A15] text-[#c8bba9] border-[#34271D] hover:bg-[#2C211A]'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-1">
                      <div className={`w-4 h-4 rounded-md flex items-center justify-center border shrink-0 ${
                        isActive ? 'bg-amber-600 border-amber-600 text-white' : 'border-[#4A392A] bg-[#140F0C]'
                      }`}>
                        {isActive && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="truncate">{pref}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleRemovePrefOption(e, pref)}
                      className="opacity-0 group-hover:opacity-100 text-[#8c7b6d] hover:text-rose-400 p-0.5 rounded transition shrink-0 ml-1"
                      title={`Remove "${pref}" preference option`}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Add Custom Preference Input */}
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={newPrefInput}
                onChange={(e) => setNewPrefInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddCustomPref();
                  }
                }}
                placeholder="Add new preference (e.g. Air fryer, No seafood, Thai flavors)..."
                className="flex-1 text-xs px-3.5 py-2.5 rounded-xl bg-[#211A15] border border-[#34271D] text-[#f5eedf] placeholder-[#8c7b6d] focus:bg-[#181310] focus:border-amber-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleAddCustomPref}
                className="px-4 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-bold flex items-center gap-1 shadow-xs transition cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add & Activate</span>
              </button>
            </div>
          </div>

          <hr className="border-[#34271D]" />

          {/* Grocery Stores */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-[#d6c7b2] flex items-center gap-1.5">
                <Store className="w-4 h-4 text-amber-400" />
                <span>Customizable Grocery Stores</span>
              </label>
              <span className="text-[11px] text-[#8c7b6d]">{stores.length} Stores</span>
            </div>
            <p className="text-xs text-[#a89988]">
              Stores appear as quick-tap boxes next to each grocery item on your phone:
            </p>

            {/* Store chips */}
            <div className="flex flex-wrap gap-2 pt-1">
              {stores.map((store) => (
                <span
                  key={store}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-[#211A15] text-[#f5eedf] text-xs font-semibold border border-[#34271D] group"
                >
                  <span>{store}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveStore(store)}
                    className="text-[#8c7b6d] hover:text-rose-400 ml-1 p-0.5 rounded transition cursor-pointer"
                    title={`Remove ${store}`}
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            {/* Add store input */}
            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={newStoreInput}
                onChange={(e) => setNewStoreInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddStore();
                  }
                }}
                placeholder="Add store (e.g. Costco, H-Mart)..."
                className="flex-1 text-xs px-3.5 py-2.5 rounded-xl bg-[#211A15] border border-[#34271D] text-[#f5eedf] placeholder-[#8c7b6d] focus:bg-[#181310] focus:border-amber-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleAddStore}
                className="px-4 py-2.5 rounded-xl bg-[#2C211A] hover:bg-[#382B22] text-[#d6c7b2] hover:text-white text-xs font-bold flex items-center gap-1 border border-[#423223] transition cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Store</span>
              </button>
            </div>
          </div>

          <hr className="border-[#34271D]" />

          {/* Household Custom Notes */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-[#d6c7b2] flex items-center gap-1.5">
              <ChefHat className="w-4 h-4 text-amber-400" />
              <span>Special Household Notes & Allergies</span>
            </label>
            <textarea
              rows={3}
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="e.g. We love Mexican and Asian flavors on weekends, no cilantro, always keep dinners under 45 mins..."
              className="w-full text-xs p-3 rounded-xl bg-[#211A15] border border-[#34271D] text-[#f5eedf] placeholder-[#8c7b6d] focus:bg-[#181310] focus:border-amber-500 focus:outline-hidden resize-none leading-relaxed"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-[#34271D] bg-[#211A15] flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-[#8c7b6d] hover:text-[#f5eedf] hover:bg-[#2C211A] transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-bold shadow-md shadow-amber-950 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4 stroke-[3]" />
                <span>Saved!</span>
              </>
            ) : (
              <span>Save Preferences</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
