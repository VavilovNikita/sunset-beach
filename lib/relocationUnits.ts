// Which physical rooms the relocation form should show as taken for the nights being moved. The facts come from the
// server (GET /availability/{roomId}: per unit and day, blocked / booked / by whom); this only reads them. The server
// still decides on apply - a room that looked free a minute ago can be sold meanwhile.
import { addDaysUTC, dateOnlyUTC, toDateKey } from "@/lib/bookings";
import { formatDate } from "@/lib/formatDate";
import type { AvailabilityDay, BookingSegment } from "@/lib/types";

/** The nights a move from `effectiveDate` carries: to the end of the part of the stay that holds that date. */
export function movedRange(segments: Pick<BookingSegment, "checkIn" | "checkOut">[], effectiveDate: string): { from: string; toExclusive: string } {
  const holder = segments.find((s) => s.checkIn <= effectiveDate && effectiveDate < s.checkOut);
  const toExclusive = holder ? holder.checkOut : segments[segments.length - 1].checkOut;
  return { from: effectiveDate, toExclusive };
}

/** "YYYY-MM" keys of every month the range touches. */
export function monthsOfRange(from: string, toExclusive: string): string[] {
  const months: string[] = [];
  const shift = (key: string, days: number) => toDateKey(addDaysUTC(dateOnlyUTC(key), days));
  const last = toExclusive > from ? shift(toExclusive, -1) : from;
  for (let day = from; day <= last; day = shift(day, 1)) {
    const month = day.slice(0, 7);
    if (months[months.length - 1] !== month) months.push(month);
  }
  return months;
}

/**
 * Units that are not free on some night of the range, each with the reason for the first such night. A night held by
 * the booking itself is not a clash (its own nights in the room it is already in).
 */
export function busyUnits(days: AvailabilityDay[], from: string, toExclusive: string, ownBookingId: string): Map<string, string> {
  const busy = new Map<string, string>();
  for (const day of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    if (day.date < from || day.date >= toExclusive) continue;
    for (const unit of day.units) {
      if (busy.has(unit.roomUnitId)) continue;
      if (unit.isBooked && unit.bookingId !== ownBookingId) {
        const who = [unit.guestName, unit.waitingForRoom ? "waiting for a new room" : null].filter(Boolean).join(", ");
        busy.set(unit.roomUnitId, `booked ${formatDate(day.date)}${who ? ` (${who})` : ""}`);
      } else if (unit.isBlocked && !unit.isBooked) {
        busy.set(unit.roomUnitId, `out of service ${formatDate(day.date)}${unit.blockReason ? ` (${unit.blockReason})` : ""}`);
      }
    }
  }
  return busy;
}
