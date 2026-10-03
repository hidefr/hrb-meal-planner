import React, { useState } from 'react';
import {
  Clock, Play, Image as ImageIcon, Plus, Edit2, Trash2,
  ChefHat, Sparkles, ExternalLink, History, Loader2
} from 'lucide-react';
import { MealPlan, MealSlot, Recipe } from '../types';

interface MealPlanBoardProps {
  mealPlan: MealPlan;
  onSelectRecipe: (recipe: Recipe, day: string) => void;
  onEditManual: (day: string, recipe?: Recipe | null) => void;
  onClearSlot: (day: string) => void;
  onAiSuggestDay: (day: string) => Promise<void>;
  onAiPlanWeek: () => Promise<void>;
  onOpenHistory: (day?: string) => void;
  onStartCookingMode?: (recipe: Recipe, day: string) => void;
  onOpenAntiHomework?: () => void;
}

export const MealPlanBoard: React.FC<MealPlanBoardProps> = ({
  mealPlan,
  onSelectRecipe,
  onEditManual,
  onClearSlot,
  onAiSuggestDay,
  onAiPlanWeek,
  onOpenHistory,
  onStartCookingMode,
  onOpenAntiHomework,
}) => {
  const [loadingDay, setLoadingDay] = useState<string | null>(null);
  const [planningWeek, setPlanningWeek] = useState(false);

  const handleSuggestClick = async (day: string) => {
    setLoadingDay(day);
    try {
      await onAiSuggestDay(day);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingDay(null);
    }
  };

  const handlePlanWeekClick = async () => {
    setPlanningWeek(true);
    try {
      await onAiPlanWeek();
    } catch (e) {
      console.error(e);
    } finally {
      setPlanningWeek(false);
    }
  };

  const plannedCount = mealPlan.slots.filter(s => s.recipe).length;

  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-20 md:pb-8">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#16110e] p-4 sm:p-5 rounded-3xl border border-amber-950/60 shadow-md">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-serif font-bold text-[#f5eedf]">Meal Plan</h2>
            <span className="text-[11px] font-semibold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20">
              {plannedCount} of {mealPlan.slots.length} dinners planned
            </span>
          </div>
          <p className="text-xs text-[#a89988] mt-0.5">
            Plan your dinners with 1-click AI suggestions, pick from past meal log, or enter manually
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Meal Log / History */}
          <button
            type="button"
            onClick={() => onOpenHistory()}
            className="px-3 py-1.5 rounded-xl bg-[#201813] hover:bg-[#2b2019] text-[#e0d3c1] text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer border border-amber-950/80"
            title="Browse past meals and pinned favorites"
          >
            <History className="w-3.5 h-3.5 text-amber-400/80" />
            <span>Meal Log</span>
          </button>

          {/* AI Plan Entire Week (One-Click) */}
          <button
            type="button"
            onClick={handlePlanWeekClick}
            disabled={planningWeek}
            className="px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm shadow-amber-950/40 transition cursor-pointer disabled:opacity-50"
            title="Automatically fills empty days with varied, delicious recipes matching your preferences"
          >
            {planningWeek ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Planning Entire Week...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5" />
                <span>AI Plan Entire Week</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Pann "Anti-Homework" Core UX Hero Banner */}
      {onOpenAntiHomework && (
        <div className="bg-gradient-to-r from-[#1c1612] via-[#241a13] to-[#1a1410] border border-amber-900/40 rounded-3xl p-4 sm:p-5 shadow-lg relative overflow-hidden flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1 relative z-10 max-w-xl">
            <div className="flex items-center gap-2">
              <span className="text-[10px] uppercase tracking-widest font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                Pann Single Decision
              </span>
              <span className="text-xs text-amber-200/60">No decision fatigue</span>
            </div>
            <h3 className="text-base sm:text-lg font-serif text-[#f5eedf] font-semibold">
              Have a few items in your kitchen? Let's build dinner.
            </h3>
            <p className="text-xs text-[#c8bba9] leading-relaxed">
              Enter 1–3 ingredients you have on hand. Instead of 20 endless links, get a single high-confidence culinary commitment with sensorial voice coaching.
            </p>
          </div>
          
          <button
            type="button"
            onClick={onOpenAntiHomework}
            className="shrink-0 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 text-white text-xs font-bold shadow-md shadow-amber-950 flex items-center justify-center gap-2 transition cursor-pointer active:scale-95"
          >
            <Sparkles className="w-4 h-4 text-amber-200" />
            <span>Anti-Homework Meal</span>
          </button>
        </div>
      )}

      {/* Grid of days */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {mealPlan.slots.map((slot) => {
          const hasRecipe = !!slot.recipe;
          const recipe = slot.recipe;
          const isSlotLoading = loadingDay === slot.day_of_week;
          const videoCount = recipe?.media_links?.filter(m => m.type === 'video').length || 0;
          const photoCount = recipe?.media_links?.filter(m => m.type === 'photo').length || 0;

          return (
            <div
              key={slot.id}
              className={`rounded-3xl border transition-all flex flex-col justify-between overflow-hidden relative ${
                hasRecipe
                  ? 'bg-[#18120e] border-amber-950/60 shadow-sm hover:border-amber-700/50 hover:shadow-md'
                  : 'bg-[#130e0b]/60 border-dashed border-amber-950/50'
              }`}
            >
              {/* Card Top */}
              <div className="p-4 space-y-2.5">
                {/* Day Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-serif font-bold text-sm text-[#f5eedf]">{slot.day_of_week}</span>
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-[#a89988] bg-[#221a14] px-1.5 py-0.5 rounded">
                      {slot.meal_type}
                    </span>
                  </div>

                  {hasRecipe && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEditManual(slot.day_of_week, recipe)}
                        className="p-1.5 text-[#a89988] hover:text-[#f5eedf] hover:bg-[#251d17] rounded-lg text-xs cursor-pointer"
                        title="Edit Recipe"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => {
                          if (window.confirm(`Clear dinner for ${slot.day_of_week}?`)) {
                            onClearSlot(slot.day_of_week);
                          }
                        }}
                        className="p-1.5 text-[#a89988] hover:text-rose-400 hover:bg-rose-950/30 rounded-lg text-xs cursor-pointer"
                        title="Clear Meal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Recipe Content or Empty State */}
                {hasRecipe && recipe ? (
                  <div
                    onClick={() => onSelectRecipe(recipe, slot.day_of_week)}
                    className="cursor-pointer space-y-2 group"
                  >
                    <h3 className="font-serif font-bold text-base text-[#f5eedf] group-hover:text-amber-300 transition">
                      {recipe.title}
                    </h3>
                    {recipe.description && (
                      <p className="text-xs text-[#a89988] line-clamp-2 leading-relaxed">
                        {recipe.description}
                      </p>
                    )}

                    {/* Time & Servings badges */}
                    <div className="flex items-center gap-2 text-xs text-[#a89988] pt-1 flex-wrap">
                      <div className="flex items-center gap-1 bg-[#221a14] px-2 py-0.5 rounded-md font-medium text-[11px] text-[#c8bba9]">
                        <Clock className="w-3 h-3 text-amber-400/70" />
                        <span>{recipe.prep_time_mins + recipe.cook_time_mins}m total</span>
                      </div>
                      <div className="text-[11px] bg-[#221a14] px-2 py-0.5 rounded-md text-[#c8bba9] font-medium">
                        {recipe.ingredients.length} ingredients
                      </div>
                    </div>

                    {/* Media / Video indicator pill */}
                    {(videoCount > 0 || photoCount > 0) && (
                      <div className="flex items-center gap-2 pt-1 text-[11px]">
                        {videoCount > 0 && (
                          <span className="flex items-center gap-1 font-semibold text-rose-300 bg-rose-950/40 border border-rose-900/40 px-2 py-0.5 rounded-full">
                            <Play className="w-2.5 h-2.5 fill-current" />
                            <span>{videoCount} {videoCount === 1 ? 'Video' : 'Videos'}</span>
                          </span>
                        )}
                        {photoCount > 0 && (
                          <span className="flex items-center gap-1 font-semibold text-amber-300 bg-amber-950/40 border border-amber-900/40 px-2 py-0.5 rounded-full">
                            <ImageIcon className="w-2.5 h-2.5" />
                            <span>{photoCount} {photoCount === 1 ? 'Photo' : 'Photos'}</span>
                          </span>
                        )}
                      </div>
                    )}

                    {/* Tags */}
                    {recipe.tags && recipe.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-1">
                        {recipe.tags.slice(0, 3).map((tag, idx) => (
                          <span
                            key={idx}
                            className="text-[10px] font-medium bg-amber-500/10 text-amber-300 px-1.5 py-0.5 rounded border border-amber-500/20"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Empty state for day */
                  <div className="py-5 flex flex-col items-center justify-center text-center space-y-3">
                    <p className="text-xs text-[#8c7b6d] font-medium">No meal set for this night</p>

                    {isSlotLoading ? (
                      <div className="py-3 flex items-center justify-center gap-2 text-amber-300 text-xs font-semibold">
                        <Loader2 className="w-4 h-4 animate-spin text-amber-400" />
                        <span>AI is cooking up a recipe...</span>
                      </div>
                    ) : (
                      <div className="flex flex-col gap-1.5 w-full">
                        {/* Instant AI Suggestion */}
                        <button
                          type="button"
                          onClick={() => handleSuggestClick(slot.day_of_week)}
                          className="w-full py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition cursor-pointer"
                          title="Generate a delicious dinner based on your preferences"
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                          <span>AI Suggestion</span>
                        </button>

                        <div className="grid grid-cols-2 gap-1.5 w-full">
                          {/* Pick from History */}
                          <button
                            type="button"
                            onClick={() => onOpenHistory(slot.day_of_week)}
                            className="py-1.5 px-2 rounded-xl bg-[#221a14] hover:bg-[#2c221a] text-[#c8bba9] text-xs font-medium border border-amber-950/60 flex items-center justify-center gap-1 transition cursor-pointer"
                            title="Pick and reuse from your past 50 meals"
                          >
                            <History className="w-3 h-3 text-amber-400/70" />
                            <span>From History</span>
                          </button>

                          {/* Manual */}
                          <button
                            type="button"
                            onClick={() => onEditManual(slot.day_of_week, null)}
                            className="py-1.5 px-2 rounded-xl bg-[#221a14] hover:bg-[#2c221a] text-[#c8bba9] text-xs font-medium border border-amber-950/60 flex items-center justify-center gap-1 transition cursor-pointer"
                          >
                            <Plus className="w-3 h-3 text-amber-400/70" />
                            <span>Manual</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Card Footer (View recipe link & Cooking Mode) */}
              {hasRecipe && recipe && (
                <div className="px-4 py-2 bg-[#130e0b] border-t border-amber-950/60 flex items-center justify-between text-xs font-medium text-amber-300">
                  <button
                    type="button"
                    onClick={() => onSelectRecipe(recipe, slot.day_of_week)}
                    className="hover:text-amber-200 flex items-center gap-1 cursor-pointer truncate mr-2"
                  >
                    <span>View Recipe</span>
                    <ExternalLink className="w-3 h-3 shrink-0 text-amber-400" />
                  </button>

                  {onStartCookingMode && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStartCookingMode(recipe, slot.day_of_week);
                      }}
                      className="px-2.5 py-1 rounded-lg bg-amber-600 hover:bg-amber-500 text-white text-[11px] font-bold flex items-center gap-1 shadow-sm transition cursor-pointer shrink-0"
                      title="Cook hands-free with voice commands"
                    >
                      <span>🎙️ Cook</span>
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
