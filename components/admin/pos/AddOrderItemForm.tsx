"use client";

import { useState } from "react";
import { ADMIN_API_URL } from "@/lib/backend";
import { extractApiError } from "@/lib/apiError";
import type { MenuItem, Order } from "@/lib/posTypes";

export default function AddOrderItemForm({
  orderId,
  menuById,
  onAdded,
}: {
  orderId: string;
  menuById: Map<string, MenuItem>;
  onAdded: (order: Order) => void;
}) {
  const availableMenu = Array.from(menuById.values()).filter((m) => m.isAvailable);
  const [menuItemId, setMenuItemId] = useState(availableMenu[0]?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!menuItemId) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch(`${ADMIN_API_URL}/orders/${orderId}/items`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify([{ menuItemId, quantity, note: note || null }]),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(extractApiError(data, "Could not add item."));
      return;
    }

    onAdded(await res.json());
    setQuantity(1);
    setNote("");
  }

  if (availableMenu.length === 0) {
    return <p className="text-sm text-cream/50">No available menu items. Add some under Menu first.</p>;
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3 bg-ink2/40 border border-cream/10 rounded-xl p-4">
      <div className="flex-1 min-w-[160px]">
        <label className="eyebrow text-cream/60 block mb-1">Item</label>
        <select
          value={menuItemId}
          onChange={(e) => setMenuItemId(e.target.value)}
          className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
        >
          {availableMenu.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name} — ฿{Number(m.price).toLocaleString("en-US")}
            </option>
          ))}
        </select>
      </div>
      <div className="w-20">
        <label className="eyebrow text-cream/60 block mb-1">Qty</label>
        <input
          type="number"
          min={1}
          value={quantity}
          onChange={(e) => setQuantity(Number(e.target.value))}
          className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <div className="flex-1 min-w-[160px]">
        <label className="eyebrow text-cream/60 block mb-1">Note</label>
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. no ice"
          className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm placeholder:text-cream/30 focus:outline-none focus:border-coral"
        />
      </div>
      <button
        type="submit"
        disabled={submitting || !menuItemId}
        className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2.5 text-sm font-medium disabled:opacity-60"
      >
        {submitting ? "Adding…" : "Add"}
      </button>
      {error && <p className="w-full text-sm text-coral">{error}</p>}
    </form>
  );
}
