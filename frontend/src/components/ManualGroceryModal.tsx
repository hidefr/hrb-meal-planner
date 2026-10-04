import React, { useState } from 'react';
import { X, Plus } from 'lucide-react';

interface ManualGroceryModalProps {
  onClose: () => void;
  onAdd: (item: { name: string; amount: number; unit: string; category?: string; notes?: string }) => void;
}

const AISLE_CATEGORIES = [
  "Produce",
  "Meat & Seafood",
  "Dairy & Refrigerated",
  "Bakery",
  "Pantry",
  "Spices & Seasonings",
  "Frozen",
  "Other"
];

export const ManualGroceryModal: React.FC<ManualGroceryModalProps> = ({ onClose, onAdd }) => {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState(1);
  const [unit, setUnit] = useState('item');
  const [category, setCategory] = useState('Produce');
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onAdd({
      name: name.trim(),
      amount: Number(amount),
      unit: unit.trim() || 'item',
      category,
      notes: notes.trim() || undefined
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-xs">
      <div className="bg-[#181310] text-[#f5eedf] w-full max-w-md rounded-3xl shadow-2xl border border-[#34271D] overflow-hidden">
        <div className="px-5 py-4 bg-[#211A15] border-b border-[#34271D] flex items-center justify-between">
          <h2 className="text-base font-bold text-[#f5eedf]">Add Grocery Item</h2>
          <button onClick={onClose} className="p-1 rounded-lg text-[#8c7b6d] hover:text-[#f5eedf] transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4 text-xs sm:text-sm">
          <div>
            <label className="block text-[#a89988] font-medium mb-1">Item Name *</label>
            <input
              type="text"
              required
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Oat Milk, Avocados, Coffee Beans"
              className="w-full bg-[#140F0C] border border-[#3B2C21] text-[#f5eedf] rounded-xl px-3 py-2 placeholder-[#8c7b6d] focus:border-amber-500 focus:outline-hidden"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[#a89988] font-medium mb-1">Quantity</label>
              <input
                type="number"
                min="0.1"
                step="0.5"
                value={amount}
                onChange={(e) => setAmount(Number(e.target.value))}
                className="w-full bg-[#140F0C] border border-[#3B2C21] text-[#f5eedf] rounded-xl px-3 py-2 focus:border-amber-500 focus:outline-hidden"
              />
            </div>
            <div>
              <label className="block text-[#a89988] font-medium mb-1">Unit</label>
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="carton, bag, lb, item"
                className="w-full bg-[#140F0C] border border-[#3B2C21] text-[#f5eedf] placeholder-[#8c7b6d] rounded-xl px-3 py-2 focus:border-amber-500 focus:outline-hidden"
              />
            </div>
          </div>

          <div>
            <label className="block text-[#a89988] font-medium mb-1">Store Aisle / Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-[#140F0C] border border-[#3B2C21] text-[#f5eedf] rounded-xl px-3 py-2 focus:border-amber-500 focus:outline-hidden"
            >
              {AISLE_CATEGORIES.map(cat => (
                <option key={cat} value={cat} className="bg-[#181310] text-[#f5eedf]">{cat}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[#a89988] font-medium mb-1">Notes (Optional)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Unsweetened vanilla brand"
              className="w-full bg-[#140F0C] border border-[#3B2C21] text-[#f5eedf] placeholder-[#8c7b6d] rounded-xl px-3 py-2 focus:border-amber-500 focus:outline-hidden"
            />
          </div>

          <div className="pt-2 flex justify-end gap-2">
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
              Add Item
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
