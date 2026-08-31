"use client";

import { useEffect, useState } from "react";
import { ADMIN_API_URL } from "@/lib/backend";
import { extractApiError } from "@/lib/apiError";
import { toDateKey } from "@/lib/bookings";
import type { Order } from "@/lib/posTypes";
import type { Booking } from "@/lib/types";

// Booking lookup for "charge to room" uses the existing /bookings?from&to&status
// filter (same one AdminBookingsPage uses) rather than inventing a new
// `activeOn` param, per the agreed contract. Whether from/to means "checkIn
// falls in this range" or "range overlaps the stay" wasn't confirmed — if a
// guest checked in before today, today=from=to might not match. Flagged in
// the implementation summary; not something the frontend can fix alone.
export default function RoomChargeLink({
  orderId,
  onClose,
  onSettled,
}: {
  orderId: string;
  onClose: () => void;
  onSettled: (order: Order) => void;
}) {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookingId, setBookingId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const today = toDateKey(new Date());
    fetch(`${ADMIN_API_URL}/bookings?from=${today}&to=${today}&status=CONFIRMED`, { credentials: "include" })
      .then((res) => res.json())
      .then((data: Booking[]) => {
        setBookings(data);
        setBookingId(data[0]?.id ?? "");
      })
      .finally(() => setLoading(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bookingId) return;
    setSubmitting(true);
    setError(null);

    const res = await fetch(`${ADMIN_API_URL}/orders/${orderId}/close`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method: "ROOM_CHARGE", bookingId }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(extractApiError(data, "Could not charge to room."));
      return;
    }
    onSettled(await res.json());
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-ink2/40 border border-cream/10 rounded-xl p-4">
      <p className="eyebrow text-cream/60">Charge to room</p>

      {loading ? (
        <p className="text-sm text-cream/50">Loading bookings…</p>
      ) : bookings.length === 0 ? (
        <p className="text-sm text-cream/50">No checked-in bookings found for today.</p>
      ) : (
        <select
          value={bookingId}
          onChange={(e) => setBookingId(e.target.value)}
          className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
        >
          {bookings.map((b) => (
            <option key={b.id} value={b.id}>
              {b.guestName} — {b.room.name}
            </option>
          ))}
        </select>
      )}

      {error && <p className="text-sm text-coral">{error}</p>}

      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting || !bookingId}
          className="flex-1 rounded-full bg-coral hover:bg-coraldeep transition-colors py-2.5 text-sm font-medium disabled:opacity-60"
        >
          {submitting ? "Charging…" : "Confirm"}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-full border border-cream/25 hover:border-cream/50 transition-colors py-2.5 text-sm font-medium"
        >
          Back
        </button>
      </div>
    </form>
  );
}
