import React, { useState, useEffect } from 'react';
import { X, Search, Plus, ShoppingBag, Check, RotateCcw, Store } from 'lucide-react';
import { ClearedGroceryItem, GroceryList } from '../types';
import { fetchClearedGroceryHistory, restoreClearedGroceryItem } from '../services/api';

interface ClearedGroceryModalProps {
  onClose: () => void;
  onItemRestored: (updatedList: GroceryList) => void;
}

export const ClearedGroceryModal: React.FC<ClearedGroceryModalProps> = ({
  onClose,
  onItemRestored,
}) => {
  const [items, setItems] = useState<ClearedGroceryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [restoredIds, setRestoredIds] = useState<Set<string>>(new Set());

  const loadCleared = async () => {
    setLoading(true);
    try {
      const data = await fetchClearedGroceryHistory();
      setItems(data);
    } catch (err) {
      console.error('Failed to load cleared grocery history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCleared();
  }, []);

  const handleRestore = async (clearedId: string) => {
    try {
      const updatedList = await restoreClearedGroceryItem(clearedId);
      setRestoredIds(prev => new Set(prev).add(clearedId));
      onItemRestored(updatedList);
    } catch (err) {
      console.error(err);
    }
  };

  const filtered = items.filter(item => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      item.name.toLowerCase().includes(q) ||
      (item.category && item.category.toLowerCase().includes(q)) ||
      (item.store && item.store.toLowerCase().includes(q)) ||
      (item.notes && item.notes.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[85vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-600/10 text-emerald-700 flex items-center justify-center">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">Cleared Items History</h2>
              <p className="text-xs text-slate-500">
                Log of past cleared groceries (up to 200) — tap to re-add to your shopping list
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-700 rounded-xl transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Search */}
        <div className="p-3 sm:px-5 border-b border-slate-100 bg-white">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search cleared items..."
              className="w-full text-xs pl-9 pr-4 py-2.5 rounded-xl bg-slate-100 focus:bg-white border border-transparent focus:border-emerald-500 focus:outline-hidden transition shadow-inner"
            />
          </div>
        </div>

        {/* Items List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="py-12 text-center text-slate-400 text-xs">
              Loading cleared items...
            </div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center space-y-2">
              <ShoppingBag className="w-10 h-10 text-slate-300 mx-auto" />
              <p className="text-sm font-semibold text-slate-700">No cleared items in history</p>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                Items you check off and clear from your grocery list will appear here so you can easily bring them back anytime.
              </p>
            </div>
          ) : (
            filtered.map((item) => {
              const isRestored = restoredIds.has(item.id);

              return (
                <div
                  key={item.id}
                  className="bg-white rounded-xl border border-slate-200 p-3 flex items-center justify-between gap-3 hover:bg-slate-50/50 transition"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-slate-800 truncate">
                        {item.name}
                      </span>
                      <span className="text-xs text-slate-400 font-mono">
                        {item.amount} {item.unit}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5 flex-wrap">
                      <span className="bg-slate-100 px-1.5 py-0.2 rounded text-slate-600 font-medium">
                        {item.category}
                      </span>
                      {item.store && (
                        <span className="bg-emerald-50 text-emerald-800 px-1.5 py-0.2 rounded font-medium flex items-center gap-0.5">
                          <Store className="w-2.5 h-2.5 text-emerald-600" />
                          <span>{item.store}</span>
                        </span>
                      )}
                      {item.notes && (
                        <span className="italic">({item.notes})</span>
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRestore(item.id)}
                    disabled={isRestored}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 transition cursor-pointer shrink-0 ${
                      isRestored
                        ? 'bg-emerald-100 text-emerald-800 cursor-default'
                        : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs'
                    }`}
                  >
                    {isRestored ? (
                      <>
                        <Check className="w-3.5 h-3.5" />
                        <span>Added</span>
                      </>
                    ) : (
                      <>
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Back</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:px-5 border-t border-slate-100 bg-slate-50 text-right">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-200 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
