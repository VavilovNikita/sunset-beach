"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { dateOnlyUTC, toDateKey } from "@/lib/bookings";
import { quoteBookingSchedule, applyBookingSchedule } from "@/lib/bookingScheduleClient";
import type { Booking, BookingScheduleQuote, RoomUnit } from "@/lib/types";

// The booking calendar grid's drag/resize/move interactions are pointer-only - this form is the
// keyboard-and-screen-reader-reachable way to do the exact same thing (change dates and/or
// physical room together), on the booking detail page. Deliberately built on the same
// PATCH /bookings/{id}/schedule + POST /bookings/{id}/schedule/quote pair the grid uses (via
// lib/bookingScheduleClient.ts), rather than the older PUT /bookings/{id}/room-unit, so there is
// exactly one write path for "change this booking's schedule" and the price-preview-before-
// confirm rule applies here identically. Replaces BookingRoomUnitAssign on the detail page.
export default function BookingScheduleForm({
  booking,
  units,
  canEdit,
  canListUnits,
}: {
  booking: Booking;
  /** Active units of this booking's room type - empty whenever canListUnits is false. */
  units: RoomUnit[];
  /** PATCH /bookings/{id}/schedule is CASHIER+. */
  canEdit: boolean;
  /** GET /room-units (the only way to list candidates) is MANAGER+ - one tier above canEdit. */
  canListUnits: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [checkIn, setCheckIn] = useState(() => toDateKey(dateOnlyUTC(booking.checkIn)));
  const [checkOut, setCheckOut] = useState(() => toDateKey(dateOnlyUTC(booking.checkOut)));
  const [roomUnitId, setRoomUnitId] = useState(booking.roomUnitId ?? "");
  const [quote, setQuote] = useState<BookingScheduleQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setCheckIn(toDateKey(dateOnlyUTC(booking.checkIn)));
    setCheckOut(toDateKey(dateOnlyUTC(booking.checkOut)));
    setRoomUnitId(booking.roomUnitId ?? "");
    setQuote(null);
    setError(null);
    setEditing(true);
  }

  // Any field change invalidates a previous preview - never let a stale quote (and its "available:
  // true") be confirmed against a schedule the user has since edited further.
  function clearQuote() {
    setQuote(null);
    setError(null);
  }

  async function requestQuote() {
    if (!checkIn || !checkOut) {
      setError("Both dates are required.");
      return;
    }
    setQuoting(true);
    setError(null);
    const result = await quoteBookingSchedule(booking.id, { checkIn, checkOut, roomUnitId: roomUnitId || null });
    setQuoting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setQuote(result.quote);
  }

  async function confirmApply() {
    setApplying(true);
    setError(null);
    const result = await applyBookingSchedule(booking.id, { checkIn, checkOut, roomUnitId: roomUnitId || null });
    setApplying(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(false);
    setQuote(null);
    router.refresh();
  }

  return (
    <div className="bg-ink2/40 border border-cream/10 rounded-xl p-5">
      <div className="flex items-center justify-between gap-3 mb-2">
        <p className="eyebrow text-cream/60">Dates &amp; room</p>
        {canEdit && !editing && (
          <button
            type="button"
            onClick={startEditing}
            className="text-sm text-sea hover:text-coral transition-colors shrink-0"
          >
            Change
          </button>
        )}
      </div>

      {!editing ? (
        <div className="space-y-1 text-sm">
          <p className="text-cream">
            {toDateKey(dateOnlyUTC(booking.checkIn))} → {toDateKey(dateOnlyUTC(booking.checkOut))}
          </p>
          {booking.roomUnit ? (
            <p className="text-cream/70">
              Room <span className="font-display italic">{booking.roomUnit.label}</span>
            </p>
          ) : (
            <p className="text-amber-400">Not assigned yet</p>
          )}
          {!canEdit && <p className="text-xs text-cream/40 mt-2">Changing dates/room requires a cashier account or above.</p>}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="eyebrow text-cream/60 block mb-1">Check-in</label>
              <input
                type="date"
                value={checkIn}
                onChange={(e) => {
                  setCheckIn(e.target.value);
                  clearQuote();
                }}
                className="w-full bg-ink border border-cream/20 rounded-lg px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="eyebrow text-cream/60 block mb-1">Check-out</label>
              <input
                type="date"
                value={checkOut}
                onChange={(e) => {
                  setCheckOut(e.target.value);
                  clearQuote();
                }}
                className="w-full bg-ink border border-cream/20 rounded-lg px-3 py-2 text-sm"
              />
            </div>
          </div>

          {canListUnits ? (
            <div>
              <label className="eyebrow text-cream/60 block mb-1">Room</label>
              <select
                value={roomUnitId}
                onChange={(e) => {
                  setRoomUnitId(e.target.value);
                  clearQuote();
                }}
                className="w-full bg-ink border border-cream/20 rounded-lg px-3 py-2 text-sm"
              >
                <option value="">Not assigned</option>
                {units.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <p className="text-xs text-cream/40">
              Only managers can list rooms to switch to a different one - dates can still change, and this
              assignment can still be cleared.
            </p>
          )}

          {!quote ? (
            <button
              type="button"
              disabled={quoting}
              onClick={requestQuote}
              className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-5 py-2 text-sm font-medium disabled:opacity-60"
            >
              {quoting ? "Pricing…" : "Preview price"}
            </button>
          ) : (
            <div className="bg-ink/60 border border-cream/10 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-cream/60">
                  {quote.nights} night{quote.nights === 1 ? "" : "s"}
                </span>
                <span className="font-display italic text-2xl text-coral">
                  ฿{Number(quote.totalPrice).toLocaleString("en-US")}
                </span>
              </div>
              {!quote.available && <p className="text-sm text-coral">{quote.reason}</p>}
              <div className="flex gap-3 flex-wrap pt-1">
                <button
                  type="button"
                  disabled={!quote.available || applying}
                  onClick={confirmApply}
                  className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-60"
                >
                  {applying ? "Applying…" : "Confirm"}
                </button>
                <button type="button" onClick={clearQuote} className="text-sm text-cream/60 hover:text-cream transition-colors">
                  Back
                </button>
              </div>
            </div>
          )}

          {error && <p className="text-sm text-coral">{error}</p>}

          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setQuote(null);
              setError(null);
            }}
            className="text-sm text-cream/50 hover:text-cream transition-colors"
          >
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
