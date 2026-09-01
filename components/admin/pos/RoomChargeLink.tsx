"use client";

import { useEffect, useState } from "react";
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import { toDateKey } from "@/lib/bookings";
import { isChargeableBookingStatus } from "@/lib/pos/roomCharge";
import type { Order } from "@/lib/posTypes";
import type { Booking } from "@/lib/types";

// Booking lookup for "charge to room" uses the existing /bookings?from&to
// filter (same one AdminBookingsPage uses) rather than inventing a new
// `activeOn` param. from=to=today is a genuine overlap test on the backend
// (BookingService.buildSpecification: `checkOut > from AND checkIn <= to`),
// so a guest who checked in before today and is still staying is correctly
// included, not just same-day arrivals - confirmed, not just assumed.
// Status eligibility (CONFIRMED/PAID only) is filtered client-side - see
// isChargeableBookingStatus for why.
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
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bookingId, setBookingId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const today = toDateKey(new Date());
    let cancelled = false;
    adminRequest<Booking[]>(`/bookings?from=${today}&to=${today}`, undefined, "Could not load bookings.").then((result) => {
      if (cancelled) return;
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      const chargeable = result.data.filter((b) => isChargeableBookingStatus(b.status));
      setBookings(chargeable);
      setBookingId(chargeable[0]?.id ?? "");
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Deliberately no "will be recorded as" confirm step before this money-affecting submit -
  // see OrderTicket.tsx's handleClose comment (this screen is reached from the same till-bound
  // context, not a handed-around phone).
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!bookingId) return;
    setSubmitting(true);
    setError(null);

    const result = await adminRequest<Order>(
      `/orders/${orderId}/close`,
      adminJsonInit("POST", { method: "ROOM_CHARGE", bookingId }),
      "Could not charge to room."
    );

    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSettled(result.data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-ink2/40 border border-cream/10 rounded-xl p-4">
      <p className="eyebrow text-cream/60">Charge to room</p>

      {loading ? (
        <p className="text-sm text-cream/50">Loading bookings…</p>
      ) : loadError ? (
        <p className="text-sm text-coral">{loadError}</p>
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
