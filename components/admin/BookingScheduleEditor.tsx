"use client";

import { useEffect, useState } from "react";
import { dateOnlyUTC, toDateKey } from "@/lib/bookings";
import { quoteBookingSchedule, applyBookingSchedule } from "@/lib/bookingScheduleClient";
import { assignBookingRoomUnit } from "@/lib/bookingRoomUnitClient";
import type { Booking, BookingScheduleQuote, RoomUnit } from "@/lib/types";

// Shared by the booking calendar panel (BookingCardPanel.tsx) and the booking detail page
// (BookingScheduleForm.tsx) - previously each had its own hand-rolled date form, and only this
// one (built later, alongside relocation) knew that a relocated (multi-segment) booking can't
// freely move both dates at once. The detail page's form predated segments entirely and let you
// submit an ambiguous change, only rejected after the round trip - extracting this one, relocation-
// aware implementation for both surfaces to share means there's exactly one place that logic can
// live, not two that can drift again the way they did before.
//
// For a single segment, both ends are free to move together exactly as before segments existed.
// For a relocated booking, only one outer edge can move per change
// (BookingWriter#resolveScheduleTarget rejects both-at-once or neither as ambiguous - moving an
// inner boundary or an inner room is relocate/undo-relocate's job, not this form's): touching one
// date field disables the other rather than letting the mistake reach the server, and the label
// explains why. Room never appears here at all - see RoomUnitAssignmentEditor below, the operation
// actually built to reason about which room a segment is in; every quote/apply call re-sends
// whichever segment's own room-unit is already in effect, unchanged, so a date-only change can
// never silently move the guest too.
export function BookingScheduleEditor({ booking, onSaved }: { booking: Booking; onSaved: () => void }) {
  const segments = booking.segments;
  const multiSegment = segments.length > 1;
  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];

  // booking.checkIn/checkOut are already plain "YYYY-MM-DD" - still routed through
  // dateOnlyUTC()/toDateKey() rather than used as-is, on the same principle as every other date
  // field in this app: never trust a field's current shape without normalizing it, since that's
  // exactly the assumption that broke here before (this field used to carry a legacy
  // "T00:00:00.000Z" suffix).
  const bookingCheckInKey = toDateKey(dateOnlyUTC(booking.checkIn));
  const bookingCheckOutKey = toDateKey(dateOnlyUTC(booking.checkOut));

  const [checkIn, setCheckIn] = useState(bookingCheckInKey);
  const [checkOut, setCheckOut] = useState(bookingCheckOutKey);
  const [quote, setQuote] = useState<BookingScheduleQuote | null>(null);
  const [status, setStatus] = useState<"idle" | "quoting" | "ready" | "error" | "applying">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setCheckIn(bookingCheckInKey);
    setCheckOut(bookingCheckOutKey);
    setQuote(null);
    setStatus("idle");
  }, [bookingCheckInKey, bookingCheckOutKey]);

  const checkInChanged = checkIn !== bookingCheckInKey;
  const checkOutChanged = checkOut !== bookingCheckOutKey;
  // Whichever segment the moved edge belongs to owns the room-unit this request must re-send
  // unchanged - the first segment for an earlier/later arrival, the last for extending/
  // shortening the stay, and (single-segment) the only segment either way.
  const targetSegment = multiSegment ? (checkOutChanged ? lastSegment : firstSegment) : firstSegment;

  async function handleQuote() {
    setStatus("quoting");
    setError(null);
    const result = await quoteBookingSchedule(booking.id, { checkIn, checkOut, roomUnitId: targetSegment.roomUnitId ?? null });
    if (!result.ok) {
      setError(result.error);
      setStatus("error");
      return;
    }
    setQuote(result.quote);
    setStatus("ready");
  }

  async function handleApply() {
    setStatus("applying");
    const result = await applyBookingSchedule(booking.id, { checkIn, checkOut, roomUnitId: targetSegment.roomUnitId ?? null });
    if (!result.ok) {
      setError(result.error);
      setStatus("error");
      return;
    }
    onSaved();
  }

  return (
    <div className="bg-ink border border-cream/10 rounded-xl p-4 space-y-3">
      <p className="eyebrow text-cream/50">Dates</p>
      {multiSegment && (
        <p className="text-xs text-cream/40">
          This stay has been relocated - move the arrival date or the departure date, not both in the same
          change. Changing dates or rooms in the middle of the stay needs the booking calendar (relocate/undo).
        </p>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Check-in</label>
          <input
            type="date"
            value={checkIn}
            max={multiSegment ? firstSegment.checkOut : undefined}
            disabled={multiSegment && checkOutChanged}
            onChange={(e) => {
              setCheckIn(e.target.value);
              setStatus("idle");
            }}
            className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
          />
        </div>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Check-out</label>
          <input
            type="date"
            value={checkOut}
            min={multiSegment ? lastSegment.checkIn : undefined}
            disabled={multiSegment && checkInChanged}
            onChange={(e) => {
              setCheckOut(e.target.value);
              setStatus("idle");
            }}
            className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm disabled:opacity-50"
          />
        </div>
      </div>

      {/* A rejected quote has no real nights/total to show - quote.totalPrice/nights come back
          as 0 on that branch (see BookingWriter's ScheduleQuote), not omitted, so rendering them
          unconditionally next to the rejection reason would read as "the price became ฿0", not
          "no price was computed". Only the reason belongs on screen when available is false. */}
      {status === "ready" && quote && quote.available && (
        <div className="flex items-center justify-between bg-ink2 rounded-lg px-3 py-2">
          <span className="text-xs text-cream/60">
            {quote.nights} night{quote.nights === 1 ? "" : "s"}
          </span>
          <span className="font-display italic text-xl text-coral">฿{Number(quote.totalPrice).toLocaleString("en-US")}</span>
        </div>
      )}
      {status === "ready" && quote && !quote.available && <p className="text-xs text-coral">{quote.reason}</p>}
      {error && <p className="text-xs text-coral">{error}</p>}

      <div className="flex gap-2">
        {status === "ready" ? (
          <button
            type="button"
            onClick={handleApply}
            disabled={!quote?.available || status === ("applying" as typeof status)}
            className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-4 py-2 text-xs font-medium disabled:opacity-60"
          >
            Confirm change
          </button>
        ) : (
          <button
            type="button"
            onClick={handleQuote}
            disabled={(!checkInChanged && !checkOutChanged) || status === "quoting"}
            className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-4 py-2 text-xs font-medium disabled:opacity-40"
          >
            {status === "quoting" ? "Pricing…" : "Preview change"}
          </button>
        )}
      </div>
    </div>
  );
}

// Which physical room a single-segment booking uses, independent of its dates - the dedicated
// PUT /bookings/{id}/room-unit endpoint (BookingWriter#assignRoomUnit/unassignRoomUnit), not a
// side effect of BookingScheduleEditor above. Same room type, same dates, so there's never a
// price to preview - one save, not a quote-then-confirm pair. Only meant to be rendered for a
// single-segment booking: once a booking has been relocated there is no room-only, same-dates
// change the backend can resolve unambiguously (see BookingScheduleEditor's comment) - callers
// are responsible for that check, same as the callers already do for the "Rooms" section's
// relocate-only affordance.
export function RoomUnitAssignmentEditor({
  booking,
  roomUnits,
  onSaved,
}: {
  booking: Booking;
  roomUnits: RoomUnit[];
  onSaved: () => void;
}) {
  const segment = booking.segments[0];
  const currentUnitId = segment.roomUnitId ?? "";
  const [roomUnitId, setRoomUnitId] = useState(currentUnitId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setRoomUnitId(currentUnitId);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUnitId]);

  async function handleSave() {
    setBusy(true);
    setError(null);
    const result = await assignBookingRoomUnit(booking.id, roomUnitId || null);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  return (
    <div className="bg-ink border border-cream/10 rounded-xl p-4 space-y-2">
      <p className="eyebrow text-cream/50">Room unit</p>
      <div className="flex gap-2">
        <select
          value={roomUnitId}
          onChange={(e) => setRoomUnitId(e.target.value)}
          className="flex-1 bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
        >
          <option value="">Unassigned</option>
          {roomUnits.map((u) => (
            <option key={u.id} value={u.id}>
              {u.label}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleSave}
          disabled={roomUnitId === currentUnitId || busy}
          className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-4 py-2 text-xs font-medium disabled:opacity-60"
        >
          {busy ? "Saving…" : "Save"}
        </button>
      </div>
      {error && <p className="text-xs text-coral">{error}</p>}
    </div>
  );
}
