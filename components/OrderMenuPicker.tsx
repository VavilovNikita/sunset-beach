"use client";

import { useMemo, useState } from "react";
import { addOrderItem, createOrderWithItem } from "@/lib/pos/ordersClient";
import type { DraftOrderTarget } from "@/lib/posDraftOrder";
import type { MenuItem, Order } from "@/lib/posTypes";

// The item picker of the one order ticket both POS surfaces render (OrderTicket.tsx): categories
// as large tabs plus a search box, and one tap = one item added immediately (quantity 1, no
// staging cart to lose track of). Adding a second of the same item is another tap - see the +/-
// stepper on the ticket's own item rows for adjusting a line already on the order. It replaced the
// desktop's old <select>-per-add form, which had no search and no categories to scan by.
//
// Narrow screens get the categories as a scrolling row of chips above the items; from `xl` up
// (a desktop till, beside the ticket column) they become a vertical list to the left of a wider
// item grid. Same buttons, same state - only the arrangement changes.
//
// The note button is a deliberately separate tap target (its own button, not a mode the card
// itself enters) so the common no-note case never grows an extra step: the card's own tap area
// still adds instantly. Only tapping the note button first swaps that one card into a text
// field + its own "Add" button - every other card stays one tap, and adding a note is opt-in,
// one extra tap, never a default detour. It's a full-height 44px column beside the add area,
// never a small overlay in the add area's corner: a corner overlay sat inside the card's own tap
// area, so a slightly-off tap aimed at the note silently added the item with no note instead.
//
// Which items appear at all is decided by the order's table before they get here
// (lib/posMenu.ts#menuForOrder): a restaurant/bar table never sees a treatment, a spa table sees
// only treatments. Where both can appear (a table-less ticket), treatments are grouped under their
// own pinned "Spa" tab, regardless of whatever free-text `category` they were given. There is no
// pre-selected item to add by accident: nothing is added until an item itself is tapped.
const SPA_TAB = "__spa__";

export default function OrderMenuPicker({
  orderId,
  draft,
  menu,
  onAdded,
  initialCategory,
  onCategoryChange,
}: {
  // null while the ticket is a draft - the first tap creates the order with that item.
  orderId: string | null;
  draft?: DraftOrderTarget;
  menu: MenuItem[];
  onAdded: (order: Order) => void;
  // The tab to open on. The first item of a draft creates the order and moves to its own page -
  // a fresh picker - so the draft reports its tab and the order page passes it back in; without
  // that, the waiter was thrown back to the first category after every first item.
  initialCategory?: string | null;
  onCategoryChange?: (category: string | null) => void;
}) {
  const available = useMemo(() => menu.filter((m) => m.isAvailable), [menu]);
  const spaItems = useMemo(() => available.filter((m) => m.department === "SPA"), [available]);
  const nonSpaItems = useMemo(() => available.filter((m) => m.department !== "SPA"), [available]);
  const categories = useMemo(() => Array.from(new Set(nonSpaItems.map((m) => m.category))).sort(), [nonSpaItems]);
  const [category, setCategoryState] = useState<string | null>(() => {
    if (initialCategory && (categories.includes(initialCategory) || (initialCategory === SPA_TAB && spaItems.length > 0))) return initialCategory;
    return categories[0] ?? (spaItems.length > 0 ? SPA_TAB : null);
  });
  function setCategory(next: string | null) {
    setCategoryState(next);
    onCategoryChange?.(next);
  }
  const [query, setQuery] = useState("");
  const [addingId, setAddingId] = useState<string | null>(null);
  const [noteDraftId, setNoteDraftId] = useState<string | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

  const visible = available.filter((m) => {
    if (query.trim()) return m.name.toLowerCase().includes(query.trim().toLowerCase());
    if (category === SPA_TAB) return m.department === "SPA";
    return m.department !== "SPA" && (category === null || m.category === category);
  });

  async function handleTap(item: MenuItem, note?: string) {
    setError(null);
    setAddingId(item.id);
    const line = { menuItemId: item.id, quantity: 1, note: note || undefined };
    const result = orderId
      ? await addOrderItem(orderId, line)
      : await createOrderWithItem(draft ?? { tableId: null, guestName: null }, line);
    setAddingId(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setNoteDraftId(null);
    setNoteDraft("");
    onAdded(result.data);
  }

  function openNoteDraft(item: MenuItem) {
    setNoteDraftId(item.id);
    setNoteDraft("");
  }

  if (available.length === 0) {
    return <p className="text-sm text-cream/50">No available menu items.</p>;
  }

  const showTabs = !query.trim() && (categories.length > 0 || spaItems.length > 0);

  return (
    <div>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search menu…"
        className="w-full bg-ink2 border border-cream/20 rounded-xl px-4 py-3 text-cream text-base placeholder:text-cream/30 focus:outline-none focus:border-coral mb-3"
      />

      {error && <p className="text-sm text-coral mb-3">{error}</p>}

      <div className="xl:flex xl:items-start xl:gap-4">
        {showTabs && (
          <div className="flex gap-2 overflow-x-auto pb-1 mb-3 -mx-1 px-1 xl:flex-col xl:overflow-visible xl:w-44 xl:shrink-0 xl:mx-0 xl:px-0 xl:mb-0">
            {categories.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setCategory(c)}
                className={`shrink-0 text-sm rounded-full px-4 py-2.5 font-medium transition-colors xl:text-left xl:rounded-xl ${
                  category === c ? "bg-coral text-ink" : "bg-ink2 text-cream/60 hover:text-cream"
                }`}
              >
                {c}
              </button>
            ))}
            {spaItems.length > 0 && (
              <button
                type="button"
                onClick={() => setCategory(SPA_TAB)}
                className={`shrink-0 text-sm rounded-full px-4 py-2.5 font-medium transition-colors xl:text-left xl:rounded-xl ${
                  category === SPA_TAB ? "bg-coral text-ink" : "bg-sea/15 text-sea"
                }`}
              >
                Spa
              </button>
            )}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 xl:flex-1 xl:min-w-0">
          {visible.map((item) =>
            noteDraftId === item.id ? (
              <div
                key={item.id}
                className="min-h-[64px] rounded-xl bg-ink2 border border-coral/40 px-3 py-2.5 flex flex-col gap-1.5"
              >
                <p className="text-cream text-sm leading-snug truncate">{item.name}</p>
                <input
                  autoFocus
                  type="text"
                  value={noteDraft}
                  onChange={(e) => setNoteDraft(e.target.value)}
                  placeholder="e.g. no ice"
                  className="w-full bg-ink border border-cream/20 rounded-lg px-2.5 py-1.5 text-cream text-sm placeholder:text-cream/30 focus:outline-none focus:border-coral"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={addingId === item.id}
                    onClick={() => handleTap(item, noteDraft)}
                    className="flex-1 min-h-11 rounded-full border border-coral bg-coral hover:bg-coraldeep active:bg-coraldeep transition-colors text-sm font-medium disabled:opacity-50"
                  >
                    {addingId === item.id ? "Adding…" : "Add"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setNoteDraftId(null)}
                    className="flex-1 min-h-11 rounded-full border border-cream/25 hover:border-cream/50 active:border-cream/50 transition-colors text-sm font-medium"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div key={item.id} className="flex min-h-[64px] rounded-xl bg-ink2 border border-cream/10 overflow-hidden">
                <button
                  type="button"
                  disabled={addingId === item.id}
                  onClick={() => handleTap(item)}
                  className="flex-1 min-w-0 hover:bg-sea/10 active:bg-sea/15 transition-colors px-3 py-2.5 text-left disabled:opacity-50"
                >
                  <p className="text-cream text-sm leading-snug">{item.name}</p>
                  <p className="text-cream/50 text-xs mt-0.5">฿{Number(item.price).toLocaleString("en-US")}</p>
                </button>
                <button
                  type="button"
                  aria-label={`Add ${item.name} with a note`}
                  title="Add with a note"
                  onClick={() => openNoteDraft(item)}
                  className="shrink-0 w-11 flex items-center justify-center border-l border-cream/10 text-cream/50 hover:text-coral active:bg-sea/15 active:text-coral transition-colors text-base"
                >
                  ✎
                </button>
              </div>
            )
          )}
          {visible.length === 0 && <p className="col-span-full text-cream/50 text-sm py-2">No matching items.</p>}
        </div>
      </div>
    </div>
  );
}
