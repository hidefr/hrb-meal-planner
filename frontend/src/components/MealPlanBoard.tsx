import React from 'react';
import { Clock, Play, Image as ImageIcon, Plus, Edit2, Trash2, ChefHat, Sparkles, ExternalLink } from 'lucide-react';
import { MealPlan, MealSlot, Recipe } from '../types';

interface MealPlanBoardProps {
  mealPlan: MealPlan;
  onSelectRecipe: (recipe: Recipe, day: string) => void;
  onEditManual: (day: string, recipe?: Recipe | null) => void;
  onClearSlot: (day: string) => void;
  onTriggerAiForDay: (day: string) => void;
}

export const MealPlanBoard: React.FC<MealPlanBoardProps> = ({
  mealPlan,
  onSelectRecipe,
  onEditManual,
  onClearSlot,
  onTriggerAiForDay
}) => {
  return (
    <div className="space-y-4 max-w-6xl mx-auto pb-20 md:pb-8">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base font-bold text-slate-900">{mealPlan.week_title}</h2>
          <p className="text-xs text-slate-500">
            {mealPlan.slots.filter(s => s.recipe).length} of {mealPlan.slots.length} dinners planned this week
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onTriggerAiForDay('whole week')}
            className="px-3.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-semibold border border-emerald-200 flex items-center gap-1.5 transition"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Plan Entire Week</span>
          </button>
        </div>
      </div>

      {/* Grid of days */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
        {mealPlan.slots.map((slot) => {
          const hasRecipe = !!slot.recipe;
          const recipe = slot.recipe;
          const videoCount = recipe?.media_links?.filter(m => m.type === 'video').length || 0;
          const photoCount = recipe?.media_links?.filter(m => m.type === 'photo').length || 0;

          return (
            <div
              key={slot.id}
              className={`rounded-2xl border transition-all flex flex-col justify-between overflow-hidden ${
                hasRecipe
                  ? 'bg-white border-slate-200 shadow-xs hover:shadow-md hover:border-emerald-300'
                  : 'bg-slate-50/70 border-dashed border-slate-300'
              }`}
            >
              {/* Card Top */}
              <div className="p-4 space-y-2.5">
                {/* Day Header */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-slate-900">{slot.day_of_week}</span>
                    <span className="text-[10px] uppercase font-semibold tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
                      {slot.meal_type}
                    </span>
                  </div>

                  {hasRecipe && (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onEditManual(slot.day_of_week, recipe)}
                        className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg text-xs"
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
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg text-xs"
                        title="Clear Meal"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                {/* Recipe Content */}
                {hasRecipe && recipe ? (
                  <div
                    onClick={() => onSelectRecipe(recipe, slot.day_of_week)}
                    className="cursor-pointer space-y-2 group"
                  >
                    <h3 className="font-bold text-base text-slate-800 group-hover:text-emerald-700 transition">
                      {recipe.title}
                    </h3>
                    {recipe.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {recipe.description}
                      </p>
                    )}

                    {/* Time & Servings badges */}
                    <div className="flex items-center gap-2 text-xs text-slate-500 pt-1">
                      <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-md font-medium text-[11px]">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>{recipe.prep_time_mins + recipe.cook_time_mins}m total</span>
                      </div>
                      <div className="text-[11px] bg-slate-100 px-2 py-0.5 rounded-md text-slate-600">
                        {recipe.ingredients.length} ingredients
                      </div>
                    </div>

                    {/* Media / Video indicator pill */}
                    {(videoCount > 0 || photoCount > 0) && (
                      <div className="flex items-center gap-2 pt-1 text-[11px]">
                        {videoCount > 0 && (
                          <span className="flex items-center gap-1 font-semibold text-rose-700 bg-rose-50 border border-rose-100 px-2 py-0.5 rounded-full">
                            <Play className="w-2.5 h-2.5 fill-current" />
                            <span>{videoCount} {videoCount === 1 ? 'Video' : 'Videos'}</span>
                          </span>
                        )}
                        {photoCount > 0 && (
                          <span className="flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-full">
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
                            className="text-[10px] font-medium bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Empty state for day */
                  <div className="py-6 flex flex-col items-center justify-center text-center space-y-3">
                    <p className="text-xs text-slate-400 font-medium">No meal set for this night</p>
                    <div className="flex flex-col sm:flex-row gap-2 w-full">
                      <button
                        onClick={() => onTriggerAiForDay(slot.day_of_week)}
                        className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex items-center justify-center gap-1.5 shadow-xs transition"
                      >
                        <Sparkles className="w-3.5 h-3.5" />
                        <span>AI Suggestion</span>
                      </button>
                      <button
                        onClick={() => onEditManual(slot.day_of_week, null)}
                        className="py-2 px-3 rounded-xl bg-white hover:bg-slate-100 text-slate-700 text-xs font-medium border border-slate-200 flex items-center justify-center gap-1 transition"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Manual</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Card Footer (View recipe link) */}
              {hasRecipe && recipe && (
                <div
                  onClick={() => onSelectRecipe(recipe, slot.day_of_week)}
                  className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs font-medium text-emerald-700 hover:bg-emerald-50/50 cursor-pointer transition"
                >
                  <span>View Recipe & Cooking Guides</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
