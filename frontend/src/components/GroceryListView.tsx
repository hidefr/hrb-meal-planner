import React, { useState } from 'react';
import {
  Check, CheckSquare, Square, MinusSquare, Trash2, Plus, RefreshCw, Copy,
  ShoppingBag, Store, RotateCcw, Filter, Edit3, X
} from 'lucide-react';
import { GroceryList, GroceryItem } from '../types';
import { copyToClipboard } from '../services/api';

interface GroceryListViewProps {
  groceryList: GroceryList;
  stores: string[];
  onToggleItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onUpdateStore: (id: string, store: string | null) => void;
  onUpdateQuantity: (id: string, amount?: number, have_amount?: number | null, notes?: string) => void;
  onOpenAddModal: () => void;
  onClearChecked: () => void;
  onOpenClearedHistory: () => void;
  onSync: () => void;
}

const CATEGORY_ORDER = [
  "Produce",
  "Meat & Seafood",
  "Dairy & Refrigerated",
  "Bakery",
  "Pantry",
  "Spices & Seasonings",
  "Frozen",
  "Other"
];

// Color palette for distinctive store badges
const STORE_COLORS: { [store: string]: { bg: string; text: string; border: string } } = {
  "Amazon": { bg: "bg-amber-50", text: "text-amber-800", border: "border-amber-200" },
  "Fred Meyer": { bg: "bg-blue-50", text: "text-blue-800", border: "border-blue-200" },
  "Trader Joe's": { bg: "bg-rose-50", text: "text-rose-800", border: "border-rose-200" },
  "Safeway": { bg: "bg-red-50", text: "text-red-800", border: "border-red-200" },
  "New Seasons": { bg: "bg-emerald-50", text: "text-emerald-800", border: "border-emerald-200" },
};

export const GroceryListView: React.FC<GroceryListViewProps> = ({
  groceryList,
  stores,
  onToggleItem,
  onDeleteItem,
  onUpdateStore,
  onUpdateQuantity,
  onOpenAddModal,
  onClearChecked,
  onOpenClearedHistory,
  onSync,
}) => {
  const [copied, setCopied] = useState(false);
  const [selectedStoreFilter, setSelectedStoreFilter] = useState<string>('all');
  const [adjustingItemId, setAdjustingItemId] = useState<string | null>(null);
  const [adjustHaveInput, setAdjustHaveInput] = useState<string>('');
  const [adjustTotalInput, setAdjustTotalInput] = useState<string>('');
  const [adjustNotesInput, setAdjustNotesInput] = useState<string>('');

  const defaultStores = stores && stores.length > 0 ? stores : [
    "Amazon",
    "Fred Meyer",
    "Trader Joe's",
    "Safeway",
    "New Seasons"
  ];

  // Filter items by store if a filter is active
  const filteredItems = groceryList.items.filter(item => {
    if (selectedStoreFilter === 'all') return true;
    if (selectedStoreFilter === 'unassigned') return !item.store;
    return item.store?.toLowerCase() === selectedStoreFilter.toLowerCase();
  });

  // Group items by category (map any non-standard category to 'Other' so no item can ever be hidden)
  const grouped: { [category: string]: GroceryItem[] } = {};
  filteredItems.forEach(item => {
    let cat = item.category || 'Other';
    if (!CATEGORY_ORDER.includes(cat)) {
      cat = 'Other';
    }
    grouped[cat] = grouped[cat] || [];
    grouped[cat].push(item);
  });

  const totalCount = groceryList.items.length;
  const checkedCount = groceryList.items.filter(i => i.checked).length;
  const progressPct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  const handleCopyList = async () => {
    let text = `🛒 *GROCERY LIST* (${checkedCount}/${totalCount} checked)\n\n`;
    CATEGORY_ORDER.forEach(cat => {
      const items = groceryList.items.filter(i => {
        const itemCat = i.category || 'Other';
        if (cat === 'Other') {
          return !CATEGORY_ORDER.includes(itemCat) || itemCat === 'Other';
        }
        return itemCat === cat;
      });
      if (items && items.length > 0) {
        text += `*${cat.toUpperCase()}*\n`;
        items.forEach(item => {
          const storeTag = item.store ? ` [@${item.store}]` : '';
          const partialNote = item.have_amount && item.have_amount > 0 && !item.checked
            ? ` (Have ${item.have_amount} of ${item.amount})`
            : '';
          text += `[${item.checked ? 'x' : ' '}] ${item.amount} ${item.unit} ${item.name}${storeTag}${partialNote}`;
          if (item.notes) text += ` (${item.notes})`;
          text += '\n';
        });
        text += '\n';
      }
    });

    const success = await copyToClipboard(text.trim());
    if (success) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleOpenAdjust = (e: React.MouseEvent, item: GroceryItem) => {
    e.stopPropagation();
    setAdjustingItemId(item.id);
    setAdjustHaveInput(item.have_amount != null ? String(item.have_amount) : '');
    setAdjustTotalInput(String(item.amount));
    setAdjustNotesInput(item.notes || '');
  };

  const handleSaveAdjust = (itemId: string) => {
    const total = parseFloat(adjustTotalInput);
    const have = adjustHaveInput.trim() !== '' ? parseFloat(adjustHaveInput) : null;
    onUpdateQuantity(
      itemId,
      !isNaN(total) && total > 0 ? total : undefined,
      have !== null && !isNaN(have) ? have : null,
      adjustNotesInput
    );
    setAdjustingItemId(null);
  };

  const handleQuickStepHave = (e: React.MouseEvent, item: GroceryItem, delta: number) => {
    e.stopPropagation();
    const currentHave = item.have_amount || 0;
    const step = item.amount <= 2 ? 0.5 : 1;
    const newHave = Math.max(0, Math.min(item.amount, Math.round((currentHave + delta * step) * 10) / 10));
    onUpdateQuantity(item.id, undefined, newHave > 0 ? newHave : null, undefined);
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-24 md:pb-8">
      {/* Header card with progress */}
      <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-600" />
              <span>Grocery List</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Consolidated from your meal plan with partial pantry tracking & store tags
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onOpenAddModal}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Item</span>
            </button>

            <button
              type="button"
              onClick={onOpenClearedHistory}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer border border-slate-200"
              title="View cleared/bought items history up to 200"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>Cleared History</span>
            </button>

            <button
              type="button"
              onClick={handleCopyList}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition cursor-pointer border border-slate-200"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={onSync}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl cursor-pointer"
              title="Resync with Meal Plan"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {checkedCount > 0 && (
              <button
                type="button"
                onClick={onClearChecked}
                className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold transition cursor-pointer"
              >
                Clear Checked ({checkedCount})
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs text-slate-500">
              <span>Shopping Progress</span>
              <span className="font-semibold text-emerald-700">{checkedCount} of {totalCount} items bought ({progressPct}%)</span>
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Store Filter Tabs for Mobile Shopping */}
      {totalCount > 0 && (
        <div className="bg-white p-3 rounded-2xl border border-slate-200 shadow-xs flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pl-1 shrink-0 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            <span>Store:</span>
          </span>

          <button
            type="button"
            onClick={() => setSelectedStoreFilter('all')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              selectedStoreFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            All Stores ({totalCount})
          </button>

          {defaultStores.map((st) => {
            const count = groceryList.items.filter(i => i.store?.toLowerCase() === st.toLowerCase()).length;
            const isSelected = selectedStoreFilter.toLowerCase() === st.toLowerCase();

            return (
              <button
                key={st}
                type="button"
                onClick={() => setSelectedStoreFilter(st)}
                className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>{st}</span>
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setSelectedStoreFilter('unassigned')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              selectedStoreFilter === 'unassigned'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Unassigned ({groceryList.items.filter(i => !i.store).length})
          </button>
        </div>
      )}

      {/* Grocery Aisle Groups */}
      {totalCount === 0 ? (
        <div className="bg-white p-8 rounded-3xl border border-dashed border-slate-300 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">Your grocery list is empty</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Once meals are added in your meal plan, ingredients will automatically be consolidated here by aisle. Or tap "Add Item" to add staples manually!
          </p>
          <button
            onClick={onOpenAddModal}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Item Manually</span>
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-2">
          <Store className="w-8 h-8 text-slate-400 mx-auto" />
          <p className="text-sm font-semibold text-slate-700">No items tagged for this store filter</p>
          <p className="text-xs text-slate-400">
            Tap "All Stores" or select store chips on your items below to tag where you plan to shop.
          </p>
          <button
            type="button"
            onClick={() => setSelectedStoreFilter('all')}
            className="mt-2 px-3.5 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold inline-block cursor-pointer"
          >
            Show All Items
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {CATEGORY_ORDER.map(cat => {
            const items = grouped[cat];
            if (!items || items.length === 0) return null;

            return (
              <div key={cat} className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-xs">
                {/* Aisle title */}
                <div className="px-4 py-2.5 bg-slate-50/90 border-b border-slate-200/80 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    {cat}
                  </span>
                  <span className="text-[11px] font-semibold text-slate-400 bg-white px-2 py-0.5 rounded-full border border-slate-200">
                    {items.length} {items.length === 1 ? 'item' : 'items'}
                  </span>
                </div>

                {/* Items */}
                <ul className="divide-y divide-slate-100">
                  {items.map(item => {
                    const isPartial = item.have_amount != null && item.have_amount > 0 && item.have_amount < item.amount;
                    const remainingNeed = isPartial ? Math.round((item.amount - (item.have_amount || 0)) * 10) / 10 : item.amount;
                    const isAdjusting = adjustingItemId === item.id;

                    return (
                      <li
                        key={item.id}
                        className={`p-3 sm:px-4 flex flex-col gap-2 transition ${
                          item.checked
                            ? 'bg-slate-50/60 opacity-60'
                            : isPartial
                            ? 'bg-amber-50/20'
                            : 'hover:bg-slate-50/40'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          {/* Checkbox & Name */}
                          <div
                            onClick={() => onToggleItem(item.id)}
                            className="flex items-start gap-3 cursor-pointer flex-1 select-none pr-2"
                          >
                            <button
                              type="button"
                              className="shrink-0 focus:outline-hidden mt-0.5"
                            >
                              {item.checked ? (
                                <CheckSquare className="w-5 h-5 text-emerald-600 fill-emerald-100" />
                              ) : isPartial ? (
                                <MinusSquare className="w-5 h-5 text-amber-500 fill-amber-50" />
                              ) : (
                                <Square className="w-5 h-5 text-slate-300 hover:text-slate-400" />
                              )}
                            </button>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`text-sm font-semibold ${
                                    item.checked
                                      ? 'line-through text-slate-400'
                                      : 'text-slate-900'
                                  }`}
                                >
                                  {item.name}
                                </span>

                                {/* Partial status badge */}
                                {isPartial && !item.checked && (
                                  <span className="text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                                    <span>Have {item.have_amount} of {item.amount}</span>
                                    <span className="text-amber-700 font-semibold">• Need {remainingNeed} more</span>
                                  </span>
                                )}
                              </div>

                              {/* Reference notes - NOT cut off; wraps cleanly so all meals are visible */}
                              <div className="mt-0.5 space-y-0.5">
                                {item.manual ? (
                                  <span className="inline-block text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-medium">
                                    Added manually
                                  </span>
                                ) : (
                                  item.recipe_references && item.recipe_references.length > 0 && (
                                    <p className="text-[11px] text-slate-500 leading-tight break-words">
                                      <span className="font-semibold text-slate-600">For:</span> {item.recipe_references.join(' • ')}
                                    </p>
                                  )
                                )}
                                {item.notes && (
                                  <span className="inline-block text-[11px] text-slate-400 italic">
                                    ({item.notes})
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Quantity & Actions */}
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Quantity pill (clickable to adjust partial) */}
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={(e) => handleOpenAdjust(e, item)}
                                className="font-mono text-xs font-semibold px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 flex items-center gap-1 transition cursor-pointer"
                                title="Click to adjust quantity or partial have"
                              >
                                <span>{item.amount} {item.unit}</span>
                                <Edit3 className="w-3 h-3 text-slate-400" />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => onDeleteItem(item.id)}
                              className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg transition cursor-pointer"
                              title="Delete item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Inline Adjust Dialog if open for this item */}
                        {isAdjusting && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="ml-8 p-3 rounded-2xl bg-slate-50 border border-emerald-200 space-y-2 animate-fadeIn"
                          >
                            <div className="flex items-center justify-between text-xs font-bold text-slate-800">
                              <span>Adjust Quantity & Partial Pantry</span>
                              <button
                                type="button"
                                onClick={() => setAdjustingItemId(null)}
                                className="text-slate-400 hover:text-slate-600"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">
                                  Total Needed:
                                </label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="any"
                                    value={adjustTotalInput}
                                    onChange={(e) => setAdjustTotalInput(e.target.value)}
                                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                                  />
                                  <span className="text-slate-400 text-[11px] font-mono">{item.unit}</span>
                                </div>
                              </div>

                              <div>
                                <label className="text-[10px] uppercase font-bold text-slate-500 block mb-0.5">
                                  Already Have:
                                </label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="any"
                                    placeholder="0"
                                    value={adjustHaveInput}
                                    onChange={(e) => setAdjustHaveInput(e.target.value)}
                                    className="w-full px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                                  />
                                  <span className="text-slate-400 text-[11px] font-mono">{item.unit}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-1">
                              <span className="text-[10px] text-slate-400">
                                Tip: If you have 1 of 2, enter 1 in "Already Have"
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setAdjustingItemId(null)}
                                  className="px-2.5 py-1 text-xs text-slate-500 hover:bg-slate-200 rounded-lg"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveAdjust(item.id)}
                                  className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-2xs"
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Store Selector Chips & Quick Partial Steppers */}
                        <div className="pl-8 pt-0.5 flex items-center justify-between gap-2 flex-wrap">
                          {/* Store chips */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-slate-400 font-medium mr-1 flex items-center gap-0.5">
                              <Store className="w-3 h-3 text-slate-400" />
                              <span>Store:</span>
                            </span>

                            {defaultStores.map((storeName) => {
                              const isSelected = item.store?.toLowerCase() === storeName.toLowerCase();
                              const colors = STORE_COLORS[storeName] || {
                                bg: "bg-slate-100",
                                text: "text-slate-800",
                                border: "border-slate-300"
                              };

                              return (
                                <button
                                  key={storeName}
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onUpdateStore(item.id, isSelected ? null : storeName);
                                  }}
                                  className={`text-[10px] px-2 py-0.5 rounded-lg border font-semibold transition cursor-pointer ${
                                    isSelected
                                      ? `${colors.bg} ${colors.text} ${colors.border} ring-1 ring-emerald-500 shadow-2xs`
                                      : 'bg-white text-slate-400 border-slate-200 hover:text-slate-700 hover:bg-slate-50'
                                  }`}
                                  title={isSelected ? `Tap to remove ${storeName} tag` : `Tag for ${storeName}`}
                                >
                                  {storeName}
                                </button>
                              );
                            })}
                          </div>

                          {/* Quick Have +/- Stepper */}
                          {!item.checked && item.amount > 1 && (
                            <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium">
                              <span>Have in pantry:</span>
                              <div className="flex items-center border border-slate-200 rounded-lg overflow-hidden bg-white shadow-2xs">
                                <button
                                  type="button"
                                  onClick={(e) => handleQuickStepHave(e, item, -1)}
                                  className="px-1.5 py-0.5 hover:bg-slate-100 text-slate-600 font-bold"
                                  title="Decrease amount you have"
                                >
                                  -
                                </button>
                                <span className="px-1.5 font-bold font-mono text-emerald-800">
                                  {item.have_amount || 0}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => handleQuickStepHave(e, item, 1)}
                                  className="px-1.5 py-0.5 hover:bg-slate-100 text-slate-600 font-bold"
                                  title="Increase amount you have"
                                >
                                  +
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
