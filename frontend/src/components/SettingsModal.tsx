import React, { useState } from 'react';
import { X, Plus, Trash2, Check, Settings, Store, Sparkles, ChefHat } from 'lucide-react';
import { UserSettings } from '../types';

interface SettingsModalProps {
  settings: UserSettings;
  onClose: () => void;
  onSave: (updated: UserSettings) => Promise<void>;
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
  onClose,
  onSave,
}) => {
  const [stores, setStores] = useState<string[]>([...(settings.stores || [])]);

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

    // 1. Add to available preferences if not already there
    if (!availablePrefs.some(p => p.toLowerCase() === trimmed.toLowerCase())) {
      setAvailablePrefs(prev => [...prev, trimmed]);
    }

    // 2. Immediately mark as active so it drops in active
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
        custom_notes: customNotes
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/10 text-emerald-700 flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Preferences & Stores</h2>
              <p className="text-xs text-slate-500">Configure 1-click AI meal suggestions and grocery store tagging</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* AI Cooking Preferences (1-Click Suggestions) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>AI Meal Preferences ({activePrefs.length} Active)</span>
              </label>
              <span className="text-[11px] text-emerald-700 font-semibold">Tap to toggle on/off</span>
            </div>
            <p className="text-xs text-slate-500">
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
                        ? 'bg-emerald-50 text-emerald-900 border-emerald-300 font-semibold shadow-2xs'
                        : 'bg-slate-50/70 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0 pr-1">
                      <div className={`w-4 h-4 rounded-md flex items-center justify-center border shrink-0 ${
                        isActive ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                      }`}>
                        {isActive && <Check className="w-3 h-3 stroke-[3]" />}
                      </div>
                      <span className="truncate">{pref}</span>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleRemovePrefOption(e, pref)}
                      className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-600 p-0.5 rounded transition shrink-0 ml-1"
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
                className="flex-1 text-xs px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleAddCustomPref}
                className="px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add & Activate</span>
              </button>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Grocery Stores */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Store className="w-4 h-4 text-emerald-600" />
                <span>Customizable Grocery Stores</span>
              </label>
              <span className="text-[11px] text-slate-400">{stores.length} Stores</span>
            </div>
            <p className="text-xs text-slate-500">
              Stores appear as quick-tap boxes next to each grocery item on your phone:
            </p>

            {/* Store chips */}
            <div className="flex flex-wrap gap-2 pt-1">
              {stores.map((store) => (
                <span
                  key={store}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 text-xs font-semibold border border-slate-200 group"
                >
                  <span>{store}</span>
                  <button
                    type="button"
                    onClick={() => handleRemoveStore(store)}
                    className="text-slate-400 hover:text-rose-600 ml-1 p-0.5 rounded transition cursor-pointer"
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
                className="flex-1 text-xs px-3.5 py-2.5 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleAddStore}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 text-xs font-bold flex items-center gap-1 border border-slate-200 transition cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Store</span>
              </button>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Household Custom Notes */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <ChefHat className="w-4 h-4 text-emerald-600" />
              <span>Special Household Notes & Allergies</span>
            </label>
            <textarea
              rows={3}
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="e.g. We love Mexican and Asian flavors on weekends, no cilantro, always keep dinners under 45 mins..."
              className="w-full text-xs p-3 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:outline-hidden resize-none leading-relaxed"
            />
          </div>
        </form>

        {/* Footer */}
        <div className="p-4 sm:p-5 border-t border-slate-100 bg-slate-50 flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={saving}
            className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-200 flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
          >
            {savedSuccess ? (
              <>
                <Check className="w-4 h-4" />
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
