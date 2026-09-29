import React, { useState } from 'react';
import { ChefHat, RefreshCw, Copy, Check, RotateCcw, Settings } from 'lucide-react';
import { MealPlan, GroceryList } from '../types';
import { copyToClipboard } from '../services/api';

interface NavbarProps {
  mealPlan: MealPlan | null;
  groceryList: GroceryList | null;
  onResetPlan: () => void;
  onRefreshData: () => void;
  onOpenSettings: () => void;
  isSyncing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  mealPlan,
  groceryList,
  onResetPlan,
  onRefreshData,
  onOpenSettings,
  isSyncing,
}) => {
  const [copied, setCopied] = useState(false);

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

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-xs border-b border-slate-200 px-4 py-2.5 shadow-xs">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs shadow-emerald-200">
            <ChefHat className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-base tracking-tight text-slate-900">TasteCraft</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.2 rounded-full bg-emerald-100 text-emerald-800">
                AI
              </span>
            </div>
            <p className="text-[11px] text-slate-500 hidden sm:block">AI Meal Planner & Grocery Copilot</p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Copy Summary */}
          <button
            type="button"
            onClick={handleCopySummary}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border ${
              copied
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'text-slate-700 bg-slate-50 hover:bg-slate-100 border-slate-200'
            }`}
            title="Copy entire plan and grocery list to clipboard"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
            <span>{copied ? 'Copied!' : 'Copy Plan'}</span>
          </button>

          {/* Settings */}
          <button
            type="button"
            onClick={onOpenSettings}
            className="p-2 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-xl text-xs flex items-center gap-1 transition cursor-pointer"
            title="Preferences & Stores"
          >
            <Settings className="w-4 h-4 text-slate-500" />
            <span className="hidden sm:inline text-xs font-medium">Settings</span>
          </button>

          {/* Refresh / Sync */}
          <button
            type="button"
            onClick={onRefreshData}
            disabled={isSyncing}
            className={`p-2 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-xl text-xs flex items-center gap-1 transition cursor-pointer ${
              isSyncing ? 'animate-spin text-emerald-600' : ''
            }`}
            title="Sync data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Reset Week */}
          <button
            type="button"
            onClick={() => {
              if (window.confirm('Reset this week meal plan to start fresh?')) {
                onResetPlan();
              }
            }}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl text-xs transition cursor-pointer"
            title="Reset week meal plan"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>
    </header>
  );
};
