"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePolling } from "@/lib/usePolling";
import { fetchGuestMenu, fetchGuestOrder, addGuestOrderItems } from "@/lib/guestOrderClient";
import type { MenuItem } from "@/lib/posTypes";
import type { GuestOrderView } from "@/lib/guestOrderTypes";

const STATUS_LABELS: Record<GuestOrderView["status"], string> = {
  OPEN: "Open",
  SENT: "Sent to the kitchen",
  PAID: "Closed",
  CANCELLED: "Cancelled",
};

// The guest-facing dine-in QR ordering screen (app/order/[orderId]/page.tsx) — no login, gated
// entirely by `token`. Polls GET /public/orders/{id} every 5s (same convention as other live
// boards, see lib/usePolling.ts) since several phones may share one table's order and staff may
// ring items in directly.
//
// The backend gives the exact same 404 for a wrong token, an unknown order, and an order that's
// left OPEN/SENT (paid or cancelled) — see OrderService#requireGuestAccess's own javadoc for why
// (a guessing attempt must learn nothing). This component still tells the two situations apart
// for the guest, but only from what it itself has observed, never from anything the server says:
// a 404 on the very first load reads as "this code isn't valid", while a 404 on a later poll
// (after this screen already showed a real order) reads as "this order was just closed" — the
// far more likely explanation once we know the token and id were good a moment ago.
export default function GuestOrderClient({ orderId, token }: { orderId: string; token: string }) {
  const [order, setOrder] = useState<GuestOrderView | null>(null);
  const [menu, setMenu] = useState<MenuItem[] | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [transientError, setTransientError] = useState<string | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);

  async function refetchOrder(currentOrder: GuestOrderView | null) {
    const result = await fetchGuestOrder(orderId, token);
    if (result.ok) {
      setOrder(result.data);
      setTransientError(null);
      setGateError(null);
      return;
    }
    if (result.status === 404) {
      setGateError(
        currentOrder
          ? "This order has been closed. Thanks for visiting — ask a member of staff if you'd like to order more."
          : "This QR code isn't valid, or the order it points to is no longer open. Ask a member of staff for a fresh code."
      );
      return;
    }
    // A transient failure (network/server error, not the access gate) - keep showing whatever
    // was already on screen and surface it as a banner, never as a full-screen replacement. See
    // this app's own "never swallow a failure into a plausible-looking empty state" rule.
    setTransientError(result.error);
  }

  useEffect(() => {
    if (!token) {
      setGateError("This link is missing its access code. Ask a member of staff for a fresh QR code.");
      return;
    }
    refetchOrder(null);
    fetchGuestMenu().then((result) => {
      if (result.ok) setMenu(result.data);
    });
    // Only ever needs to run once per (orderId, token) pair - refetchOrder/fetchGuestMenu read
    // no other reactive state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, token]);

  usePolling(() => refetchOrder(order), 5000, Boolean(token) && gateError === null);

  useEffect(() => {
    if (category !== null || !menu) return;
    const first = Array.from(new Set(menu.map((m) => m.category))).sort()[0];
    if (first) setCategory(first);
  }, [menu, category]);

  async function handleAdd(item: MenuItem) {
    setActionError(null);
    setAddingId(item.id);
    const result = await addGuestOrderItems(orderId, token, [{ menuItemId: item.id, quantity: 1 }]);
    setAddingId(null);
    if (result.ok) {
      setOrder(result.data);
      return;
    }
    if (result.status === 404) {
      setGateError("This order has been closed. Thanks for visiting — ask a member of staff if you'd like to order more.");
      return;
    }
    setActionError(result.error);
  }

  if (gateError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="max-w-xs">
          <p className="eyebrow text-sea mb-3">Sunset Beach</p>
          <p className="text-cream/70 text-sm">{gateError}</p>
          <Link href="/" className="inline-block mt-6 text-sm text-coral hover:underline">
            Visit our website
          </Link>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <p className="text-cream/50 text-sm">Loading your order…</p>
      </div>
    );
  }

  const canOrder = order.status === "OPEN" || order.status === "SENT";
  const categories = menu ? Array.from(new Set(menu.map((m) => m.category))).sort() : [];
  const visibleMenuItems = (menu ?? []).filter((m) => m.category === category);

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-16">
      <p className="eyebrow text-sea mb-1">Sunset Beach</p>
      <h1 className="font-display italic text-2xl mb-1">{order.locationLabel}</h1>
      <p className="text-xs text-cream/50 mb-6">{STATUS_LABELS[order.status]}</p>

      {transientError && <p className="text-sm text-coral bg-coral/10 border border-coral/30 rounded-xl px-4 py-3 mb-6">{transientError}</p>}

      {!canOrder && (
        <p className="text-sm text-cream/60 bg-ink2 border border-cream/10 rounded-xl px-4 py-3 mb-6">
          This order is closed and can no longer be added to.
        </p>
      )}

      {order.items.length > 0 && (
        <div className="mb-8">
          <p className="eyebrow text-cream/50 mb-3">Your order</p>
          <div className="space-y-2">
            {order.items.map((item, index) => (
              <div key={index} className="flex items-center justify-between bg-ink2 border border-cream/10 rounded-xl px-4 py-3">
                <div className="min-w-0">
                  <p className="text-cream text-sm">
                    {item.quantity}× {item.name}
                  </p>
                  {item.note && <p className="text-xs text-cream/50 mt-0.5">{item.note}</p>}
                </div>
                <p className="text-cream/70 text-sm shrink-0">
                  ฿{(Number(item.unitPrice) * item.quantity).toLocaleString("en-US")}
                </p>
              </div>
            ))}
          </div>
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-cream/10">
            <p className="text-cream/70 text-sm">Total</p>
            <p className="font-display italic text-xl text-coral">฿{Number(order.total).toLocaleString("en-US")}</p>
          </div>
        </div>
      )}
      {order.items.length === 0 && canOrder && <p className="text-cream/50 text-sm mb-8">No items yet — add something below.</p>}

      {canOrder && menu && (
        <div>
          <p className="eyebrow text-cream/50 mb-3">Menu</p>
          {categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-1 px-1">
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

          {actionError && <p className="text-sm text-coral mb-3">{actionError}</p>}

          <div className="grid grid-cols-2 gap-2.5">
            {visibleMenuItems.map((item) => (
              <button
                key={item.id}
                type="button"
                disabled={addingId === item.id}
                onClick={() => handleAdd(item)}
                className="rounded-xl bg-ink2 border border-cream/10 active:bg-sea/15 active:border-sea/40 transition-colors px-3 py-2.5 text-left disabled:opacity-50"
              >
                <p className="text-cream text-sm leading-snug">{item.name}</p>
                <p className="text-cream/50 text-xs mt-0.5">
                  {addingId === item.id ? "Adding…" : `฿${Number(item.price).toLocaleString("en-US")}`}
                </p>
              </button>
            ))}
            {visibleMenuItems.length === 0 && <p className="col-span-2 text-cream/50 text-sm py-2">No items in this category.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
