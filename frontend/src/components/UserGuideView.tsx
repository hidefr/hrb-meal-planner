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
      icon: <Smartphone className="w-5 h-5 text-amber-400" />,
      badge: 'Getting Started',
      content: (
        <div className="space-y-4 text-sm text-[#c8bba9] leading-relaxed">
          <p>
            Welcome to <strong className="text-[#f5eedf] font-semibold">TasteCraft</strong>! Designed for couples to effortlessly plan delicious weekly meals, coordinate grocery shopping, and organize recipes together.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
            <div className="p-3.5 bg-[#140F0C] border border-[#34271D] rounded-xl">
              <div className="font-semibold text-[#f5eedf] flex items-center gap-1.5 mb-1">
                <Calendar className="w-4 h-4 text-amber-400" />
                <span>1. Plan Meals</span>
              </div>
              <p className="text-xs text-[#a89988]">
                Use 1-click AI suggestions or browse your past 50 planned meals to assemble your week in seconds.
              </p>
            </div>

            <div className="p-3.5 bg-[#140F0C] border border-[#34271D] rounded-xl">
              <div className="font-semibold text-[#f5eedf] flex items-center gap-1.5 mb-1">
                <ShoppingBag className="w-4 h-4 text-amber-400" />
                <span>2. Shop Together</span>
              </div>
              <p className="text-xs text-[#a89988]">
                Ingredients aggregate automatically. Tag items by store (Amazon, Fred Meyer, Trader Joe's, etc.) and track partial stock.
              </p>
            </div>

            <div className="p-3.5 bg-[#140F0C] border border-[#34271D] rounded-xl">
              <div className="font-semibold text-[#f5eedf] flex items-center gap-1.5 mb-1">
                <MessageSquare className="w-4 h-4 text-amber-400" />
                <span>3. Voice & AI Copilot</span>
              </div>
              <p className="text-xs text-[#a89988]">
                Tap the microphone to speak naturally or chat with your AI assistant to adjust recipes, days, or groceries.
              </p>
            </div>
          </div>

          <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200">
            <strong className="font-semibold text-amber-300">📱 Access on Your Phones & Tablets:</strong> Both of you can open this app on your smartphones or tablets using your home Wi-Fi network. Simply open Safari or Chrome and navigate to <code className="bg-[#140F0C] text-amber-300 border border-[#34271D] px-1.5 py-0.5 rounded font-mono font-semibold">http://&lt;laptop-ip&gt;:8000</code> or download the TasteCraft Android APK directly to your device!
          </div>
        </div>
      )
    },
    {
      id: 'grocery',
      title: 'Grocery List: How It Works & Best Practices',
      icon: <ShoppingBag className="w-5 h-5 text-amber-400" />,
      badge: 'Most Important',
      content: (
        <div className="space-y-4 text-sm text-[#c8bba9] leading-relaxed">
          <p>
            The grocery list is designed to be smart and flexible so you never buy duplicates or accidentally lose items.
          </p>

          <div className="space-y-3">
            {/* Rule 1: Recipe Aggregation */}
            <div className="p-3.5 bg-[#140F0C] border border-[#34271D] rounded-xl">
              <div className="font-semibold text-[#f5eedf] text-sm mb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-stone-950 text-xs flex items-center justify-center font-bold">1</span>
                Automatic Recipe Aggregation
              </div>
              <p className="text-xs text-[#a89988]">
                When you add meals to your meal plan, all recipe ingredients automatically drop into your grocery list. If two meals both call for garlic (e.g., 3 cloves on Tuesday and 3 cloves on Thursday), they are combined into <strong>6 cloves</strong> with a tag: <span className="bg-[#211A15] text-[#c8bba9] border border-[#34271D] px-1.5 py-0.5 rounded text-[10px] font-semibold">For: Garlic Noodles, Stir Fry</span>.
              </p>
            </div>

            {/* Rule 2: Manual Items */}
            <div className="p-3.5 bg-[#140F0C] border border-[#34271D] rounded-xl">
              <div className="font-semibold text-[#f5eedf] text-sm mb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-stone-950 text-xs flex items-center justify-center font-bold">2</span>
                Manual Items (Milk, Eggs, Coffee, Snacks)
              </div>
              <p className="text-xs text-[#a89988]">
                Any item added manually (via <strong>"+ Add Item"</strong> or by asking the AI copilot <em>"Add half and half to the grocery list"</em>) is tagged as a <strong>Manual Item</strong>. 
                <span className="block mt-1 text-amber-300 font-medium">
                  🛡️ Manual items are 100% immune to meal changes! Adding, removing, or re-planning meals will never delete or alter your manual groceries.
                </span>
              </p>
            </div>

            {/* Rule 3: Checked vs Cleared */}
            <div className="p-3.5 bg-[#140F0C] border border-[#34271D] rounded-xl">
              <div className="font-semibold text-[#f5eedf] text-sm mb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-stone-950 text-xs flex items-center justify-center font-bold">3</span>
                "Already Have It" vs. "Clear Checked"
              </div>
              <ul className="text-xs space-y-1.5 mt-1 list-disc list-inside text-[#a89988]">
                <li>
                  <strong className="text-[#f5eedf]">Checking the box:</strong> Tap the checkbox when you already have an ingredient at home or when you put it in your cart at the store. It crosses it off with a strike-through line, <em>but leaves it on your list</em> so both of you can see you have it ready.
                </li>
                <li>
                  <strong className="text-[#f5eedf]">Clear Checked:</strong> Only click <strong>"Clear Checked"</strong> after you've finished shopping or after you've made the meals.
                </li>
                <li>
                  <strong className="text-[#f5eedf]">Cleared History:</strong> Cleared items are safely saved in <strong>Cleared History</strong> (up to 200 items). Tap the <strong>History</strong> button anytime to view cleared items and tap <em>"Add Back to List"</em> with one click.
                </li>
              </ul>
            </div>

            {/* Rule 4: Partial Stock */}
            <div className="p-3.5 bg-[#140F0C] border border-[#34271D] rounded-xl">
              <div className="font-semibold text-[#f5eedf] text-sm mb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-stone-950 text-xs flex items-center justify-center font-bold">4</span>
                Partial Quantities & "Half Used" Tracking
              </div>
              <p className="text-xs text-[#a89988] mb-2">
                What if you need 2 heads of bok choy, but you already have 1 in the fridge? Or what if you have garlic for two meals and you use half on Tuesday?
              </p>
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-2.5 text-xs text-amber-200 space-y-1">
                <div className="font-semibold text-amber-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-amber-400" />
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
            <div className="p-3.5 bg-[#140F0C] border border-[#34271D] rounded-xl">
              <div className="font-semibold text-[#f5eedf] text-sm mb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-stone-950 text-xs flex items-center justify-center font-bold">5</span>
                Store Tagging & Filters
              </div>
              <p className="text-xs text-[#a89988]">
                Next to each item, tap the store buttons to pick where you'll get it (e.g. <em>Amazon, Fred Meyer, Trader Joe's, Safeway, New Seasons</em>). You can also click the store filter pill at the top of the grocery list to isolate just the items for that store when you're walking the aisles!
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'mealplan',
      title: 'Meal Planning & Past Meal Log',
      icon: <Calendar className="w-5 h-5 text-amber-400" />,
      badge: 'Weekly Schedule',
      content: (
        <div className="space-y-4 text-sm text-[#c8bba9] leading-relaxed">
          <p>
            Plan all 7 days of dinner in just a couple minutes:
          </p>

          <div className="space-y-2.5">
            <div className="flex items-start gap-3 p-3 bg-[#140F0C] rounded-xl border border-[#34271D]">
              <Sparkles className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <strong className="text-[#f5eedf] text-xs block">AI Suggest Day:</strong>
                <span className="text-xs text-[#a89988]">
                  Tap "AI Suggest" on any empty slot. It respects your active dietary preferences and generates a complete recipe with ingredients, cook time, and instructions.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-[#140F0C] rounded-xl border border-[#34271D]">
              <Calendar className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <strong className="text-[#f5eedf] text-xs block">Plan Entire Week:</strong>
                <span className="text-xs text-[#a89988]">
                  Tap "Plan Entire Week" in the top header. You can ask for themes (e.g. "comfort foods with high protein" or "quick 20-minute dinners") to fill all empty days in one shot.
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-[#140F0C] rounded-xl border border-[#34271D]">
              <History className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <strong className="text-[#f5eedf] text-xs block">Meal Plan History Log & Pinning (Up to 50 Meals):</strong>
                <span className="text-xs text-[#a89988]">
                  Tap the <strong>History</strong> button in the Meal Plan tab. Every meal you plan is logged (storing up to the last 50 meals). You can <strong>pin</strong> favorites so they never leave the log, and tap <strong>"Add to Plan"</strong> to instantly reuse last week's favorite dinner on any day!
                </span>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-amber-500/10 rounded-xl border border-amber-500/30">
              <Mic className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <strong className="text-amber-300 text-xs block font-bold">Personal Chef Voice Cooking Mode (Hands-Free):</strong>
                <span className="text-xs text-amber-200 leading-relaxed block mt-0.5">
                  Tap <strong>"🎙️ Cook"</strong> on any meal card or <strong>"Start Cooking Mode"</strong> in the recipe dialog. Your tablet or phone turns into an always-on kitchen assistant with real-time text-to-speech, interactive word highlighting, cookware heat coaching, panic rescue, and on-the-fly recipe adaptation:
                </span>
                <ul className="text-xs space-y-1.5 mt-2 list-disc list-inside text-amber-100">
                  <li>
                    <strong className="text-amber-300">Navigation Commands:</strong> Say <em>"Next step"</em>, <em>"Previous step"</em>, <em>"Reread"</em>, <em>"Jump to step 3"</em>, <em>"Read ingredients"</em>, <em>"Pause"</em>, <em>"Resume"</em>, or <em>"Exit"</em>.
                  </li>
                  <li>
                    <strong className="text-amber-300">Ask the Chef (Wake-Word & Natural Questions):</strong> Say <em>"Hey Chef"</em> (or <em>"Cookie"</em> / <em>"TasteCraft"</em>) followed by your question, or ask directly: <em>"Hey Chef, can I substitute honey with maple syrup?"</em>. Chef confirms out loud and instantly updates the recipe card and instructions mid-cook!
                  </li>
                  <li>
                    <strong className="text-amber-300">Emergency Kitchen Rescue:</strong> If anything burns, smokes, or sticks, simply say <em>"Panic"</em>, <em>"It's burning"</em>, or <em>"Food is sticking"</em> for instant calming emergency instructions.
                  </li>
                  <li>
                    <strong className="text-amber-300">Session Resumption:</strong> If you exit and return, Chef remembers your step and asks whether you want to continue where you left off or start over from the beginning.
                  </li>
                </ul>
              </div>
            </div>

            <div className="flex items-start gap-3 p-3 bg-[#140F0C] rounded-xl border border-[#34271D]">
              <Sparkles className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
              <div>
                <strong className="text-[#f5eedf] text-xs block">Anti-Homework Single-Decision Kitchen:</strong>
                <span className="text-xs text-[#a89988]">
                  Zero decision fatigue. Tap the <strong>"Anti-Homework Meal"</strong> button at the top of the meal plan board, enter 1 to 3 ingredients you have on hand, and get a single high-confidence culinary commitment with sensorial voice guidance instead of scrolling 20 endless links.
                </span>
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'cooking-mode-deepdive',
      title: 'Kitchen Companion: Voice Chef & Cooking Mode',
      icon: <Mic className="w-5 h-5 text-amber-400" />,
      badge: 'Interactive AI',
      content: (
        <div className="space-y-4 text-sm text-[#c8bba9] leading-relaxed">
          <p>
            TasteCraft's Voice Cooking Mode is engineered like having a professional sous chef standing beside you at the stove:
          </p>

          <div className="space-y-3">
            <div className="p-3.5 bg-[#140F0C] border border-[#34271D] rounded-xl">
              <div className="font-semibold text-[#f5eedf] text-sm mb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-stone-950 text-xs flex items-center justify-center font-bold">1</span>
                Wake-Word & Smart Question Filter
              </div>
              <p className="text-xs text-[#a89988]">
                To prevent ambient kitchen chit-chat or background television from triggering unwanted responses, Chef requires either a wake-word (<em>"Hey Chef"</em>, <em>"Chef"</em>, <em>"TasteCraft"</em>, <em>"Cookie"</em>) or an explicit culinary query (e.g. <em>"I don't have honey..."</em>, <em>"Can I replace..."</em>). When you speak the hotword alone, Chef responds <em>"I'm listening, go ahead!"</em> and listens for your follow-up.
              </p>
            </div>

            <div className="p-3.5 bg-[#140F0C] border border-[#34271D] rounded-xl">
              <div className="font-semibold text-[#f5eedf] text-sm mb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-stone-950 text-xs flex items-center justify-center font-bold">2</span>
                On-The-Fly Ingredient & Step Adaptation
              </div>
              <p className="text-xs text-[#a89988]">
                Missing an item? Say <em>"Hey Chef, can I substitute honey with maple syrup?"</em> or <em>"Add broccoli to the recipe"</em>. Chef maintains continuous multi-turn conversational context, confirms the adjustment out loud, and automatically updates the recipe's ingredient amounts, units, and instructions on the screen without leaving Cooking Mode!
              </p>
            </div>

            <div className="p-3.5 bg-[#140F0C] border border-[#34271D] rounded-xl">
              <div className="font-semibold text-[#f5eedf] text-sm mb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-stone-950 text-xs flex items-center justify-center font-bold">3</span>
                Sensorial Cookware Coaching
              </div>
              <p className="text-xs text-[#a89988]">
                Select your pan type at the top (<em>Stainless Steel, Cast Iron, Non-Stick, Sheet Pan</em>). When preheating oil or searing, Chef provides tactile thermal tips (e.g. Leidenfrost water-drop test for stainless, radiant thermal cues for cast iron) right on step 1 so food never sticks or burns.
              </p>
            </div>

            <div className="p-3.5 bg-[#140F0C] border border-[#34271D] rounded-xl">
              <div className="font-semibold text-[#f5eedf] text-sm mb-1 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-amber-600 text-stone-950 text-xs flex items-center justify-center font-bold">4</span>
                Voice Speed & Theme Controls
              </div>
              <p className="text-xs text-[#a89988]">
                Adjust reading pacing with the <strong>1.0x / 1.15x / 1.3x</strong> voice speed toggle in the header. Switch between the cozy <strong>Biscuit Cream Light Theme</strong> and the deep <strong>Espresso Dark Theme</strong> anytime to match your kitchen lighting.
              </p>
            </div>
          </div>
        </div>
      )
    },
    {
      id: 'voice-chat',
      title: 'Voice-to-Text & AI Copilot',
      icon: <Mic className="w-5 h-5 text-amber-400" />,
      badge: 'Hands-Free',
      content: (
        <div className="space-y-4 text-sm text-[#c8bba9] leading-relaxed">
          <p>
            You can plan hands-free in the kitchen or on your phone using high-accuracy voice-to-text.
          </p>

          <div className="p-3.5 bg-[#140F0C] border border-[#34271D] rounded-xl space-y-2">
            <div className="font-semibold text-[#f5eedf] text-sm flex items-center gap-2">
              <Mic className="w-4 h-4 text-rose-400" />
              Voice-to-Text Dictation
            </div>
            <p className="text-xs text-[#a89988]">
              • Tap the <strong>Microphone</strong> button in the chat copilot input.
            </p>
            <p className="text-xs text-[#a89988]">
              • Speak your thoughts naturally. The text streams in real-time.
            </p>
            <p className="text-xs text-[#a89988]">
              • It <strong>appends to your existing text</strong> without erasing or overwriting what you already wrote.
            </p>
            <p className="text-xs text-[#a89988]">
              • Tap the microphone again (or press Enter) when finished speaking.
            </p>
          </div>

          <div className="p-3.5 bg-[#140F0C] border border-[#34271D] rounded-xl space-y-2">
            <div className="font-semibold text-[#f5eedf] text-sm flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-amber-400" />
              Conversation History & Multi-Chat
            </div>
            <p className="text-xs text-[#a89988]">
              • The AI Copilot keeps a persistent history of your conversations.
            </p>
            <p className="text-xs text-[#a89988]">
              • On desktop or mobile, open the chat dropdown to switch between conversations, start a new chat, or review past ideas.
            </p>
          </div>

          <div className="p-3 bg-[#140F0C] border border-[#34271D] rounded-xl text-xs text-[#c8bba9]">
            <strong className="block text-[#f5eedf] mb-1 font-semibold">Try saying or typing:</strong>
            <ul className="list-disc list-inside space-y-1 text-[#a89988]">
              <li><em>"Plan 3 quick dinners for Tuesday, Wednesday, and Thursday."</em></li>
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
      icon: <Settings className="w-5 h-5 text-amber-400" />,
      badge: 'Customization',
      content: (
        <div className="space-y-4 text-sm text-[#c8bba9] leading-relaxed">
          <p>
            Customize your experience to fit your household's exact grocery and dietary needs.
          </p>

          <div className="p-3.5 bg-[#140F0C] border border-[#34271D] rounded-xl space-y-2">
            <div className="font-semibold text-[#f5eedf] text-sm">
              Custom Dietary & Meal Preferences
            </div>
            <p className="text-xs text-[#a89988]">
              • Click <strong>Settings</strong> in the top header.
            </p>
            <p className="text-xs text-[#a89988]">
              • Type any custom preference (e.g. <em>"Low sodium"</em>, <em>"High protein"</em>, <em>"Spicy"</em>) and click <strong>"Add & Activate"</strong>.
            </p>
            <p className="text-xs text-[#a89988]">
              • It immediately drops into your interactive suggestions grid as an <strong>active</strong> pill with an amber checkmark.
            </p>
            <p className="text-xs text-[#a89988]">
              • Click any pill to toggle it active or inactive anytime, or tap the small <code>×</code> to remove it.
            </p>
          </div>

          <div className="p-3.5 bg-[#140F0C] border border-[#34271D] rounded-xl space-y-2">
            <div className="font-semibold text-[#f5eedf] text-sm">
              Custom Grocery Stores
            </div>
            <p className="text-xs text-[#a89988]">
              • You can add, edit, or remove your favorite local stores in Settings (e.g. <em>Amazon, Fred Meyer, Trader Joe's, Safeway, New Seasons, Costco, WinCo</em>).
            </p>
            <p className="text-xs text-[#a89988]">
              • They immediately appear in every grocery item's store selector.
            </p>
          </div>
        </div>
      )
    },
    {
      id: 'faq',
      title: 'Frequently Asked Questions (FAQ)',
      icon: <HelpCircle className="w-5 h-5 text-amber-400" />,
      badge: 'Troubleshooting',
      content: (
        <div className="space-y-3 text-xs text-[#c8bba9] leading-relaxed">
          <div className="p-3 bg-[#140F0C] border border-[#34271D] rounded-xl">
            <strong className="text-[#f5eedf] text-sm block mb-1">
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

          <div className="p-3 bg-[#140F0C] border border-[#34271D] rounded-xl">
            <strong className="text-[#f5eedf] text-sm block mb-1">
              Q: What happens if I remove a meal and add it back?
            </strong>
            <p>
              When removed, only the ingredients specific to that meal are deducted or removed. If you add the meal back, they are re-added immediately. Your store assignments and notes are retained!
            </p>
          </div>

          <div className="p-3 bg-[#140F0C] border border-[#34271D] rounded-xl">
            <strong className="text-[#f5eedf] text-sm block mb-1">
              Q: Can multiple people use the app at the same time?
            </strong>
            <p>
              Yes! TasteCraft runs on your local network. Both of you can have the app open on your phones, check off items as you walk through different supermarket aisles, and tap the sync button to see the latest updates.
            </p>
          </div>

          <div className="p-3 bg-[#140F0C] border border-[#34271D] rounded-xl">
            <strong className="text-[#f5eedf] text-sm block mb-1">
              Q: How do I export or share our plan?
            </strong>
            <p>
              Tap the <strong>"Copy Plan"</strong> button in Settings. It copies a beautifully formatted text summary of your weekly meals and organized grocery list directly to your clipboard, ready to text or paste anywhere.
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
    <div className="space-y-6 pb-12 text-[#f5eedf]">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#201712] via-[#2d1f18] to-[#1a130f] rounded-3xl p-6 text-[#f5eedf] shadow-lg border border-[#34271D] relative overflow-hidden">
        <div className="relative z-10 max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 text-xs font-semibold backdrop-blur-xs mb-3 border border-amber-500/30">
            <BookOpen className="w-3.5 h-3.5" />
            <span>TasteCraft User Guide</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-serif font-bold tracking-tight text-[#f5eedf]">
            How TasteCraft Works
          </h1>
          <p className="text-[#a89988] text-xs md:text-sm mt-1.5 leading-relaxed">
            A simple reference guide. Learn how recipes sync with groceries, how to track partial stock, use voice-to-text, and organize meals.
          </p>
        </div>

        {/* Decorative background shape */}
        <div className="absolute -right-8 -bottom-12 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
      </div>

      {/* Quick Search */}
      <div className="relative max-w-xl">
        <Search className="w-4 h-4 text-[#8c7b6d] absolute left-3.5 top-1/2 -translate-y-1/2" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search guide (e.g. garlic, partial, store, milk, voice, history)..."
          className="w-full pl-10 pr-4 py-2.5 bg-[#140F0C] border border-[#3B2C21] rounded-xl text-xs md:text-sm text-[#f5eedf] placeholder-[#8c7b6d] focus:outline-hidden focus:border-amber-500 shadow-inner transition"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-[#8c7b6d] hover:text-[#f5eedf]"
          >
            Clear
          </button>
        )}
      </div>

      {/* Quick Topics Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2">
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
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-200 shadow-md'
                : 'bg-[#181310] border-[#34271D] text-[#c8bba9] hover:bg-[#211A15] hover:text-[#f5eedf]'
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
              className="bg-[#181310] border border-[#34271D] rounded-2xl shadow-xs overflow-hidden transition"
            >
              <button
                type="button"
                onClick={() => toggleSection(s.id)}
                className="w-full px-5 py-4 flex items-center justify-between text-left hover:bg-[#211A15] transition cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-[#211A15] text-amber-300 border border-[#34271D]">
                    {s.icon}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="text-sm md:text-base font-bold text-[#f5eedf]">
                        {s.title}
                      </h2>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#140F0C] text-amber-300 border border-[#34271D]">
                        {s.badge}
                      </span>
                    </div>
                  </div>
                </div>
                <div>
                  {isOpen ? (
                    <ChevronDown className="w-5 h-5 text-[#8c7b6d]" />
                  ) : (
                    <ChevronRight className="w-5 h-5 text-[#8c7b6d]" />
                  )}
                </div>
              </button>

              {isOpen && (
                <div className="px-5 pb-5 pt-1 border-t border-[#34271D]">
                  {s.content}
                </div>
              )}
            </div>
          );
        })}

        {filteredSections.length === 0 && (
          <div className="text-center py-12 bg-[#181310] rounded-2xl border border-[#34271D] p-6">
            <HelpCircle className="w-8 h-8 text-[#8c7b6d] mx-auto mb-2" />
            <p className="text-sm font-semibold text-[#d6c7b2]">No matching topics found</p>
            <p className="text-xs text-[#8c7b6d] mt-1">Try searching for words like "store", "garlic", "milk", or "sync"</p>
            <button
              onClick={() => setSearchQuery('')}
              className="mt-3 px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-bold rounded-lg transition cursor-pointer shadow-md"
            >
              Reset Search
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
