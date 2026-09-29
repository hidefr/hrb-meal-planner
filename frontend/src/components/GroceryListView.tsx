import React, { useState } from 'react';
import { Check, CheckSquare, Square, Trash2, Plus, Sparkles, RefreshCw, Copy, ShoppingBag } from 'lucide-react';
import { GroceryList, GroceryItem } from '../types';

interface GroceryListViewProps {
  groceryList: GroceryList;
  onToggleItem: (id: string) => void;
  onDeleteItem: (id: string) => void;
  onOpenAddModal: () => void;
  onClearChecked: () => void;
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

export const GroceryListView: React.FC<GroceryListViewProps> = ({
  groceryList,
  onToggleItem,
  onDeleteItem,
  onOpenAddModal,
  onClearChecked,
  onSync
}) => {
  const [copied, setCopied] = useState(false);

  // Group items by category
  const grouped: { [category: string]: GroceryItem[] } = {};
  groceryList.items.forEach(item => {
    const cat = item.category || 'Other';
    grouped[cat] = grouped[cat] || [];
    grouped[cat].push(item);
  });

  const totalCount = groceryList.items.length;
  const checkedCount = groceryList.items.filter(i => i.checked).length;
  const progressPct = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;

  const handleCopyList = () => {
    let text = `🛒 *GROCERY LIST* (${checkedCount}/${totalCount} checked)\n\n`;
    CATEGORY_ORDER.forEach(cat => {
      const items = grouped[cat];
      if (items && items.length > 0) {
        text += `*${cat.toUpperCase()}*\n`;
        items.forEach(item => {
          text += `[${item.checked ? 'x' : ' '}] ${item.amount} ${item.unit} ${item.name}`;
          if (item.notes) text += ` (${item.notes})`;
          text += '\n';
        });
        text += '\n';
      }
    });

    navigator.clipboard.writeText(text.trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4 max-w-4xl mx-auto pb-24 md:pb-8">
      {/* Header card with progress */}
      <div className="bg-white p-4 sm:p-5 rounded-2xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShoppingBag className="w-5 h-5 text-emerald-600" />
              <span>Manageable Grocery List</span>
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Consolidated from your meal plan and organized by store aisle
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={onOpenAddModal}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add Item</span>
            </button>
            <button
              onClick={handleCopyList}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy'}</span>
            </button>
            <button
              onClick={onSync}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-xl"
              title="Resync with Meal Plan"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            {checkedCount > 0 && (
              <button
                onClick={onClearChecked}
                className="px-2.5 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-medium transition"
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

      {/* Grocery Aisle Groups */}
      {totalCount === 0 ? (
        <div className="bg-white p-8 rounded-2xl border border-dashed border-slate-300 text-center space-y-3">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
            <ShoppingBag className="w-6 h-6" />
          </div>
          <h3 className="text-sm font-semibold text-slate-800">Your grocery list is empty</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Once meals are added in your weekly plan, ingredients will automatically be consolidated here by aisle. Or tap "Add Item" to add staples manually!
          </p>
          <button
            onClick={onOpenAddModal}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>Add Item Manually</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {CATEGORY_ORDER.map(cat => {
            const items = grouped[cat];
            if (!items || items.length === 0) return null;

            return (
              <div key={cat} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
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
                  {items.map(item => (
                    <li
                      key={item.id}
                      className={`p-3 sm:px-4 flex items-center justify-between transition ${
                        item.checked ? 'bg-slate-50/60 opacity-60' : 'hover:bg-slate-50/40'
                      }`}
                    >
                      {/* Checkbox & Name */}
                      <div
                        onClick={() => onToggleItem(item.id)}
                        className="flex items-center gap-3 cursor-pointer flex-1 select-none pr-2"
                      >
                        <button
                          type="button"
                          className="shrink-0 text-emerald-600 focus:outline-none"
                        >
                          {item.checked ? (
                            <CheckSquare className="w-5 h-5 fill-emerald-100" />
                          ) : (
                            <Square className="w-5 h-5 text-slate-300 hover:text-slate-400" />
                          )}
                        </button>

                        <div className="flex-1">
                          <span
                            className={`text-sm font-medium ${
                              item.checked
                                ? 'line-through text-slate-400'
                                : 'text-slate-800'
                            }`}
                          >
                            {item.name}
                          </span>

                          {/* Reference badges */}
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            {item.manual ? (
                              <span className="text-[10px] text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded font-medium">
                                Added manually
                              </span>
                            ) : (
                              item.recipe_references && item.recipe_references.length > 0 && (
                                <span className="text-[10px] text-slate-400 truncate max-w-xs">
                                  For: {item.recipe_references.join(', ')}
                                </span>
                              )
                            )}
                            {item.notes && (
                              <span className="text-[10px] text-slate-500 italic">
                                ({item.notes})
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Quantity & Delete */}
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-xs font-semibold px-2 py-1 rounded-md bg-slate-100 text-slate-700">
                          {item.amount} {item.unit}
                        </span>
                        <button
                          onClick={() => onDeleteItem(item.id)}
                          className="p-1.5 text-slate-300 hover:text-rose-600 rounded-lg transition"
                          title="Delete item"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
