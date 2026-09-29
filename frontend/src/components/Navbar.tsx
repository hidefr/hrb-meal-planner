import React, { useState } from 'react';
import { ChefHat, RefreshCw, Copy, Check, RotateCcw, Smartphone, HelpCircle } from 'lucide-react';
import { MealPlan, GroceryList } from '../types';

interface NavbarProps {
  mealPlan: MealPlan | null;
  groceryList: GroceryList | null;
  onResetPlan: () => void;
  onRefreshData: () => void;
  isSyncing: boolean;
}

export const Navbar: React.FC<NavbarProps> = ({
  mealPlan,
  groceryList,
  onResetPlan,
  onRefreshData,
  isSyncing,
}) => {
  const [copied, setCopied] = useState(false);
  const [showPwaHelp, setShowPwaHelp] = useState(false);

  const handleCopySummary = () => {
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
        byCat[i.category].push(`- [${i.checked ? 'x' : ' '}] ${i.amount} ${i.unit} ${i.name}`);
      });
      Object.entries(byCat).forEach(([cat, items]) => {
        text += `\n*${cat}:*\n` + items.join('\n') + '\n';
      });
    }

    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200 px-4 py-3 shadow-xs">
      <div className="max-w-6xl mx-auto flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-sm shadow-emerald-200">
            <ChefHat className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-lg tracking-tight text-slate-900">TasteCraft</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800">
                AI Copilot
              </span>
            </div>
            <p className="text-xs text-slate-500 hidden sm:block">Hermes-powered household meal & grocery planner</p>
          </div>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Mobile Install Tip Button */}
          <button
            onClick={() => setShowPwaHelp(!showPwaHelp)}
            className="p-2 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-lg text-xs flex items-center gap-1"
            title="Install on Mobile (iOS / Android)"
          >
            <Smartphone className="w-4 h-4 text-emerald-600" />
            <span className="hidden md:inline font-medium">Mobile Install</span>
          </button>

          {/* Copy Summary */}
          <button
            onClick={handleCopySummary}
            className="p-2 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-lg text-xs flex items-center gap-1 transition"
            title="Copy plan & grocery list to clipboard"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            <span className="hidden md:inline font-medium">{copied ? 'Copied!' : 'Copy Plan'}</span>
          </button>

          {/* Refresh / Sync */}
          <button
            onClick={onRefreshData}
            disabled={isSyncing}
            className={`p-2 text-slate-600 hover:text-emerald-700 hover:bg-slate-100 rounded-lg text-xs flex items-center gap-1 ${
              isSyncing ? 'animate-spin text-emerald-600' : ''
            }`}
            title="Sync data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Reset Week */}
          <button
            onClick={() => {
              if (window.confirm('Reset this week meal plan to start fresh?')) {
                onResetPlan();
              }
            }}
            className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs"
            title="Reset week"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile Install Instructions Drawer/Modal */}
      {showPwaHelp && (
        <div className="mt-3 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-slate-700 space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between font-semibold text-emerald-900">
            <span>📲 How to Install on iPhone & Android:</span>
            <button onClick={() => setShowPwaHelp(false)} className="text-slate-400 hover:text-slate-600">✕</button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
            <div className="p-2 bg-white rounded-lg border border-emerald-100">
              <strong className="text-slate-800">🍏 iPhone (Safari):</strong>
              <p>1. Open this page in Safari on your iPhone.</p>
              <p>2. Tap the <strong>Share</strong> button (box with up arrow).</p>
              <p>3. Tap <strong>"Add to Home Screen"</strong>.</p>
            </div>
            <div className="p-2 bg-white rounded-lg border border-emerald-100">
              <strong className="text-slate-800">🤖 Android (Chrome):</strong>
              <p>1. Open this page in Chrome on Android.</p>
              <p>2. Tap the <strong>three dots (⋮)</strong> menu.</p>
              <p>3. Tap <strong>"Install App"</strong> or <strong>"Add to Home screen"</strong>.</p>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
