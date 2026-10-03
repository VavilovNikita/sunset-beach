"use client";

import { useState } from "react";
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import { draftOrderBody, type DraftOrderTarget } from "@/lib/posDraftOrder";
import type { MenuItem, Order } from "@/lib/posTypes";

export default function AddOrderItemForm({
  orderId,
  draft,
  menu,
  onAdded,
}: {
  // null while the ticket is still a draft (lib/posDraftOrder.ts): the first Add creates the
  // order together with this line, in one request.
  orderId: string | null;
  draft?: DraftOrderTarget;
  // Already narrowed to what this order's table may carry (lib/posMenu.ts#menuForOrder) - a
  // restaurant or bar table never lists a spa treatment at all.
  menu: MenuItem[];
  onAdded: (order: Order) => void;
}) {
  const availableMenu = menu;
  // On a table-less ticket both sides can appear; treatments are then grouped apart in their own
  // <optgroup>, same "group, don't mix" treatment PosMenuPicker.tsx gives them.
  const spaMenu = availableMenu.filter((m) => m.department === "SPA");
  const nonSpaMenu = availableMenu.filter((m) => m.department !== "SPA");
  const categories = Array.from(new Set(nonSpaMenu.map((m) => m.category))).sort();
  // Deliberately no default: whatever happened to sort first (once a spa treatment) used to be
  // pre-selected, so an Add pressed straight away rang it up. Choosing is the waiter's action.
  const [menuItemId, setMenuItemId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!menuItemId) return;
    setSubmitting(true);
    setError(null);

    const result = orderId
      ? await adminRequest<Order>(
          `/orders/${orderId}/items`,
          adminJsonInit("POST", [{ menuItemId, quantity, note: note || null }]),
          "Could not add item."
        )
      : await adminRequest<Order>(
          "/orders",
          adminJsonInit("POST", draftOrderBody(draft ?? { tableId: null, guestName: null }, { menuItemId, quantity, note })),
          "Could not start this order."
        );

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }

    onAdded(result.data);
    setMenuItemId("");
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
          <option value="" disabled>
            Choose an item…
          </option>
          {categories.map((c) => (
            <optgroup key={c} label={c}>
              {nonSpaMenu
                .filter((m) => m.category === c)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — ฿{Number(m.price).toLocaleString("en-US")}
                  </option>
                ))}
            </optgroup>
          ))}
          {spaMenu.length > 0 && (
            <optgroup label="Spa">
              {spaMenu.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} — ฿{Number(m.price).toLocaleString("en-US")}
                </option>
              ))}
            </optgroup>
          )}
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
