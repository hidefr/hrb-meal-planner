import React, { useState } from 'react';
import {
  BookOpen, Search, Sparkles, Calendar, ShoppingBag, MessageSquare,
  Settings, Mic, Store, History, CheckCircle2, HelpCircle, ChevronRight,
  ChevronDown, ShieldCheck, ArrowRight, Check, Sliders, Smartphone
} from 'lucide-react';

export const UserGuideView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [openSection, setOpenSection] = useState<string | null>('grocery');

  const toggleSection = (id: string) => {
    setOpenSection(openSection === id ? null : id);
  };

  const sections = [
    {
      id: 'quickstart',
      title: 'Quick Start & Mobile Access',
      icon: <Smartphone className="w-5 h-5 text-emerald-600" />,
      badge: 'Getting Started',
      content: (
        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
          <p>
            Welcome to <strong className="text-slate-900 font-semibold">TasteCraft</strong>! Designed for couples to effortlessly plan delicious weekly meals, coordinate grocery shopping, and organize recipes together.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
                <Calendar className="w-4 h-4 text-emerald-600" />
                <span>1. Plan Meals</span>
              </div>
              <p className="text-xs text-slate-500">
                Use 1-click AI suggestions or browse your past 50 planned meals to assemble your week in seconds.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
                <ShoppingBag className="w-4 h-4 text-emerald-600" />
                <span>2. Shop Together</span>
              </div>
              <p className="text-xs text-slate-500">
                Ingredients aggregate automatically. Tag items by store (Amazon, Fred Meyer, Trader Joe's, etc.) and track partial stock.
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="font-semibold text-slate-800 flex items-center gap-1.5 mb-1">
                <MessageSquare className="w-4 h-4 text-emerald-600" />
                <span>3. Voice & AI Copilot</span>
              </div>
              <p className="text-xs text-slate-500">
                Tap the microphone to speak naturally or chat with your AI assistant to adjust recipes, days, or groceries.
              </p>
            </div>
          </div>

          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-900">
            <strong className="font-semibold">📱 Access on Your Phones:</strong> Both of you can open this app on your smartphones using your home Wi-Fi network. Simply open Safari or Chrome and navigate to the address shown in the tray icon (e.g. <code className="bg-emerald-100 px-1.5 py-0.5 rounded font-mono font-semibold">http://&lt;laptop-ip&gt;:8000</code>). You can also add it to your phone's home screen as a web app!
          </div>
        </div>
      )
    },
    {
      id: 'grocery',
      title: 'Grocery List: How It Works & Best Practices',
      icon: <ShoppingBag className="w-5 h-5 text-emerald-600" />,
      badge: 'Most Important',
      content: (
        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
          <p>
            The grocery list is designed to be smart and flexible so you never buy duplicates or accidentally lose items.
          </p>

          <div className="space-y-3">
            {/* Rule 1: Recipe Aggregation */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="font-semibold text-slate-800 text-sm mb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                Automatic Recipe Aggregation
              </div>
              <p className="text-xs text-slate-600">
                When you add meals to your meal plan, all recipe ingredients automatically drop into your grocery list. If two meals both call for garlic (e.g., 3 cloves on Tuesday and 3 cloves on Thursday), they are combined into <strong>6 cloves</strong> with a tag: <span className="bg-slate-200 px-1.5 py-0.5 rounded text-[10px] font-semibold text-slate-700">For: Garlic Noodles, Stir Fry</span>.
              </p>
            </div>

            {/* Rule 2: Manual Items */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="font-semibold text-slate-800 text-sm mb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                Manual Items (Milk, Eggs, Coffee, Snacks)
              </div>
              <p className="text-xs text-slate-600">
                Any item added manually (via <strong>"+ Add Item"</strong> or by asking the AI copilot <em>"Add half and half to the grocery list"</em>) is tagged as a <strong>Manual Item</strong>. 
                <span className="block mt-1 text-emerald-800 font-medium">
                  🛡️ Manual items are 100% immune to meal changes! Adding, removing, or re-planning meals will never delete or alter your manual groceries.
                </span>
              </p>
            </div>

            {/* Rule 3: Checked vs Cleared */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="font-semibold text-slate-800 text-sm mb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">3</span>
                "Already Have It" vs. "Clear Checked"
              </div>
              <ul className="text-xs space-y-1.5 mt-1 list-disc list-inside text-slate-600">
                <li>
                  <strong className="text-slate-800">Checking the box:</strong> Tap the checkbox when you already have an ingredient at home or when you put it in your cart at the store. It crosses it off with a strike-through line, <em>but leaves it on your list</em> so both of you can see you have it ready.
                </li>
                <li>
                  <strong className="text-slate-800">Clear Checked:</strong> Only click <strong>"Clear Checked"</strong> after you've finished shopping or after you've made the meals.
                </li>
                <li>
                  <strong className="text-slate-800">Cleared History:</strong> Cleared items are safely saved in <strong>Cleared History</strong> (up to 200 items). Tap the <strong>History</strong> button anytime to view cleared items and tap <em>"Add Back to List"</em> with one click.
                </li>
              </ul>
            </div>

            {/* Rule 4: Partial Stock */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="font-semibold text-slate-800 text-sm mb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">4</span>
                Partial Quantities & "Half Used" Tracking
              </div>
              <p className="text-xs text-slate-600 mb-2">
                What if you need 2 heads of bok choy, but you already have 1 in the fridge? Or what if you have garlic for two meals and you use half on Tuesday?
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5 text-xs text-amber-900 space-y-1">
                <div className="font-semibold flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-700" />
                  <span>Use the Inline Stepper: [ - ] Have: X [ + ]</span>
                </div>
                <p>
                  • Tap <strong>[ + ]</strong> to record how many you have on hand.
                </p>
                <p>
                  • If you have 1 of 2 needed, an amber badge appears: <strong>“Have 1 of 2 • Need 1 more”</strong> so you only buy what you lack.
                </p>
                <p>
                  • Once <code>Have ≥ Needed</code>, the item automatically marks itself checked.
                </p>
                <p>
                  • When you cook a meal and use some up, simply tap <strong>[ - ]</strong> to decrease your on-hand count, and it flags that you need more for the rest of the week!
                </p>
              </div>
            </div>

            {/* Rule 5: Store Checkboxes */}
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="font-semibold text-slate-800 text-sm mb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">5</span>
                Store Tagging & Filters
              </div>
              <p className="text-xs text-slate-600">
                Next to each item, tap the store dropdown to pick where you'll get it (e.g. <em>Amazon, Fred Meyer, Trader Joe's, Safeway, New Seasons</em>). You can also click the store filter pill at the top of the grocery list to isolate just the items for that store when you're walking the aisles!
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'mealplan',
      title: 'Meal Planning & Past Meal Log',
      icon: <Calendar className="w-5 h-5 text-emerald-600" />,
      badge: 'Weekly Schedule',
      content: (
        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
          <p>
            Plan all 7 days of dinner in just a couple minutes:
          </p>

          <div className="space-y-2.5">
            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <Sparkles className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <strong className="text-slate-800 text-xs block">AI Suggest Day:</strong>
                <span className="text-xs text-slate-500">
                  Tap "AI Suggest" on any empty slot. It respects your active dietary preferences and generates a complete recipe with ingredients, cook time, and instructions.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <Calendar className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <strong className="text-slate-800 text-xs block">Plan Entire Week:</strong>
                <span className="text-xs text-slate-500">
                  Tap "Plan Entire Week" in the top header. You can ask for themes (e.g. "comfort foods with high protein" or "quick 20-minute dinners") to fill all empty days in one shot.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl border border-slate-200">
              <History className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              <div>
                <strong className="text-slate-800 text-xs block">Meal Plan History Log & Pinning (Up to 50 Meals):</strong>
                <span className="text-xs text-slate-500">
                  Tap the <strong>History</strong> button in the Meal Plan tab. Every meal you plan is logged (storing up to the last 50 meals). You can <strong>pin</strong> favorites so they never leave the log, and tap <strong>"Add to Plan"</strong> to instantly reuse last week's favorite dinner on any day!
                </span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'voice-chat',
      title: 'Voice-to-Text & AI Copilot',
      icon: <Mic className="w-5 h-5 text-emerald-600" />,
      badge: 'Hands-Free',
      content: (
        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
          <p>
            You can plan hands-free in the kitchen or on your phone using high-accuracy voice-to-text.
          </p>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="font-semibold text-slate-800 text-sm flex items-center gap-2">
              <Mic className="w-4 h-4 text-rose-500" />
              Voice-to-Text (Just Like Antigravity)
            </div>
            <p className="text-xs text-slate-600">
              • Tap the <strong>Microphone</strong> button in the chat copilot input.
            </p>
            <p className="text-xs text-slate-600">
              • Speak your thoughts naturally. The text streams in real-time.
            </p>
            <p className="text-xs text-slate-600">
              • It <strong>appends to your existing text</strong> without erasing or overwriting what you already wrote.
            </p>
            <p className="text-xs text-slate-600">
              • Tap the microphone again (or press Enter) when finished speaking.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="font-semibold text-slate-800 text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-emerald-600" />
              Conversation History & Multi-Chat
            </div>
            <p className="text-xs text-slate-600">
              • The AI Copilot keeps a persistent history of your conversations.
            </p>
            <p className="text-xs text-slate-600">
              • On desktop or mobile, open the chat sidebar to switch between conversations, start a new chat, or review past ideas.
            </p>
          </div>

          <div className="p-3 bg-slate-100 rounded-xl text-xs text-slate-700">
            <strong className="block text-slate-900 mb-1 font-semibold">Try saying or typing:</strong>
            <ul className="list-disc list-inside space-y-1 text-slate-600">
              <li><em>"Plan 3 quick vegetarian dinners for Tuesday, Wednesday, and Thursday."</em></li>
              <li><em>"Add half and half, oat milk, and dark chocolate to the grocery list."</em></li>
              <li><em>"Change Friday's dinner to honey mustard salmon."</em></li>
              <li><em>"What can we make with chicken thighs, bell peppers, and rice?"</em></li>
            </ul>
          </div>
        </div>
      )
    },
    {
      id: 'preferences',
      title: 'Custom Preferences & Stores',
      icon: <Settings className="w-5 h-5 text-emerald-600" />,
      badge: 'Customization',
      content: (
        <div className="space-y-4 text-sm text-slate-600 leading-relaxed">
          <p>
            Customize your experience to fit your household's exact grocery and dietary needs.
          </p>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="font-semibold text-slate-800 text-sm">
              Custom Dietary & Meal Preferences
            </div>
            <p className="text-xs text-slate-600">
              • Click <strong>Settings</strong> in the top header.
            </p>
            <p className="text-xs text-slate-600">
              • Type any custom preference (e.g. <em>"Low sodium"</em>, <em>"High protein"</em>, <em>"Spicy"</em>) and click <strong>"Add & Activate"</strong>.
            </p>
            <p className="text-xs text-slate-600">
              • It immediately drops into your interactive suggestions grid as an <strong>active</strong> pill with a green checkmark.
            </p>
            <p className="text-xs text-slate-600">
              • Click any pill to toggle it active or inactive anytime, or tap the small <code>×</code> to remove it.
            </p>
          </div>

          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="font-semibold text-slate-800 text-sm">
              Custom Grocery Stores
            </div>
            <p className="text-xs text-slate-600">
              • You can add, edit, or remove your favorite local stores in Settings (e.g. <em>Amazon, Fred Meyer, Trader Joe's, Safeway, New Seasons, Costco, WinCo</em>).
            </p>
            <p className="text-xs text-slate-600">
              • They immediately appear in every grocery item's store selector.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'faq',
      title: 'Frequently Asked Questions (FAQ)',
      icon: <HelpCircle className="w-5 h-5 text-emerald-600" />,
      badge: 'Troubleshooting',
      content: (
        <div className="space-y-3 text-xs text-slate-600 leading-relaxed">
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <strong className="text-slate-800 text-sm block mb-1">
              Q: I accidentally cleared an ingredient for Tuesday's meal. How do I get it back?
            </strong>
            <p>
              Two easy ways:
              <br />
              1. Tap the <strong>History</strong> button in the Grocery List tab, find the cleared item, and tap <strong>"Add Back to List"</strong>.
              <br />
              2. Or simply tap <strong>"Sync List"</strong> (the refresh icon next to "+ Add Item"). The engine will notice Tuesday's recipe needs it and automatically re-adds it!
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <strong className="text-slate-800 text-sm block mb-1">
              Q: What happens if I remove a meal and add it back?
            </strong>
            <p>
              When removed, only the ingredients specific to that meal are deducted or removed. If you add the meal back, they are re-added immediately. Your store assignments and notes are retained!
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <strong className="text-slate-800 text-sm block mb-1">
              Q: Can Becca and I be on the app at the same time?
            </strong>
            <p>
              Yes! TasteCraft runs on your local network. Both of you can have the app open on your phones, check off items as you walk through different supermarket aisles, and tap the sync button to see the latest updates.
            </p>
          </div>

          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <strong className="text-slate-800 text-sm block mb-1">
              Q: How do I export or share our plan?
            </strong>
            <p>
              Tap the <strong>"Copy Plan"</strong> button in the top navigation bar. It copies a beautifully formatted text summary of your weekly meals and organized grocery list directly to your clipboard, ready to text or paste anywhere.
            </p>
          </div>
        </div>
      )
    }
  ];

  const filteredSections = searchQuery.trim() === ''
    ? sections
    : sections.filter(s =>
        s.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.badge.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.id.toLowerCase().includes(searchQuery.toLowerCase())
      );

  return (
    <div className="space-y-6 pb-12">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-emerald-700 to-teal-800 rounded-2xl p-6 text-white shadow-sm relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 text-white text-xs font-semibold backdrop-blur-xs mb-3">
            <BookOpen className="w-3.5 h-3.5" />
            <span>TasteCraft User Guide</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight">
            How TasteCraft Works
          </h1>
          <p className="text-emerald-100 text-xs md:text-sm mt-1.5 leading-relaxed">
            A simple reference guide for you and Becca. Learn how recipes sync with groceries, how to track partial stock, use voice-to-text, and organize meals.
          </p>
        </div>

        {/* Decorative background shape */}
        <div className="absolute -right-8 -bottom-12 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Quick Search */}
      <div className="relative max-w-xl">
        <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search guide (e.g. garlic, partial, store, milk, voice, history)..."
          className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs md:text-sm text-slate-800 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-xs transition"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600"
          >
            Clear
          </button>
        )}
      </div>

      {/* Quick Topics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => {
              setOpenSection(s.id);
              const el = document.getElementById(`section-${s.id}`);
              if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }}
            className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
              openSection === s.id
                ? 'bg-emerald-50 border-emerald-300 text-emerald-900 shadow-xs'
                : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
            }`}
          >
            <div className="mb-2">{s.icon}</div>
            <span className="text-xs font-bold leading-tight line-clamp-2">{s.title.split(':')[0]}</span>
          </button>
        ))}
      </div>

      {/* Accordion / Sections */}
      <div className="space-y-4">
        {filteredSections.map(s => {
          const isOpen = openSection === s.id || searchQuery.trim() !== '';
          return (
            <div
              key={s.id}
              id={`section-${s.id}`}
              className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden transition"
            >
              <button
                type="button"
                onClick={() => toggleSection(s.id)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-slate-50/80 transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-slate-100 text-slate-700">
                    {s.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm md:text-base font-bold text-slate-900">
                        {s.title}
                      </h2>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                        {s.badge}
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  {isOpen ? (
                    <ChevronDown className="w-5 h-5 text-slate-400" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-slate-400" />
                  )}
                </div>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-1 border-t border-slate-100">
                  {s.content}
                </div>
              )}
            </div>
          );
        })}

        {filteredSections.length === 0 && (
          <div className="text-center py-12 bg-white rounded-2xl border border-slate-200 p-6">
            <HelpCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">No matching topics found</p>
            <p className="text-xs text-slate-500 mt-1">Try searching for words like "store", "garlic", "milk", or "sync"</p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-3 px-3 py-1.5 bg-emerald-600 text-white text-xs font-semibold rounded-lg hover:bg-emerald-700 transition"
            >
              Reset Search
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
