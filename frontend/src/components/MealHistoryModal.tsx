import React, { useState, useEffect } from 'react';
import { X, Star, Clock, ChefHat, Search, Calendar, Check, Trash2, ArrowRight } from 'lucide-react';
import { MealHistoryEntry, Recipe } from '../types';
import { fetchMealHistory, togglePinMealHistory, deleteMealHistory } from '../services/api';

interface MealHistoryModalProps {
  initialDay?: string | null;
  daysOfWeek: string[];
  onClose: () => void;
  onApplyRecipe: (day: string, recipe: Recipe) => Promise<void>;
  onViewRecipe: (recipe: Recipe) => void;
}

export const MealHistoryModal: React.FC<MealHistoryModalProps> = ({
  initialDay,
  daysOfWeek,
  onClose,
  onApplyRecipe,
  onViewRecipe,
}) => {
  const [history, setHistory] = useState<MealHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedDay, setSelectedDay] = useState<string>(initialDay || daysOfWeek[0] || 'Monday');
  const [onlyPinned, setOnlyPinned] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const loadHistory = async () => {
    setLoading(true);
    try {
      const data = await fetchMealHistory();
      setHistory(data);
    } catch (e) {
      console.error('Failed to load meal history:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const handleTogglePin = async (e: React.MouseEvent, entryId: string) => {
    e.stopPropagation();
    try {
      const updated = await togglePinMealHistory(entryId);
      setHistory(prev => prev.map(item => item.id === entryId ? { ...item, pinned: updated.pinned } : item));
    } catch (err) {
      console.error(err);
    }
  };

  const handleDelete = async (e: React.MouseEvent, entryId: string) => {
    e.stopPropagation();
    if (window.confirm("Remove this meal from history log?")) {
      try {
        await deleteMealHistory(entryId);
        setHistory(prev => prev.filter(item => item.id !== entryId));
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleApply = async (recipe: Recipe) => {
    setApplyingId(recipe.id);
    try {
      await onApplyRecipe(selectedDay, recipe);
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setApplyingId(null);
    }
  };

  const filtered = history.filter(item => {
    if (onlyPinned && !item.pinned) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.recipe.title.toLowerCase().includes(q) ||
      (item.recipe.tags && item.recipe.tags.some(t => t.toLowerCase().includes(q))) ||
      (item.recipe.description && item.recipe.description.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs animate-fadeIn">
      <div className="bg-[#181310] text-[#f5eedf] rounded-3xl shadow-2xl border border-[#34271D] w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-[#34271D] flex items-center justify-between bg-[#211A15]">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center border border-amber-500/30">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#f5eedf]">Meal Plan Log & Favorites</h2>
              <p className="text-xs text-[#a89988]">
                Browse up to last 50 planned meals or reuse your pinned favorites
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-[#8c7b6d] hover:text-[#f5eedf] rounded-xl transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Target Day Selector Bar */}
        <div className="px-4 py-3 bg-[#261E17] border-b border-[#34271D] flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#f5eedf]">Add selected meal to:</span>
            <select
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="text-xs font-bold text-amber-300 bg-[#140F0C] border border-[#3B2C21] rounded-lg px-2.5 py-1.5 focus:border-amber-500 focus:outline-hidden"
            >
              {daysOfWeek.map(d => (
                <option key={d} value={d} className="bg-[#181310] text-[#f5eedf]">{d} Dinner</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setOnlyPinned(!onlyPinned)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition cursor-pointer ${
                onlyPinned
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-xs'
                  : 'bg-[#140F0C] text-[#a89988] border-[#3B2C21] hover:text-[#f5eedf]'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${onlyPinned ? 'fill-amber-400 text-amber-400' : 'text-[#8c7b6d]'}`} />
              <span>Pinned Only</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="p-3 sm:px-5 border-b border-[#34271D] bg-[#1a1410]">
          <div className="relative">
            <Search className="w-4 h-4 text-[#8c7b6d] absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search past meals by title, tag (e.g. salmon, sheet-pan, pasta)..."
              className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl bg-[#140F0C] text-[#f5eedf] placeholder-[#8c7b6d] border border-[#3B2C21] focus:border-amber-500 focus:outline-hidden transition shadow-inner"
            />
          </div>
        </div>

        {/* List of historical meals */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3">
          {loading ? (
            <div className="py-12 text-center text-[#8c7b6d] text-xs">
              Loading meal history...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <ChefHat className="w-10 h-10 text-[#5c4a3d] mx-auto" />
              <p className="text-sm font-semibold text-[#d6c7b2]">No meals found in history</p>
              <p className="text-xs text-[#8c7b6d] max-w-sm mx-auto">
                Any meals you set in your weekly plan will automatically be saved here so you can easily reuse them later!
              </p>
            </div>
          ) : (
            filtered.map((item) => {
              const recipe = item.recipe;
              const isApplying = applyingId === recipe.id;
              const totalTime = (recipe.prep_time_mins || 0) + (recipe.cook_time_mins || 0);

              return (
                <div
                  key={item.id}
                  className="bg-[#211A15] rounded-2xl border border-[#34271D] hover:border-amber-500/40 p-4 transition flex flex-col sm:flex-row sm:items-center justify-between gap-3 group shadow-xs"
                >
                  <div
                    onClick={() => onViewRecipe(recipe)}
                    className="flex-1 cursor-pointer space-y-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-bold text-[#f5eedf] group-hover:text-amber-300 transition">
                        {recipe.title}
                      </h4>
                      {item.pinned && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1.5 py-0.2 rounded font-semibold flex items-center gap-0.5">
                          <Star className="w-2.5 h-2.5 fill-amber-400 text-amber-400" />
                          <span>Pinned</span>
                        </span>
                      )}
                    </div>

                    {recipe.description && (
                      <p className="text-xs text-[#a89988] line-clamp-1">
                        {recipe.description}
                      </p>
                    )}

                    <div className="flex items-center gap-2 text-[11px] text-[#8c7b6d] flex-wrap">
                      {totalTime > 0 && (
                        <span className="flex items-center gap-1 font-medium text-[#c8bba9] bg-[#140F0C] border border-[#34271D] px-1.5 py-0.5 rounded">
                          <Clock className="w-3 h-3 text-amber-400" />
                          <span>{totalTime}m</span>
                        </span>
                      )}
                      <span>{recipe.ingredients?.length || 0} ingredients</span>
                      <span>• Planned {item.times_planned}x</span>
                      {recipe.tags && recipe.tags.slice(0, 2).map((t, idx) => (
                        <span key={idx} className="bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1.5 py-0.2 rounded">
                          #{t}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                    <button
                      type="button"
                      onClick={(e) => handleTogglePin(e, item.id)}
                      className={`p-2 rounded-xl transition cursor-pointer ${
                        item.pinned
                          ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
                          : 'text-[#8c7b6d] hover:text-amber-400 hover:bg-[#2C211A]'
                      }`}
                      title={item.pinned ? "Unpin recipe" : "Pin permanently so it never rolls off"}
                    >
                      <Star className={`w-4 h-4 ${item.pinned ? 'fill-current' : ''}`} />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => handleDelete(e, item.id)}
                      className="p-2 text-[#8c7b6d] hover:text-rose-400 hover:bg-rose-500/10 rounded-xl transition cursor-pointer"
                      title="Delete from log"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleApply(recipe)}
                      disabled={isApplying}
                      className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-bold shadow-md transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isApplying ? (
                        <span>Applying...</span>
                      ) : (
                        <>
                          <span>Use for {selectedDay}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
