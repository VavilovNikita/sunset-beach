"use client";

import { useMemo, useState } from "react";
import { addOrderItem } from "@/lib/pos/ordersClient";
import type { MenuItem, Order } from "@/lib/posTypes";

// Replaces the admin's <select>-per-add pattern (AddOrderItemForm.tsx) with categories as large
// tabs plus a search box, and one tap = one item added immediately (quantity 1, no staging cart
// to lose track of). Adding a second of the same item is another tap - see the +/- stepper on
// the ticket's own item rows for adjusting a line already on the order.
export default function PosMenuPicker({
  orderId,
  menu,
  onAdded,
}: {
  orderId: string;
  menu: MenuItem[];
  onAdded: (order: Order) => void;
}) {
  const available = useMemo(() => menu.filter((m) => m.isAvailable), [menu]);
  const categories = useMemo(() => Array.from(new Set(available.map((m) => m.category))).sort(), [available]);
  const [category, setCategory] = useState<string | null>(categories[0] ?? null);
  const [query, setQuery] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const visible = available.filter((m) => {
    if (query.trim()) return m.name.toLowerCase().includes(query.trim().toLowerCase());
    return category === null || m.category === category;
  });

  async function handleTap(item: MenuItem) {
    setError(null);
    setAddingId(item.id);
    const result = await addOrderItem(orderId, { menuItemId: item.id, quantity: 1 });
    setAddingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onAdded(result.data);
  }

  if (available.length === 0) {
    return <p className="text-sm text-cream/50">No available menu items.</p>;
  }

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search menu…"
        className="w-full bg-ink2 border border-cream/20 rounded-xl px-4 py-3 text-cream text-base placeholder:text-cream/30 focus:outline-none focus:border-coral mb-3"
      />

      {!query.trim() && (
        <div className="flex gap-2 overflow-x-auto pb-1 mb-3 -mx-1 px-1">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`shrink-0 text-sm rounded-full px-4 py-2.5 font-medium transition-colors ${
                category === c ? "bg-coral text-ink" : "bg-ink2 text-cream/60"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {error && <p className="text-sm text-coral mb-3">{error}</p>}

      <div className="grid grid-cols-2 gap-2.5">
        {visible.map((item) => (
          <button
            key={item.id}
            type="button"
            disabled={addingId === item.id}
            onClick={() => handleTap(item)}
            className="min-h-[64px] rounded-xl bg-ink2 border border-cream/10 active:bg-sea/15 active:border-sea/40 transition-colors px-3 py-2.5 text-left disabled:opacity-50"
          >
            <p className="text-cream text-sm leading-snug">{item.name}</p>
            <p className="text-cream/50 text-xs mt-0.5">฿{Number(item.price).toLocaleString("en-US")}</p>
          </button>
        ))}
        {visible.length === 0 && <p className="col-span-2 text-cream/50 text-sm py-2">No matching items.</p>}
      </div>
    </div>
  );
}
