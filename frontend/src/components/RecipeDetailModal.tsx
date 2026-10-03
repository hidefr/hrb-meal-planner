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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto">
      <div className="bg-[#140f0c] w-full max-w-2xl rounded-3xl shadow-2xl border border-amber-950/70 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#201712] via-[#2d1f18] to-[#1a130f] border-b border-amber-950/50 text-[#f5eedf] relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-1.5 rounded-full bg-white/10 hover:bg-white/20 text-[#f5eedf] transition"
          >
            <X className="w-5 h-5" />
          </button>

          <span className="inline-block text-[11px] uppercase tracking-wider font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full mb-1.5">
            {dayOfWeek} Dinner
          </span>
          <h2 className="text-xl sm:text-2xl font-serif font-bold text-[#f5eedf]">{recipe.title}</h2>
          {recipe.description && (
            <p className="text-xs sm:text-sm text-[#c8bba9] mt-1">{recipe.description}</p>
          )}

          {/* Quick Metrics */}
          <div className="flex flex-wrap items-center gap-4 mt-3 text-xs text-[#dcd1c2]">
            <div className="flex items-center gap-1.5 bg-black/30 border border-amber-950/60 px-2.5 py-1 rounded-lg">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Prep: {recipe.prep_time_mins}m</span>
              <span>•</span>
              <span>Cook: {recipe.cook_time_mins}m</span>
            </div>
            <div className="flex items-center gap-1.5 bg-black/30 border border-amber-950/60 px-2.5 py-1 rounded-lg">
              <Users className="w-3.5 h-3.5 text-amber-400" />
              <span>{recipe.servings} Servings</span>
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 text-[#e0d3c1]">
          
          {/* Tags */}
          {recipe.tags && recipe.tags.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {recipe.tags.map((t, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md text-xs font-medium bg-amber-500/10 text-amber-300 border border-amber-500/20"
                >
                  #{t}
                </span>
              ))}
            </div>
          )}

          {/* Video & Media Search Section */}
          <div className="bg-[#1c1511] border border-amber-950/60 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-semibold text-[#f5eedf]">Cooking Videos & Photos</h3>
              </div>
              <button
                onClick={handleSearchMedia}
                disabled={searchingMedia}
                className="text-xs text-amber-300 hover:text-amber-200 font-medium flex items-center gap-1 hover:underline disabled:opacity-50 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${searchingMedia ? 'animate-spin' : ''}`} />
                <span>{searchingMedia ? 'Searching web...' : 'Find / Refresh Media'}</span>
              </button>
            </div>

            {/* Video results */}
            {videos.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#a89988]">Tutorial Videos:</span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {videos.map((vid) => (
                    <a
                      key={vid.id}
                      href={vid.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2.5 p-2 bg-[#251d17] rounded-xl border border-amber-950/60 hover:border-amber-500/40 transition group"
                    >
                      {vid.thumbnail_url ? (
                        <img
                          src={vid.thumbnail_url}
                          alt={vid.title}
                          className="w-12 h-10 object-cover rounded shrink-0 bg-[#16110e]"
                        />
                      ) : (
                        <div className="w-12 h-10 rounded bg-rose-950/40 text-rose-300 flex items-center justify-center shrink-0">
                          <Play className="w-5 h-5 fill-current" />
                        </div>
                      )}
                      <div className="overflow-hidden">
                        <p className="text-xs font-semibold text-[#f5eedf] truncate group-hover:text-amber-300">
                          {vid.title}
                        </p>
                        <p className="text-[10px] text-[#a89988] flex items-center gap-1">
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
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#a89988]">Dish Previews:</span>
                <div className="flex gap-2 overflow-x-auto py-1">
                  {photos.map((photo) => (
                    <a
                      key={photo.id}
                      href={photo.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-xl overflow-hidden border border-amber-950/60 hover:opacity-90 transition"
                    >
                      <img
                        src={photo.thumbnail_url || photo.url}
                        alt={photo.title}
                        className="w-24 h-20 object-cover bg-[#16110e]"
                      />
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Recipe reference blogs */}
            {webPages.length > 0 && (
              <div className="space-y-1">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#a89988]">Reference Recipe Blogs:</span>
                <div className="space-y-1">
                  {webPages.map((page) => (
                    <a
                      key={page.id}
                      href={page.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-amber-300 hover:text-amber-200 hover:underline flex items-center gap-1 truncate"
                    >
                      <ExternalLink className="w-3 h-3 shrink-0" />
                      <span className="truncate">{page.title}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {videos.length === 0 && photos.length === 0 && webPages.length === 0 && (
              <p className="text-xs text-[#a89988] italic">
                No web media attached yet. Tap "Find / Refresh Media" to fetch YouTube tutorials and photos.
              </p>
            )}
          </div>

          {/* Ingredients */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-bold uppercase tracking-wider text-[#f5eedf]">Ingredients</h3>
              <span className="text-xs text-[#a89988]">{recipe.ingredients.length} items</span>
            </div>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
              {recipe.ingredients.map((ing, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between p-2 rounded-xl bg-[#1c1511] border border-amber-950/40"
                >
                  <span className="font-medium text-[#f5eedf]">{ing.name}</span>
                  <span className="text-amber-300 bg-[#2b2019] px-2 py-0.5 rounded border border-amber-950 font-mono text-[11px]">
                    {ing.amount} {ing.unit}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          {/* Step-by-Step Instructions */}
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-[#f5eedf] mb-2">Step-by-Step Method</h3>
            <ol className="space-y-2.5">
              {recipe.instructions.map((step, idx) => (
                <li key={idx} className="flex gap-3 text-xs sm:text-sm text-[#e0d3c1] leading-relaxed">
                  <span className="w-5 h-5 rounded-full bg-amber-600/30 text-amber-300 border border-amber-500/30 font-bold flex items-center justify-center shrink-0 text-xs">
                    {idx + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-4 bg-[#140f0c] border-t border-amber-950/60 flex items-center justify-between gap-2 flex-wrap">
          <button
            onClick={onEditManual}
            className="px-3.5 py-2 rounded-xl text-xs font-semibold text-[#c8bba9] hover:bg-[#251d17] hover:text-[#f5eedf] border border-amber-950 transition cursor-pointer"
          >
            ✏️ Edit Recipe
          </button>

          <div className="flex items-center gap-2">
            {onStartCookingMode && (
              <button
                type="button"
                onClick={onStartCookingMode}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-amber-600 hover:bg-amber-500 text-white shadow-md shadow-amber-950 transition flex items-center gap-1.5 cursor-pointer"
              >
                <span>🎙️ Start Cooking Mode</span>
              </button>
            )}
            <button
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-[#251d17] hover:bg-[#32271f] text-[#f5eedf] border border-amber-950 transition cursor-pointer"
            >
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
