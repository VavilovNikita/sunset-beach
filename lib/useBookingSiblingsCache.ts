"use client";

import { useRef, useState } from "react";
import { adminRequest } from "@/lib/adminFetch";
import type { Booking, CalendarBooking } from "@/lib/types";

// Lazily fills in a relocated booking's full segment list when the calendar's own visible date
// window doesn't already contain every one of its siblings - see resolveEdgeDragTarget's own
// comment (lib/calendarLayout.ts) for the full safety argument this cache leans on: a stale or
// still-missing entry can only ever produce a stale RENDERING decision (an edge-drag handle shown
// or withheld a beat late), never a wrong WRITE - the schedule change the handle leads to always
// re-reads every segment fresh on the server (BookingWriter#updateSchedule, inside its own
// SERIALIZABLE transaction) regardless of what the client believed when the drag started. That is
// exactly why this is safe to populate lazily and never invalidate: at worst a handle appears one
// render late, or a request that a fresher cache would have offered gets a 409 instead - never a
// write applied against the wrong segment.
export function useBookingSiblingsCache() {
  const [cache, setCache] = useState<Map<string, CalendarBooking[]>>(new Map());
  const inFlight = useRef<Set<string>>(new Set());

  // One GET /bookings/{id} per booking at most for the life of this grid instance - a no-op if
  // already cached or already in flight, so callers can call this freely (e.g. from an effect
  // that reconciles every currently-visible booking) without worrying about duplicate requests.
  function ensure(bookingId: string) {
    if (cache.has(bookingId) || inFlight.current.has(bookingId)) return;
    inFlight.current.add(bookingId);
    adminRequest<Booking>(`/bookings/${bookingId}`, undefined, "Could not load this booking's segments.").then((result) => {
      inFlight.current.delete(bookingId);
      if (!result.ok) return;
      const booking = result.data;
      const siblings: CalendarBooking[] = booking.segments.map((s) => ({
        segmentId: s.id,
        bookingId: booking.id,
        roomId: s.roomId,
        roomUnitId: s.roomUnitId,
        guestName: booking.guestName,
        checkIn: s.checkIn,
        checkOut: s.checkOut,
        status: booking.status,
        totalPrice: s.totalPrice,
        segmentCount: booking.segments.length,
      }));
      setCache((prev) => {
        const next = new Map(prev);
        next.set(bookingId, siblings);
        return next;
      });
    });
  }

  return { cache, ensure };
}
