"use client";

import { useEffect, useRef, useState } from "react";
import { searchActiveBookings } from "@/lib/pos/bookingSearchClient";
import { closeOrder } from "@/lib/pos/ordersClient";
import type { Order } from "@/lib/posTypes";
import type { Booking } from "@/lib/types";

const DEBOUNCE_MS = 300;

// Search-as-you-type instead of the admin's long <select> of every currently-staying booking
// (RoomChargeLink.tsx) - a phone can't reasonably scroll that list. Debounced so a fast typist
// doesn't fire a request per keystroke.
export default function PosRoomChargeSearch({
  orderId,
  actorEmail,
  actorRole,
  onClose,
  onSettled,
}: {
  orderId: string;
  // Whoever is currently logged in - shown once a booking is picked, right where Confirm is
  // tapped, so a swapped identity is caught before the charge is recorded, not after.
  actorEmail: string;
  actorRole: string;
  onClose: () => void;
  onSettled: (order: Order) => void;
}) {
  const [query, setQuery] = useState("");
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [searching, setSearching] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      const result = await searchActiveBookings(query);
      setSearching(false);
      if (!result.ok) {
        setSearchError(result.error);
        return;
      }
      setBookings(result.data);
      setSelectedId((prev) => (prev && result.data.some((b) => b.id === prev) ? prev : (result.data[0]?.id ?? null)));
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  async function handleConfirm() {
    if (!selectedId) return;
    setSubmitting(true);
    setSubmitError(null);
    const result = await closeOrder(orderId, { method: "ROOM_CHARGE", bookingId: selectedId });
    setSubmitting(false);
    if (!result.ok) {
      setSubmitError(result.error);
      return;
    }
    onSettled(result.data);
  }

  return (
    <div className="bg-ink2 border border-cream/10 rounded-2xl p-4 space-y-3">
      <p className="eyebrow text-cream/60">Charge to room</p>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Guest name…"
        autoFocus
        className="w-full bg-ink border border-cream/20 rounded-xl px-4 py-3 text-cream text-base placeholder:text-cream/30 focus:outline-none focus:border-coral"
      />

      {searchError && <p className="text-sm text-coral">{searchError}</p>}
      {!searchError && searching && <p className="text-sm text-cream/50">Searching…</p>}
      {!searchError && !searching && bookings.length === 0 && (
        <p className="text-sm text-cream/50">No currently-staying bookings match.</p>
      )}

      {!searching && bookings.length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {bookings.map((b) => (
            <button
              key={b.id}
              type="button"
              onClick={() => setSelectedId(b.id)}
              className={`w-full text-left rounded-xl border px-4 py-3 transition-colors ${
                selectedId === b.id ? "border-coral bg-coral/10" : "border-cream/15 active:bg-cream/5"
              }`}
            >
              <p className="text-cream text-sm">{b.guestName}</p>
              <p className="text-cream/50 text-xs">{b.room.name}</p>
            </button>
          ))}
        </div>
      )}

      {selectedId && (
        <div className="bg-ink border border-coral/30 rounded-xl px-4 py-3">
          <p className="eyebrow text-coral/80 mb-1">Will be recorded as</p>
          <p className="text-cream text-base font-medium break-words">{actorEmail}</p>
          <p className="text-xs text-cream/50">{actorRole}</p>
        </div>
      )}

      {submitError && <p className="text-sm text-coral">{submitError}</p>}

      <div className="flex gap-3">
        <button
          type="button"
          onClick={handleConfirm}
          disabled={!selectedId || submitting}
          className="flex-1 rounded-xl bg-coral active:bg-coraldeep transition-colors py-3 text-sm font-medium disabled:opacity-60"
        >
          {submitting ? "Charging…" : "Confirm"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl border border-cream/25 active:border-cream/50 transition-colors py-3 text-sm font-medium"
        >
          Back
        </button>
      </div>
    </div>
  );
}
