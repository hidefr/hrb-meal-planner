import React, { useState } from 'react';
import { X, Clock, Users, Play, ExternalLink, Image as ImageIcon, Sparkles, RefreshCw, ChefHat, Check } from 'lucide-react';
import { Recipe, MediaLink } from '../types';
import { searchMediaForRecipe } from '../services/api';

interface RecipeDetailModalProps {
  recipe: Recipe;
  dayOfWeek: string;
  onClose: () => void;
  onEditManual: () => void;
  onRecipeUpdated: (updatedRecipe: Recipe) => void;
  onStartCookingMode?: () => void;
}

export const RecipeDetailModal: React.FC<RecipeDetailModalProps> = ({
  recipe,
  dayOfWeek,
  onClose,
  onEditManual,
  onRecipeUpdated,
  onStartCookingMode,
}) => {
  const [searchingMedia, setSearchingMedia] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const handleSearchMedia = async () => {
    setSearchingMedia(true);
    try {
      const links = await searchMediaForRecipe(recipe.title, recipe.tags, dayOfWeek);
      const updated = { ...recipe, media_links: links };
      onRecipeUpdated(updated);
    } catch (e) {
      console.error(e);
    } finally {
      setSearchingMedia(false);
    }
  };

  const videos = recipe.media_links?.filter(m => m.type === 'video') || [];
  const photos = recipe.media_links?.filter(m => m.type === 'photo') || [];
  const webPages = recipe.media_links?.filter(m => m.type === 'recipe_page') || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div className="bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-emerald-700 to-teal-800 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/20 hover:bg-white/30 text-white transition"
          >
            <X className="w-5 h-5" />
          </button>

          <span className="inline-block text-[11px] uppercase tracking-wider font-bold bg-white/20 px-2.5 py-0.5 rounded-full mb-1.5">
            {dayOfWeek} Dinner
          </span>
          <h2 className="text-xl sm:text-2xl font-bold">{recipe.title}</h2>
          {recipe.description && (
            <p className="text-xs sm:text-sm text-emerald-100 mt-1">{recipe.description}</p>
          )}

          {/* Quick Metrics */}
          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-emerald-100">
            <div className="flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-lg">
              <Clock className="w-3.5 h-3.5" />
              <span>Prep: {recipe.prep_time_mins}m</span>
              <span>•</span>
              <span>Cook: {recipe.cook_time_mins}m</span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/20 px-2.5 py-1 rounded-lg">
              <Users className="w-3.5 h-3.5" />
              <span>{recipe.servings} Servings</span>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-slate-800">
          
          {/* Tags */}
          {recipe.tags && recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {recipe.tags.map((t, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}

          {/* Video & Media Search Section */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-slate-900">Cooking Videos & Photos</h3>
              </div>
              <button
                onClick={handleSearchMedia}
                disabled={searchingMedia}
                className="text-xs text-emerald-700 hover:text-emerald-800 font-medium flex items-center gap-1 hover:underline disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${searchingMedia ? 'animate-spin' : ''}`} />
                <span>{searchingMedia ? 'Searching web...' : 'Find / Refresh Media'}</span>
              </button>
            </div>

            {/* Video results */}
            {videos.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Tutorial Videos:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {videos.map((vid) => (
                    <a
                      key={vid.id}
                      href={vid.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 p-2 bg-white rounded-lg border border-slate-200 hover:border-emerald-400 hover:shadow-xs transition group"
                    >
                      {vid.thumbnail_url ? (
                        <img
                          src={vid.thumbnail_url}
                          alt={vid.title}
                          className="w-12 h-10 object-cover rounded shrink-0 bg-slate-200"
                        />
                      ) : (
                        <div className="w-12 h-10 rounded bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                          <Play className="w-5 h-5 fill-current" />
                        </div>
                      )}
                      <div className="overflow-hidden">
                        <p className="text-xs font-semibold text-slate-800 truncate group-hover:text-emerald-700">
                          {vid.title}
                        </p>
                        <p className="text-[10px] text-slate-400 flex items-center gap-1">
                          <span>{vid.source_name || 'YouTube'}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </p>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Food photos preview */}
            {photos.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Dish Previews:</span>
                <div className="flex gap-2 overflow-x-auto py-1">
                  {photos.map((photo) => (
                    <a
                      key={photo.id}
                      href={photo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-lg overflow-hidden border border-slate-200 hover:opacity-90 transition"
                    >
                      <img
                        src={photo.thumbnail_url || photo.url}
                        alt={photo.title}
                        className="w-24 h-20 object-cover bg-slate-100"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Recipe reference blogs */}
            {webPages.length > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Reference Recipe Blogs:</span>
                <div className="space-y-1">
                  {webPages.map((page) => (
                    <a
                      key={page.id}
                      href={page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-emerald-700 hover:text-emerald-800 hover:underline flex items-center gap-1 truncate"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{page.title}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {videos.length === 0 && photos.length === 0 && webPages.length === 0 && (
              <p className="text-xs text-slate-500 italic">
                No web media attached yet. Tap "Find / Refresh Media" to fetch YouTube tutorials and photos.
              </p>
            )}
          </div>

          {/* Ingredients */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900">Ingredients</h3>
              <span className="text-xs text-slate-500">{recipe.ingredients.length} items</span>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {recipe.ingredients.map((ing, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100"
                >
                  <span className="font-medium text-slate-800">{ing.name}</span>
                  <span className="text-slate-500 bg-white px-2 py-0.5 rounded border border-slate-200 font-mono text-[11px]">
                    {ing.amount} {ing.unit}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Step-by-Step Instructions */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-slate-900 mb-2">Step-by-Step Method</h3>
            <ol className="space-y-2.5">
              {recipe.instructions.map((step, idx) => (
                <li key={idx} className="flex gap-3 text-xs sm:text-sm text-slate-700 leading-relaxed">
                  <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-800 font-bold flex items-center justify-center shrink-0 text-xs">
                    {idx + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2 flex-wrap">
          <button
            onClick={onEditManual}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-slate-700 hover:bg-slate-200 border border-slate-300 transition cursor-pointer"
          >
            ✏️ Edit Recipe
          </button>

          <div className="flex items-center gap-2">
            {onStartCookingMode && (
              <button
                type="button"
                onClick={onStartCookingMode}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>🎙️ Start Cooking Mode</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-200 hover:bg-slate-300 text-slate-800 transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
