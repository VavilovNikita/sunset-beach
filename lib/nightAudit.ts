import { daysBetweenUTC, parseDateKey } from "@/lib/bookings";
import { formatTimestamp } from "@/lib/formatDate";

// Display helpers for the night-audit page. Pure, so they're tested in nightAudit.test.ts.

// The ?date= query param, or null for "let the server pick today". A malformed or impossible
// date (a hand-edited URL) is treated as absent rather than sent on to a 400.
export function parseNightAuditDateParam(param: string | undefined): string | null {
  if (!param) return null;
  try {
    parseDateKey(param);
    return param;
  } catch {
    return null;
  }
}

// How long a missed arrival/departure has been outstanding as of the reviewed date. dueDate is
// the booking's checkIn (arrival) or checkOut (departure); both are on or before reviewedDate by
// the server's own definition of the lists.
export function describeOverdue(dueDate: string, reviewedDate: string): string {
  const days = daysBetweenUTC(parseDateKey(dueDate), parseDateKey(reviewedDate));
  if (days <= 0) return "Due today";
  return days === 1 ? "1 day overdue" : `${days} days overdue`;
}

// closedAt is a UTC date-time, shown in hotel-local time (lib/formatDate.ts).
export function formatClosedAt(closedAt: string): string {
  return formatTimestamp(closedAt);
}
