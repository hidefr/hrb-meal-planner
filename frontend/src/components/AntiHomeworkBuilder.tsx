import React, { useState } from 'react';
import { Sparkles, ArrowRight, Loader2, RefreshCw, Check, Flame, X, Camera } from 'lucide-react';
import { Recipe } from '../types';

interface AntiHomeworkProps {
  onCommitMeal: (recipe: Recipe) => void;
  onClose?: () => void;
}

export const AntiHomeworkBuilder: React.FC<AntiHomeworkProps> = ({ onCommitMeal, onClose }) => {
  const [ingredientsInput, setIngredientsInput] = useState('');
  const [cookware, setCookware] = useState<'stainless' | 'cast_iron' | 'nonstick' | 'sheet_pan'>('stainless');
  const [isLoading, setIsLoading] = useState(false);
  const [recommendedRecipe, setRecommendedRecipe] = useState<Recipe | null>(null);

  // Quick suggestions buttons for zero-typing
  const quickPantryCombos = [
    "Chicken thighs, garlic, lemon",
    "Salmon, asparagus, butter",
    "Eggs, spinach, cheddar",
    "Pasta, canned tomatoes, basil",
    "Ground beef, onion, rice"
  ];

  const handleGenerateSingleDecision = async (ingredientsText: string) => {
    if (!ingredientsText.trim()) return;
    setIsLoading(true);

    try {
      const prompt = `[TASTECRAFT ANTI-HOMEWORK SINGLE DECISION]: The user has these exact items in their kitchen: "${ingredientsText}". They are cooking with: ${cookware}. Provide a single, mouth-watering, tailored recipe tailored for their ingredients and cookware.`;
      
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt })
      });
      const data = await res.json();
      
      // Look for newly planned meal or parse recipe
      if (data.meal_plan?.slots) {
        const slotWithRecipe = data.meal_plan.slots.find((s: any) => s.recipe);
        if (slotWithRecipe?.recipe) {
          setRecommendedRecipe(slotWithRecipe.recipe);
          return;
        }
      }

      // If in conversational format, query suggestion endpoint for structured recipe
      const suggestRes = await fetch('/api/meal-plan/ai-suggest-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_of_week: 'Today',
          custom_prompt: `Items available: ${ingredientsText}. Cookware: ${cookware}. Single high-confidence decision.`
        })
      });
      const suggestData = await suggestRes.json();
      const createdSlot = suggestData.slots?.find((s: any) => s.recipe);
      if (createdSlot?.recipe) {
        setRecommendedRecipe(createdSlot.recipe);
      }
    } catch (err) {
      console.error("Anti-Homework generation error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleMutateOrTweak = async (tweak: string) => {
    setIsLoading(true);
    try {
      const suggestRes = await fetch('/api/meal-plan/ai-suggest-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          day_of_week: 'Today',
          custom_prompt: `Mutate the previous idea with this twist: "${tweak}". Original ingredients: ${ingredientsInput}. Cookware: ${cookware}.`
        })
      });
      const suggestData = await suggestRes.json();
      const createdSlot = suggestData.slots?.find((s: any) => s.recipe);
      if (createdSlot?.recipe) {
        setRecommendedRecipe(createdSlot.recipe);
      }
    } catch (err) {
      console.error("Mutation failed:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-[#181412] text-[#f5eedf] border border-[#3d2f24] rounded-3xl p-5 sm:p-7 shadow-2xl relative overflow-hidden">
      {/* Warm ambient radial backdrop */}
      <div className="absolute top-0 right-0 w-80 h-80 bg-gradient-to-bl from-amber-600/15 via-orange-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

      {onClose && (
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 text-stone-400 hover:text-white rounded-full bg-stone-900/60 border border-stone-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      )}

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-[11px] font-bold tracking-widest uppercase px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
            Anti-Homework Kitchen
          </span>
          <span className="text-xs text-stone-400">Zero Decision Fatigue</span>
        </div>
        <h2 className="text-2xl sm:text-3xl font-serif font-medium tracking-tight text-white">
          What 2–3 things do you have?
        </h2>
        <p className="text-sm text-stone-300 mt-1">
          No scrolling through 20 blog links. Give us what's in your fridge, and we'll commit to <strong className="text-amber-300">one tailored dinner</strong>.
        </p>
      </div>

      {!recommendedRecipe ? (
        <div className="space-y-5">
          {/* Input Box */}
          <div>
            <label className="block text-xs font-semibold text-stone-400 mb-2">
              Enter 1 to 3 items you want to use up:
            </label>
            <div className="relative">
              <input
                type="text"
                value={ingredientsInput}
                onChange={e => setIngredientsInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleGenerateSingleDecision(ingredientsInput)}
                placeholder="e.g. Chicken thighs, garlic, lemon"
                className="w-full bg-[#120f0d] border border-[#423327] focus:border-amber-500 rounded-2xl px-4 py-3.5 text-white placeholder-stone-500 text-sm focus:outline-none transition"
              />
            </div>
          </div>

          {/* Quick pantry tap pills */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <span className="text-stone-400 font-medium">Quick ideas:</span>
            {quickPantryCombos.map((combo, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setIngredientsInput(combo);
                  handleGenerateSingleDecision(combo);
                }}
                className="px-2.5 py-1 rounded-xl bg-[#241c17] hover:bg-[#34271f] text-stone-300 border border-[#3d2f24] transition text-xs cursor-pointer"
              >
                {combo}
              </button>
            ))}
          </div>

          {/* Cookware Selector */}
          <div>
            <label className="block text-xs font-semibold text-stone-400 mb-2">
              Select Your Pan / Cookware:
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'stainless', label: 'Stainless Steel', icon: '✨', hint: 'Water-bead test' },
                { id: 'cast_iron', label: 'Cast Iron', icon: '🍳', hint: 'Preheat patience' },
                { id: 'nonstick', label: 'Non-stick', icon: '🛡️', hint: 'Gentle heat ceiling' },
                { id: 'sheet_pan', label: 'Sheet Pan', icon: '🥘', hint: 'High-heat roast' },
              ].map(item => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setCookware(item.id as any)}
                  className={`p-3 rounded-2xl border text-left transition cursor-pointer flex flex-col justify-between ${
                    cookware === item.id
                      ? 'bg-amber-950/40 border-amber-500 text-white shadow-lg'
                      : 'bg-[#14100e] border-[#31251c] text-stone-400 hover:text-stone-200 hover:border-[#4d3a2c]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-base">{item.icon}</span>
                    {cookware === item.id && <Check className="w-3.5 h-3.5 text-amber-400" />}
                  </div>
                  <div className="mt-2">
                    <span className="text-xs font-bold block">{item.label}</span>
                    <span className="text-[10px] text-stone-500 block">{item.hint}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Single Decision CTA */}
          <button
            type="button"
            onClick={() => handleGenerateSingleDecision(ingredientsInput)}
            disabled={!ingredientsInput.trim() || isLoading}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-amber-600 via-amber-500 to-orange-500 hover:from-amber-500 hover:to-orange-400 text-[#140e0a] font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-xl shadow-amber-950/60 transition cursor-pointer disabled:opacity-40"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                <span>Chef is deciding the perfect dish...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                <span>Give Me The Single Decision</span>
              </>
            )}
          </button>
        </div>
      ) : (
        /* The Single Decision Recommendation Card */
        <div className="space-y-5 animate-fadeIn">
          <div className="bg-[#120f0d] border border-[#3e3025] rounded-3xl p-5 sm:p-7 relative overflow-hidden">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-amber-400 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/20">
                TasteCraft Single Decision • {cookware.replace('_', ' ').toUpperCase()}
              </span>
              <span className="text-xs text-stone-400 font-medium">
                ⏱️ {recommendedRecipe.prep_time_mins + recommendedRecipe.cook_time_mins} mins total
              </span>
            </div>

            <h3 className="text-xl sm:text-2xl font-serif font-bold text-white mb-2">
              {recommendedRecipe.title}
            </h3>
            <p className="text-sm text-stone-300 leading-relaxed mb-4">
              {recommendedRecipe.description}
            </p>

            <div className="flex flex-wrap gap-1.5 mb-5">
              {recommendedRecipe.tags.map((tag, i) => (
                <span key={i} className="text-[10px] font-semibold bg-[#221a15] text-stone-300 border border-[#3d2f24] px-2.5 py-0.5 rounded-lg">
                  #{tag}
                </span>
              ))}
            </div>

            <div className="border-t border-[#2d221a] pt-4">
              <h4 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2">
                Ingredients you will use:
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                {recommendedRecipe.ingredients.map((ing, i) => (
                  <div key={i} className="flex items-center justify-between bg-[#191310] px-3 py-2 rounded-xl border border-[#34271e]">
                    <span className="text-stone-200">{ing.name}</span>
                    <span className="font-mono text-amber-300">{ing.amount} {ing.unit}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Action CTAs: Cook It Now, or Mutate */}
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <button
              type="button"
              onClick={() => onCommitMeal(recommendedRecipe)}
              className="w-full sm:flex-1 py-4 rounded-2xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-stone-950 font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-xl shadow-amber-950 cursor-pointer transition"
            >
              <span>Commit & Cook This Meal</span>
              <ArrowRight className="w-5 h-5" />
            </button>

            {/* Mutate triggers */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handleMutateOrTweak("Make it creamier or richer")}
                disabled={isLoading}
                className="flex-1 sm:flex-initial px-3.5 py-3.5 rounded-2xl bg-[#241c17] hover:bg-[#34271f] text-stone-300 border border-[#3d2f24] text-xs font-bold transition cursor-pointer"
                title="Make it richer"
              >
                More Creamy
              </button>
              <button
                type="button"
                onClick={() => handleMutateOrTweak("Make it spicier with heat and citrus")}
                disabled={isLoading}
                className="flex-1 sm:flex-initial px-3.5 py-3.5 rounded-2xl bg-[#241c17] hover:bg-[#34271f] text-stone-300 border border-[#3d2f24] text-xs font-bold transition cursor-pointer"
                title="Make it spicy"
              >
                Spicy Twist
              </button>
              <button
                type="button"
                onClick={() => setRecommendedRecipe(null)}
                className="px-3.5 py-3.5 rounded-2xl bg-[#241c17] hover:bg-[#34271f] text-stone-400 hover:text-white border border-[#3d2f24] text-xs transition cursor-pointer"
                title="Start over"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
