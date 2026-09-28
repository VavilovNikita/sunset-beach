import { daysBetweenUTC, parseDateKey } from "@/lib/bookings";

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

// closedAt is a UTC date-time. Formatted explicitly in Asia/Bangkok, never the browser's zone,
// so every viewer sees the same hotel-local time.
export function formatClosedAt(closedAt: string): string {
  const date = new Date(closedAt);
  if (Number.isNaN(date.getTime())) return closedAt;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}
