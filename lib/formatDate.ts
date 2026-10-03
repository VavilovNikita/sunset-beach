import { parseDateKey } from "@/lib/bookings";

// The one display format for dates across the admin: "3 Oct 2026", and "3 Oct 2026, 14:05" for a
// moment in time. Day-month-year with a named month, so nobody has to guess whether 03.10 is
// March or October, whichever locale the browser is in.
//
// Two kinds of input, never mixed (see the backend's Dates section):
// - a stay/calendar date ("YYYY-MM-DD") has no time zone. It is parsed and printed in UTC, the
//   same way lib/bookings.ts does all date-only math, so it can never shift by a day.
// - a timestamp (createdAt, paidAt, an audit entry...) is an instant. It is printed in the hotel's
//   zone, Asia/Bangkok - never the browser's, and never left as UTC - so every viewer sees the
//   wall-clock time it happened at the hotel. Works for any offset the server sends (Z or +07:00).
//
// Pure, tested in formatDate.test.ts. Native <input type="date"> pickers are the one place this
// can't reach: the browser draws those in its own locale.

const HOTEL_TIME_ZONE = "Asia/Bangkok";

// Our own month labels rather than Intl's: en-GB writes September as "Sept", the only four-letter
// one, while the roster page and everything else here say "Sep".
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type Parts = { year: number; month: number; day: number; hour: string; minute: string };

function partsIn(date: Date, timeZone: string): Parts {
  const fields = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone,
  }).formatToParts(date);
  const get = (type: string) => fields.find((f) => f.type === type)?.value ?? "";
  return { year: Number(get("year")), month: Number(get("month")), day: Number(get("day")), hour: get("hour"), minute: get("minute") };
}

const dayMonth = (p: Parts) => `${p.day} ${MONTHS[p.month - 1]}`;
const dayMonthYear = (p: Parts) => `${dayMonth(p)} ${p.year}`;

function stayDateParts(key: string): Parts | null {
  try {
    return partsIn(parseDateKey(key.slice(0, 10)), "UTC");
  } catch {
    return null;
  }
}

function instantParts(iso: string): Parts | null {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : partsIn(date, HOTEL_TIME_ZONE);
}

export function formatDate(key: string): string {
  const p = stayDateParts(key);
  return p ? dayMonthYear(p) : key;
}

// "3 Oct → 5 Oct 2026" within one year, "28 Dec 2026 → 2 Jan 2027" across one.
export function formatDateRange(from: string, to: string): string {
  const a = stayDateParts(from);
  const b = stayDateParts(to);
  if (!a || !b) return `${formatDate(from)} → ${formatDate(to)}`;
  return a.year === b.year ? `${dayMonth(a)} → ${dayMonthYear(b)}` : `${dayMonthYear(a)} → ${dayMonthYear(b)}`;
}

export function formatTimestamp(iso: string): string {
  const p = instantParts(iso);
  return p ? `${dayMonthYear(p)}, ${p.hour}:${p.minute}` : iso;
}

// Just the hotel-local calendar day of an instant - "Booked on", "Joined".
export function formatTimestampDate(iso: string): string {
  const p = instantParts(iso);
  return p ? dayMonthYear(p) : iso;
}

// Just the hotel-local time of an instant - "14:05".
export function formatTimestampTime(iso: string): string {
  const p = instantParts(iso);
  return p ? `${p.hour}:${p.minute}` : iso;
}
