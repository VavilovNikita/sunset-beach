import { addDaysUTC, dateOnlyUTC, toDateKey } from "@/lib/bookings";
import type { BookingStatus } from "@/lib/types";

// Pure logic of the Future bookings tab (/admin/reports?tab=future): which statuses and which arrival dates are asked
// for, and the address of the server's report and CSV. Nothing here adds anything up - every count and sum is the
// server's. Tested in futureBookings.test.ts.

// The statuses the report can show, in the order the server lists them. A cancelled booking is never in it.
export const FUTURE_STATUSES: readonly BookingStatus[] = ["NEW", "CONFIRMED", "PAID"];
export const FUTURE_DEFAULT_DAYS = 90;

// ?status= may arrive as a comma list ("NEW,CONFIRMED"), repeated, or both. Unknown values are dropped; none left (or
// nothing chosen) means all three - the form cannot end up with every status switched off.
export function parseFutureStatuses(raw: string | string[] | undefined): BookingStatus[] {
  const parts = (Array.isArray(raw) ? raw : raw ? [raw] : []).flatMap((p) => p.split(",")).map((p) => p.trim());
  const chosen = FUTURE_STATUSES.filter((s) => parts.includes(s));
  return chosen.length > 0 ? [...chosen] : [...FUTURE_STATUSES];
}

// What goes in the address: nothing when all three are on (the default), otherwise the comma list.
export function futureStatusesParam(selected: readonly BookingStatus[]): string | undefined {
  const chosen = FUTURE_STATUSES.filter((s) => selected.includes(s));
  return chosen.length === 0 || chosen.length === FUTURE_STATUSES.length ? undefined : chosen.join(",");
}

// Switching one status; the last one on cannot be switched off.
export function toggleFutureStatus(selected: readonly BookingStatus[], status: BookingStatus): BookingStatus[] {
  const next = selected.includes(status) ? selected.filter((s) => s !== status) : [...selected, status];
  return next.length === 0 ? [...selected] : FUTURE_STATUSES.filter((s) => next.includes(s));
}

// Arrival dates: today .. today + 90 days, the server's own default, shown in the form. today is the hotel day
// (hotelDateKey), passed in so this stays pure.
export function defaultFutureRange(today: string): { from: string; to: string } {
  return { from: today, to: toDateKey(addDaysUTC(dateOnlyUTC(today), FUTURE_DEFAULT_DAYS)) };
}

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

export function parseFutureRange(from: string | undefined, to: string | undefined, today: string): { from: string; to: string } {
  const fallback = defaultFutureRange(today);
  const f = from && DATE_KEY.test(from) ? from : fallback.from;
  // A missing "to" follows a chosen "from" by the default span, rather than ending before it started.
  const t = to && DATE_KEY.test(to) ? to : toDateKey(addDaysUTC(dateOnlyUTC(f), FUTURE_DEFAULT_DAYS));
  return { from: f, to: t };
}

export function isFutureRangeInverted(range: { from: string; to: string }): boolean {
  return range.from > range.to;
}

// The query of GET /reports/future-bookings and its /export (the same parameters). The status list is left out when
// all three are on.
export function futureQuery(range: { from: string; to: string }, statuses: readonly BookingStatus[]): string {
  const params = new URLSearchParams({ from: range.from, to: range.to });
  if (futureStatusesParam(statuses)) for (const s of FUTURE_STATUSES.filter((x) => statuses.includes(x))) params.append("status", s);
  return params.toString();
}
