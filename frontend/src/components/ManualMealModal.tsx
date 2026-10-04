import React, { useState } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Recipe, Ingredient } from '../types';

interface ManualMealModalProps {
  dayOfWeek: string;
  initialRecipe?: Recipe | null;
  onClose: () => void;
  onSave: (day: string, recipe: Recipe) => void;
}

export const ManualMealModal: React.FC<ManualMealModalProps> = ({
  dayOfWeek,
  initialRecipe,
  onClose,
  onSave
}) => {
  const [day, setDay] = useState(dayOfWeek);
  const [title, setTitle] = useState(initialRecipe?.title || '');
  const [description, setDescription] = useState(initialRecipe?.description || '');
  const [prepTime, setPrepTime] = useState(initialRecipe?.prep_time_mins || 15);
  const [cookTime, setCookTime] = useState(initialRecipe?.cook_time_mins || 25);
  const [servings, setServings] = useState(initialRecipe?.servings || 2);
  const [tagsStr, setTagsStr] = useState(initialRecipe?.tags?.join(', ') || 'one-pot, 30-min');
  
  const [ingredients, setIngredients] = useState<Ingredient[]>(
    initialRecipe?.ingredients || [
      { name: 'Olive Oil', amount: 1, unit: 'tbsp', category: 'Pantry' },
      { name: 'Garlic', amount: 3, unit: 'cloves', category: 'Produce' }
    ]
  );

  const [instructions, setInstructions] = useState<string[]>(
    initialRecipe?.instructions || [
      'Heat oil in a large skillet over medium-high heat.',
      'Add ingredients and cook until golden brown and cooked through.'
    ]
  );

  const handleAddIngredient = () => {
    setIngredients([...ingredients, { name: '', amount: 1, unit: 'item', category: 'Produce' }]);
  };

  const handleRemoveIngredient = (idx: number) => {
    setIngredients(ingredients.filter((_, i) => i !== idx));
  };

  const handleAddInstruction = () => {
    setInstructions([...instructions, '']);
  };

  const handleRemoveInstruction = (idx: number) => {
    setInstructions(instructions.filter((_, i) => i !== idx));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    const tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
    const validIngredients = ingredients.filter(i => i.name.trim().length > 0);
    const validInstructions = instructions.filter(s => s.trim().length > 0);

    const recipe: Recipe = {
      id: initialRecipe?.id || Math.random().toString(36).substring(7),
      title: title.trim(),
      description: description.trim(),
      prep_time_mins: Number(prepTime),
      cook_time_mins: Number(cookTime),
      servings: Number(servings),
      tags,
      ingredients: validIngredients,
      instructions: validInstructions,
      media_links: initialRecipe?.media_links || []
    };

    onSave(day, recipe);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs overflow-y-auto">
      <div className="bg-[#181310] text-[#f5eedf] w-full max-w-xl rounded-3xl shadow-2xl border border-[#34271D] overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-[#211A15] border-b border-[#34271D] flex items-center justify-between">
          <h2 className="text-base font-bold text-[#f5eedf]">
            {initialRecipe ? `Edit Meal for ${day}` : `Add Meal for ${day}`}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg text-[#8c7b6d] hover:text-[#f5eedf] transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 text-xs sm:text-sm">
          {/* Day & Title */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-[#a89988] font-medium mb-1">Day of Week</label>
              <select
                value={day}
                onChange={(e) => setDay(e.target.value)}
                className="w-full bg-[#140F0C] border border-[#3B2C21] text-[#f5eedf] rounded-xl px-3 py-2 focus:border-amber-500 focus:outline-hidden"
              >
                {['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'].map(d => (
                  <option key={d} value={d} className="bg-[#181310] text-[#f5eedf]">{d}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[#a89988] font-medium mb-1">Recipe Title *</label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Lemon Herb Roasted Chicken"
                className="w-full bg-[#140F0C] border border-[#3B2C21] text-[#f5eedf] rounded-xl px-3 py-2 placeholder-[#8c7b6d] focus:border-amber-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#a89988] font-medium mb-1">Description / Notes</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. Crispy chicken with tender roasted potatoes and rosemary"
              className="w-full bg-[#140F0C] border border-[#3B2C21] text-[#f5eedf] rounded-xl px-3 py-2 placeholder-[#8c7b6d] focus:border-amber-500 focus:outline-hidden"
            />
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-[#a89988] font-medium mb-1">Prep (mins)</label>
              <input
                type="number"
                min="0"
                value={prepTime}
                onChange={(e) => setPrepTime(Number(e.target.value))}
                className="w-full bg-[#140F0C] border border-[#3B2C21] text-[#f5eedf] rounded-xl px-3 py-2 focus:border-amber-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-[#a89988] font-medium mb-1">Cook (mins)</label>
              <input
                type="number"
                min="0"
                value={cookTime}
                onChange={(e) => setCookTime(Number(e.target.value))}
                className="w-full bg-[#140F0C] border border-[#3B2C21] text-[#f5eedf] rounded-xl px-3 py-2 focus:border-amber-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-[#a89988] font-medium mb-1">Servings</label>
              <input
                type="number"
                min="1"
                value={servings}
                onChange={(e) => setServings(Number(e.target.value))}
                className="w-full bg-[#140F0C] border border-[#3B2C21] text-[#f5eedf] rounded-xl px-3 py-2 focus:border-amber-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#a89988] font-medium mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              placeholder="one-pot, 30-min, high-protein"
              className="w-full bg-[#140F0C] border border-[#3B2C21] text-[#f5eedf] rounded-xl px-3 py-2 placeholder-[#8c7b6d] focus:border-amber-500 focus:outline-hidden"
            />
          </div>

          {/* Ingredients list */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[#f5eedf] font-semibold">Ingredients</label>
              <button
                type="button"
                onClick={handleAddIngredient}
                className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add Ingredient
              </button>
            </div>
            <div className="space-y-2">
              {ingredients.map((ing, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    placeholder="Item name"
                    value={ing.name}
                    onChange={(e) => {
                      const updated = [...ingredients];
                      updated[i].name = e.target.value;
                      setIngredients(updated);
                    }}
                    className="flex-2 bg-[#140F0C] border border-[#3B2C21] text-[#f5eedf] placeholder-[#8c7b6d] rounded-lg px-2.5 py-1.5 focus:border-amber-500 focus:outline-hidden"
                  />
                  <input
                    type="number"
                    step="0.1"
                    placeholder="Qty"
                    value={ing.amount}
                    onChange={(e) => {
                      const updated = [...ingredients];
                      updated[i].amount = Number(e.target.value);
                      setIngredients(updated);
                    }}
                    className="w-16 bg-[#140F0C] border border-[#3B2C21] text-[#f5eedf] rounded-lg px-2 py-1.5 text-center focus:border-amber-500 focus:outline-hidden"
                  />
                  <input
                    type="text"
                    placeholder="Unit"
                    value={ing.unit}
                    onChange={(e) => {
                      const updated = [...ingredients];
                      updated[i].unit = e.target.value;
                      setIngredients(updated);
                    }}
                    className="w-20 bg-[#140F0C] border border-[#3B2C21] text-[#f5eedf] placeholder-[#8c7b6d] rounded-lg px-2 py-1.5 focus:border-amber-500 focus:outline-hidden"
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveIngredient(i)}
                    className="p-1.5 text-[#8c7b6d] hover:text-rose-400 rounded-lg transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Instructions list */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-[#f5eedf] font-semibold">Method Steps</label>
              <button
                type="button"
                onClick={handleAddInstruction}
                className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-1 transition"
              >
                <Plus className="w-3.5 h-3.5" /> Add Step
              </button>
            </div>
            <div className="space-y-2">
              {instructions.map((step, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="w-6 h-8 text-xs text-amber-400 font-bold flex items-center justify-center shrink-0">
                    {idx + 1}.
                  </span>
                  <textarea
                    rows={1}
                    value={step}
                    onChange={(e) => {
                      const updated = [...instructions];
                      updated[idx] = e.target.value;
                      setInstructions(updated);
                    }}
                    className="flex-1 bg-[#140F0C] border border-[#3B2C21] text-[#f5eedf] placeholder-[#8c7b6d] rounded-lg px-2.5 py-1.5 resize-y text-xs focus:border-amber-500 focus:outline-hidden"
                    placeholder={`Step ${idx + 1}...`}
                  />
                  <button
                    type="button"
                    onClick={() => handleRemoveInstruction(idx)}
                    className="p-1.5 text-[#8c7b6d] hover:text-rose-400 rounded-lg mt-1 transition"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Submit buttons */}
          <div className="pt-3 border-t border-[#34271D] flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-[#a89988] hover:bg-[#2C211A] hover:text-[#f5eedf] font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold shadow-md transition cursor-pointer"
            >
              Save Meal & Update Groceries
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
