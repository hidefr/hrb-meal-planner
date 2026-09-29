import React, { useState } from 'react';
import { X, Plus, Trash2, Check, Settings, Store, Sparkles, ChefHat } from 'lucide-react';
import { UserSettings } from '../types';

interface SettingsModalProps {
  settings: UserSettings;
  onClose: () => void;
  onSave: (updated: UserSettings) => Promise<void>;
}

const COMMON_PREFERENCES = [
  "Quick meals under 30 mins",
  "One-pot or sheet-pan meals",
  "Healthy & fresh veggies",
  "High protein",
  "Low-carb comfort",
  "Budget-friendly",
  "Kid-friendly",
  "Gluten-free friendly",
  "Vegetarian",
  "Comfort food"
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  onClose,
  onSave,
}) => {
  const [stores, setStores] = useState<string[]>([...settings.stores]);
  const [preferences, setPreferences] = useState<string[]>([...settings.preferences]);
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
    if (preferences.includes(pref)) {
      setPreferences(preferences.filter(p => p !== pref));
    } else {
      setPreferences([...preferences, pref]);
    }
  };

  const handleAddCustomPref = () => {
    const trimmed = newPrefInput.trim();
    if (trimmed && !preferences.includes(trimmed)) {
      setPreferences([...preferences, trimmed]);
      setNewPrefInput('');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await onSave({
        stores,
        preferences,
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
              <p className="text-xs text-slate-500">Tailor instant AI suggestions and grocery options for your home</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* Grocery Stores */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Store className="w-4 h-4 text-emerald-600" />
                <span>Customizable Grocery Stores</span>
              </label>
              <span className="text-[11px] text-slate-400">Used for item tagging</span>
            </div>
            <p className="text-xs text-slate-500">
              Select or add your regular stores so you can tag each item on your phone:
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
                    className="text-slate-400 hover:text-rose-600 ml-1 p-0.5 rounded transition"
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
                className="flex-1 text-xs px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleAddStore}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 text-xs font-semibold flex items-center gap-1 border border-slate-200 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* AI Cooking Preferences */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" />
                <span>AI Meal Preferences</span>
              </label>
              <span className="text-[11px] text-slate-400">Drives 1-click suggestions</span>
            </div>
            <p className="text-xs text-slate-500">
              When you click "AI Suggestion" for dinner or "AI Plan Entire Week", the AI uses these preferences:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
              {COMMON_PREFERENCES.map((pref) => {
                const selected = preferences.includes(pref);
                return (
                  <button
                    type="button"
                    key={pref}
                    onClick={() => handleTogglePref(pref)}
                    className={`px-3 py-2 rounded-xl text-xs font-medium text-left flex items-center justify-between border transition cursor-pointer ${
                      selected
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-semibold'
                        : 'bg-slate-50/70 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span>{pref}</span>
                    {selected && <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {/* Custom preference tag */}
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
                placeholder="Add custom preference (e.g. No seafood, Air fryer)..."
                className="flex-1 text-xs px-3.5 py-2 rounded-xl bg-slate-50 border border-slate-200 focus:bg-white focus:border-emerald-500 focus:outline-hidden"
              />
              <button
                type="button"
                onClick={handleAddCustomPref}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-emerald-50 hover:text-emerald-700 text-slate-700 text-xs font-semibold flex items-center gap-1 border border-slate-200 transition cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>

          <hr className="border-slate-100" />

          {/* Household Custom Instructions */}
          <div className="space-y-2">
            <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <ChefHat className="w-4 h-4 text-emerald-600" />
              <span>Special Household Notes</span>
            </label>
            <textarea
              rows={3}
              value={customNotes}
              onChange={(e) => setCustomNotes(e.target.value)}
              placeholder="e.g. We love Mexican and Asian flavors on weekends, Becca doesn't like cilantro, always keep dinners under 45 mins..."
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
