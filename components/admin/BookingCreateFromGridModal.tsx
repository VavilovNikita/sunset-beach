"use client";

import { useState } from "react";
import { ADMIN_API_URL } from "@/lib/backend";
import { extractApiError } from "@/lib/apiError";
import { getNights } from "@/lib/bookings";
import type { Booking, StaffBookingCreateInput } from "@/lib/types";

// Opened by dragging out a date range on a free row of the booking calendar grid. Creates and
// assigns the room in one atomic call (POST /bookings/staff) rather than the two-step
// POST /bookings + PUT /bookings/{id}/room-unit the public guest flow uses — see that
// endpoint's description for why: it would otherwise email every manager on every walk-in the
// front desk types in, require a guest email address a walk-in may not have, and leave a
// create-then-assign window where the booking exists with no room if the second call lost a race.
//
// No price preview before submitting: POST /bookings/staff has no dry-run mode (same as the
// public POST /bookings it mirrors), and this project's rule is never to show a client-computed
// price even as an estimate. The real total comes back in the response once the booking exists.
export default function BookingCreateFromGridModal({
  roomId,
  roomTypeName,
  roomUnitId,
  roomUnitLabel,
  checkIn,
  checkOut,
  onClose,
  onCreated,
}: {
  roomId: string;
  roomTypeName: string;
  roomUnitId: string;
  roomUnitLabel: string;
  checkIn: string;
  checkOut: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [guestPhone, setGuestPhone] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<Booking | null>(null);

  const nights = getNights(checkIn, checkOut).length;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!guestName.trim()) {
      setError("Guest name is required.");
      return;
    }
    setSaving(true);
    setError(null);

    const body: StaffBookingCreateInput = {
      roomId,
      guestName: guestName.trim(),
      guestEmail: guestEmail.trim() || null,
      guestPhone: guestPhone.trim() || null,
      checkIn,
      checkOut,
      roomUnitId,
    };

    const res = await fetch(`${ADMIN_API_URL}/bookings/staff`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => null);
    setSaving(false);

    if (!res.ok) {
      setError(extractApiError(data, "Could not create this booking."));
      return;
    }
    setCreated(data as Booking);
  }

  return (
    <div className="fixed inset-0 z-50 bg-ink/80 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-ink2 border border-cream/15 rounded-xl p-6 max-w-md w-full"
        onClick={(e) => e.stopPropagation()}
      >
        {created ? (
          <div className="space-y-4">
            <p className="eyebrow text-sea">Booking created</p>
            <p className="text-cream">
              {created.guestName} — {roomUnitLabel} ({roomTypeName})
            </p>
            <p className="text-sm text-cream/60">
              {checkIn} → {checkOut} ({nights} night{nights === 1 ? "" : "s"})
            </p>
            <p className="font-display italic text-3xl text-coral">
              ฿{Number(created.totalPrice).toLocaleString("en-US")}
            </p>
            <button
              type="button"
              onClick={onCreated}
              className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2.5 text-sm font-medium w-full"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div>
              <p className="eyebrow text-sea mb-1">New booking</p>
              <p className="text-cream">
                {roomTypeName} — {roomUnitLabel}
              </p>
              <p className="text-sm text-cream/60">
                {checkIn} → {checkOut} ({nights} night{nights === 1 ? "" : "s"})
              </p>
            </div>

            <div>
              <label className="eyebrow text-cream/60 block mb-1">Guest name</label>
              <input
                type="text"
                value={guestName}
                onChange={(e) => setGuestName(e.target.value)}
                autoFocus
                required
                className="w-full bg-ink border border-cream/20 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="eyebrow text-cream/60 block mb-1">Email (optional)</label>
              <input
                type="email"
                value={guestEmail}
                onChange={(e) => setGuestEmail(e.target.value)}
                placeholder="Walk-in — leave blank if none"
                className="w-full bg-ink border border-cream/20 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="eyebrow text-cream/60 block mb-1">Phone (optional)</label>
              <input
                type="tel"
                value={guestPhone}
                onChange={(e) => setGuestPhone(e.target.value)}
                className="w-full bg-ink border border-cream/20 rounded-lg px-3 py-2 text-sm"
              />
            </div>

            {error && <p className="text-sm text-coral">{error}</p>}

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2.5 text-sm font-medium disabled:opacity-60"
              >
                {saving ? "Creating…" : "Create booking"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-cream/60 hover:text-cream transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
