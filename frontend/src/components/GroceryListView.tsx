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

// Color palette for distinctive store badges in warm espresso theme
const STORE_COLORS: { [store: string]: { bg: string; text: string; border: string } } = {
  "Amazon": { bg: "bg-amber-500/20", text: "text-amber-300", border: "border-amber-500/40" },
  "Fred Meyer": { bg: "bg-blue-500/20", text: "text-blue-300", border: "border-blue-500/40" },
  "Trader Joe's": { bg: "bg-rose-500/20", text: "text-rose-300", border: "border-rose-500/40" },
  "Safeway": { bg: "bg-red-500/20", text: "text-red-300", border: "border-red-500/40" },
  "New Seasons": { bg: "bg-emerald-500/20", text: "text-emerald-300", border: "border-emerald-500/40" },
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
      <div className="bg-[#181310] p-4 sm:p-5 rounded-3xl border border-[#34271D] shadow-md space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-[#f5eedf] flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-amber-400" />
              <span>Grocery List</span>
            </h2>
            <p className="text-xs text-[#a89988] mt-0.5">
              Consolidated from your meal plan with partial pantry tracking & store tags
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onOpenAddModal}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-bold flex items-center gap-1.5 shadow-md transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Item</span>
            </button>

            <button
              type="button"
              onClick={onOpenClearedHistory}
              className="px-3 py-1.5 rounded-xl bg-[#211A15] hover:bg-[#2C211A] text-[#d6c7b2] hover:text-[#f5eedf] text-xs font-medium flex items-center gap-1.5 transition cursor-pointer border border-[#34271D]"
              title="View cleared/bought items history up to 200"
            >
              <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
              <span>Cleared History</span>
            </button>

            <button
              type="button"
              onClick={handleCopyList}
              className="px-3 py-1.5 rounded-xl bg-[#211A15] hover:bg-[#2C211A] text-[#d6c7b2] hover:text-[#f5eedf] text-xs font-medium flex items-center gap-1.5 transition cursor-pointer border border-[#34271D]"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-amber-400" /> : <Copy className="w-3.5 h-3.5 text-[#8c7b6d]" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>

            <button
              type="button"
              onClick={onSync}
              className="p-1.5 text-[#8c7b6d] hover:text-[#f5eedf] hover:bg-[#2C211A] rounded-xl cursor-pointer transition border border-[#34271D]"
              title="Resync with Meal Plan"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {checkedCount > 0 && (
              <button
                type="button"
                onClick={onClearChecked}
                className="px-2.5 py-1.5 rounded-xl bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-900/60 text-xs font-semibold transition cursor-pointer"
              >
                Clear Checked ({checkedCount})
              </button>
            )}
          </div>
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="space-y-1.5 pt-1">
            <div className="flex justify-between text-xs text-[#a89988]">
              <span>Shopping Progress</span>
              <span className="font-semibold text-amber-300">{checkedCount} of {totalCount} items bought ({progressPct}%)</span>
            </div>
            <div className="w-full h-2 bg-[#140F0C] border border-[#34271D] rounded-full overflow-hidden">
              <div
                className="h-full bg-amber-500 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Store Filter Tabs for Mobile Shopping */}
      {totalCount > 0 && (
        <div className="bg-[#181310] p-3 rounded-2xl border border-[#34271D] shadow-xs flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-[11px] font-bold text-[#8c7b6d] uppercase tracking-wider pl-1 shrink-0 flex items-center gap-1">
            <Filter className="w-3 h-3" />
            <span>Store:</span>
          </span>

          <button
            type="button"
            onClick={() => setSelectedStoreFilter('all')}
            className={`px-3 py-1 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
              selectedStoreFilter === 'all'
                ? 'bg-amber-600 text-stone-950 font-bold shadow-md'
                : 'bg-[#211A15] text-[#d6c7b2] hover:bg-[#2C211A] hover:text-[#f5eedf] border border-[#34271D]'
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
                    ? 'bg-amber-600 text-stone-950 font-bold shadow-md'
                    : 'bg-[#211A15] text-[#d6c7b2] hover:bg-[#2C211A] hover:text-[#f5eedf] border border-[#34271D]'
                }`}
              >
                <span>{st}</span>
                {count > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isSelected ? 'bg-stone-950/30 text-stone-950' : 'bg-[#140F0C] text-amber-300 border border-[#34271D]'
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
                ? 'bg-amber-600 text-stone-950 font-bold shadow-md'
                : 'bg-[#211A15] text-[#d6c7b2] hover:bg-[#2C211A] hover:text-[#f5eedf] border border-[#34271D]'
            }`}
          >
            Unassigned ({groceryList.items.filter(i => !i.store).length})
          </button>
        </div>
      )}

      {/* Grocery Aisle Groups */}
      {totalCount === 0 ? (
        <div className="bg-[#181310] p-8 rounded-3xl border border-dashed border-[#34271D] text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 text-amber-300 flex items-center justify-center mx-auto border border-amber-500/30">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-[#f5eedf]">Your grocery list is empty</h3>
          <p className="text-xs text-[#a89988] max-w-sm mx-auto">
            Once meals are added in your meal plan, ingredients will automatically be consolidated here by aisle. Or tap "Add Item" to add staples manually!
          </p>
          <button
            onClick={onOpenAddModal}
            className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-bold inline-flex items-center gap-1.5 shadow-md cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Add Item Manually</span>
          </button>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="bg-[#181310] p-8 rounded-3xl border border-[#34271D] text-center space-y-2">
          <Store className="w-8 h-8 text-[#8c7b6d] mx-auto" />
          <p className="text-sm font-semibold text-[#f5eedf]">No items tagged for this store filter</p>
          <p className="text-xs text-[#8c7b6d]">
            Tap "All Stores" or select store chips on your items below to tag where you plan to shop.
          </p>
          <button
            type="button"
            onClick={() => setSelectedStoreFilter('all')}
            className="mt-2 px-3.5 py-1.5 rounded-xl bg-[#211A15] hover:bg-[#2C211A] text-[#d6c7b2] hover:text-[#f5eedf] border border-[#34271D] text-xs font-semibold inline-block cursor-pointer"
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
              <div key={cat} className="bg-[#181310] rounded-3xl border border-[#34271D] overflow-hidden shadow-xs">
                {/* Aisle title */}
                <div className="px-4 py-2.5 bg-[#211A15] border-b border-[#34271D] flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#f5eedf]">
                    {cat}
                  </span>
                  <span className="text-[11px] font-semibold text-[#a89988] bg-[#140F0C] px-2 py-0.5 rounded-full border border-[#34271D]">
                    {items.length} {items.length === 1 ? 'item' : 'items'}
                  </span>
                </div>

                {/* Items */}
                <ul className="divide-y divide-[#251D17]">
                  {items.map(item => {
                    const isPartial = item.have_amount != null && item.have_amount > 0 && item.have_amount < item.amount;
                    const remainingNeed = isPartial ? Math.round((item.amount - (item.have_amount || 0)) * 10) / 10 : item.amount;
                    const isAdjusting = adjustingItemId === item.id;

                    return (
                      <li
                        key={item.id}
                        className={`p-3 sm:px-4 flex flex-col gap-2 transition ${
                          item.checked
                            ? 'bg-[#140F0C]/60 opacity-50'
                            : isPartial
                            ? 'bg-amber-500/5'
                            : 'hover:bg-[#211A15]/40'
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
                              className="shrink-0 focus:outline-hidden mt-0.5 cursor-pointer"
                            >
                              {item.checked ? (
                                <CheckSquare className="w-5 h-5 text-amber-400 fill-amber-950/60" />
                              ) : isPartial ? (
                                <MinusSquare className="w-5 h-5 text-amber-400 fill-amber-950/60" />
                              ) : (
                                <Square className="w-5 h-5 text-[#8c7b6d] hover:text-amber-400" />
                              )}
                            </button>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span
                                  className={`text-sm font-semibold ${
                                    item.checked
                                      ? 'line-through text-[#8c7b6d]'
                                      : 'text-[#f5eedf]'
                                  }`}
                                >
                                  {item.name}
                                </span>

                                {/* Partial status badge */}
                                {isPartial && !item.checked && (
                                  <span className="text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 shadow-2xs">
                                    <span>Have {item.have_amount} of {item.amount}</span>
                                    <span className="text-amber-400 font-semibold">• Need {remainingNeed} more</span>
                                  </span>
                                )}
                              </div>

                              {/* Reference notes - NOT cut off; wraps cleanly so all meals are visible */}
                              <div className="mt-0.5 space-y-0.5">
                                {item.manual ? (
                                  <span className="inline-block text-[10px] text-amber-300 bg-amber-500/15 border border-amber-500/30 px-1.5 py-0.2 rounded font-medium">
                                    Added manually
                                  </span>
                                ) : (
                                  item.recipe_references && item.recipe_references.length > 0 && (
                                    <p className="text-[11px] text-[#a89988] leading-tight break-words">
                                      <span className="font-semibold text-[#f5eedf]">For:</span> {item.recipe_references.join(' • ')}
                                    </p>
                                  )
                                )}
                                {item.notes && (
                                  <span className="inline-block text-[11px] text-[#8c7b6d] italic">
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
                                className="font-mono text-xs font-semibold px-2 py-1 rounded-lg bg-[#211A15] hover:bg-[#2C211A] text-[#f5eedf] border border-[#34271D] hover:border-amber-500/40 flex items-center gap-1 transition cursor-pointer"
                                title="Click to adjust quantity or partial have"
                              >
                                <span>{item.amount} {item.unit}</span>
                                <Edit3 className="w-3 h-3 text-amber-400" />
                              </button>
                            </div>

                            <button
                              type="button"
                              onClick={() => onDeleteItem(item.id)}
                              className="p-1.5 text-[#8c7b6d] hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
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
                            className="ml-8 p-3 rounded-2xl bg-[#211A15] border border-amber-500/40 space-y-2 animate-fadeIn"
                          >
                            <div className="flex items-center justify-between text-xs font-bold text-[#f5eedf]">
                              <span>Adjust Quantity & Partial Pantry</span>
                              <button
                                type="button"
                                onClick={() => setAdjustingItemId(null)}
                                className="text-[#8c7b6d] hover:text-[#f5eedf]"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <label className="text-[10px] uppercase font-bold text-[#a89988] block mb-0.5">
                                  Total Needed:
                                </label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="any"
                                    value={adjustTotalInput}
                                    onChange={(e) => setAdjustTotalInput(e.target.value)}
                                    className="w-full px-2 py-1 bg-[#140F0C] border border-[#3B2C21] text-[#f5eedf] rounded-lg text-xs focus:border-amber-500 focus:outline-hidden"
                                  />
                                  <span className="text-[#8c7b6d] text-[11px] font-mono">{item.unit}</span>
                                </div>
                              </div>

                              <div>
                                <label className="text-[10px] uppercase font-bold text-[#a89988] block mb-0.5">
                                  Already Have:
                                </label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    step="any"
                                    placeholder="0"
                                    value={adjustHaveInput}
                                    onChange={(e) => setAdjustHaveInput(e.target.value)}
                                    className="w-full px-2 py-1 bg-[#140F0C] border border-[#3B2C21] text-[#f5eedf] rounded-lg text-xs focus:border-amber-500 focus:outline-hidden"
                                  />
                                  <span className="text-[#8c7b6d] text-[11px] font-mono">{item.unit}</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center justify-between gap-2 pt-1">
                              <span className="text-[10px] text-[#8c7b6d]">
                                Tip: If you have 1 of 2, enter 1 in "Already Have"
                              </span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setAdjustingItemId(null)}
                                  className="px-2.5 py-1 text-xs text-[#a89988] hover:bg-[#2C211A] hover:text-[#f5eedf] rounded-lg cursor-pointer"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSaveAdjust(item.id)}
                                  className="px-3 py-1 bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs rounded-lg shadow-md cursor-pointer"
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
                            <span className="text-[10px] text-[#8c7b6d] font-medium mr-1 flex items-center gap-0.5">
                              <Store className="w-3 h-3 text-amber-400" />
                              <span>Store:</span>
                            </span>

                            {defaultStores.map((storeName) => {
                              const isSelected = item.store?.toLowerCase() === storeName.toLowerCase();
                              const colors = STORE_COLORS[storeName] || {
                                bg: "bg-[#211A15]",
                                text: "text-[#d6c7b2]",
                                border: "border-[#34271D]"
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
                                      ? `${colors.bg} ${colors.text} ${colors.border} ring-1 ring-amber-400 shadow-2xs`
                                      : 'bg-[#140F0C] text-[#8c7b6d] border-[#34271D] hover:text-[#f5eedf] hover:bg-[#211A15]'
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
                            <div className="flex items-center gap-1 text-[10px] text-[#a89988] font-medium">
                              <span>Have in pantry:</span>
                              <div className="flex items-center border border-[#34271D] rounded-lg overflow-hidden bg-[#140F0C] shadow-2xs">
                                <button
                                  type="button"
                                  onClick={(e) => handleQuickStepHave(e, item, -1)}
                                  className="px-1.5 py-0.5 hover:bg-[#211A15] text-[#d6c7b2] font-bold cursor-pointer"
                                  title="Decrease amount you have"
                                >
                                  -
                                </button>
                                <span className="px-1.5 font-bold font-mono text-amber-300">
                                  {item.have_amount || 0}
                                </span>
                                <button
                                  type="button"
                                  onClick={(e) => handleQuickStepHave(e, item, 1)}
                                  className="px-1.5 py-0.5 hover:bg-[#211A15] text-[#d6c7b2] font-bold cursor-pointer"
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
