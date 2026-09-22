"use client";

import { useEffect, useState } from "react";
import { fetchGuestMenu } from "@/lib/guestOrderClient";
import { submitRoomServiceOrder, addRoomServiceOrderItems } from "@/lib/roomServiceOrderClient";
import type { MenuItem } from "@/lib/posTypes";
import type { GuestOrderView } from "@/lib/guestOrderTypes";
import type { GuestBooking } from "@/lib/guestSession";

const STATUS_LABELS: Record<GuestOrderView["status"], string> = {
  OPEN: "Open",
  SENT: "Sent to the kitchen",
  PAID: "Closed",
  CANCELLED: "Cancelled",
};

// Room-service ordering for a signed-in, CHECKED_IN guest (app/guest/room-service/page.tsx) — the
// authenticated counterpart of GuestOrderClient's unauthenticated dine-in door. Deliberately
// simpler than that one: no polling (this is one guest's own account, not several phones sharing
// a table's order, so there's nothing else that could change it underneath this screen), and the
// same tap-to-add interaction dine-in already uses rather than a separate cart/"place order" step
// - the first tap calls POST /guest/orders (creating the order), every tap after calls
// POST /guest/orders/{id}/items on the order that's already open.
//
// The server re-checks ownership and CHECKED_IN on every single write (see RoomServiceOrderingService's
// own class javadoc) - `bookings` here (already filtered to CHECKED_IN by the server page) is a
// convenience for which room to offer, never trusted as the actual gate. A 404 from either write
// means the server's gate just failed - wrong booking, no longer checked in, or the order isn't
// this guest's own - and this screen shows one generic message for all three, same "a guessing
// attempt learns nothing" discipline the backend itself uses.
export default function GuestRoomServiceClient({ bookings }: { bookings: GuestBooking[] }) {
  const [bookingId, setBookingId] = useState<string | null>(bookings.length === 1 ? bookings[0].id : null);
  const [menu, setMenu] = useState<MenuItem[] | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [order, setOrder] = useState<GuestOrderView | null>(null);
  const [addingId, setAddingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);

  useEffect(() => {
    fetchGuestMenu().then((result) => {
      if (result.ok) setMenu(result.data);
    });
  }, []);

  useEffect(() => {
    if (category !== null || !menu) return;
    const first = Array.from(new Set(menu.map((m) => m.category))).sort()[0];
    if (first) setCategory(first);
  }, [menu, category]);

  async function handleAdd(item: MenuItem) {
    if (!bookingId) return;
    setActionError(null);
    setAddingId(item.id);
    const result = order
      ? await addRoomServiceOrderItems(order.id, [{ menuItemId: item.id, quantity: 1 }])
      : await submitRoomServiceOrder(bookingId, [{ menuItemId: item.id, quantity: 1 }]);
    setAddingId(null);

    if (result.ok) {
      setOrder(result.data);
      return;
    }
    if (result.status === 404) {
      setGateError("This room is no longer available for room service — you may have been checked out. Please contact the front desk.");
      return;
    }
    setActionError(result.error);
  }

  if (bookings.length === 0) {
    return (
      <div className="bg-ink2/40 border border-cream/10 rounded-xl p-6">
        <p className="text-cream/60 text-sm">Room service is available once you're checked in — ask the front desk if you've just arrived.</p>
      </div>
    );
  }

  if (!bookingId) {
    return (
      <div>
        <p className="eyebrow text-cream/50 mb-3">Which room?</p>
        <ul className="space-y-2">
          {bookings.map((booking) => (
            <li key={booking.id}>
              <button
                type="button"
                onClick={() => setBookingId(booking.id)}
                className="w-full text-left bg-ink2 border border-cream/10 rounded-xl px-4 py-3 hover:border-sea/40 transition-colors"
              >
                <p className="text-cream text-sm">{booking.roomLabel ? `Room ${booking.roomLabel}` : booking.roomName}</p>
                <p className="text-xs text-cream/50 mt-0.5">{booking.roomName}</p>
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (gateError) {
    return <p className="text-sm text-coral bg-coral/10 border border-coral/30 rounded-xl px-4 py-3">{gateError}</p>;
  }

  const categories = menu ? Array.from(new Set(menu.map((m) => m.category))).sort() : [];
  const visibleMenuItems = (menu ?? []).filter((m) => m.category === category);

  return (
    <div>
      {order && (
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <p className="eyebrow text-cream/50">Your order</p>
            <p className="text-xs text-cream/50">{STATUS_LABELS[order.status]}</p>
          </div>
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
            <p className="text-cream/70 text-sm">Total (added to your room folio)</p>
            <p className="font-display italic text-xl text-coral">฿{Number(order.total).toLocaleString("en-US")}</p>
          </div>
        </div>
      )}

      <p className="eyebrow text-cream/50 mb-3">{order ? "Add more" : "Menu"}</p>
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
            <p className="text-cream/50 text-xs mt-0.5">{addingId === item.id ? "Adding…" : `฿${Number(item.price).toLocaleString("en-US")}`}</p>
          </button>
        ))}
        {menu && visibleMenuItems.length === 0 && <p className="col-span-2 text-cream/50 text-sm py-2">No items in this category.</p>}
        {!menu && <p className="col-span-2 text-cream/50 text-sm py-2">Loading menu…</p>}
      </div>
    </div>
  );
}
