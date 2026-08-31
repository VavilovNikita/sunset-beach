// Pure date-math helpers shared by the public booking pages and the admin
// dashboard stats. Nothing here touches Prisma — room/booking/availability
// data itself now comes from the Java API (see lib/backend.ts,
// lib/backendServer.ts, lib/publicQuote.ts).

// All date-only math here is done with Date.UTC/getUTC*/setUTC* exclusively.
// This project never uses local-time Date parsing/iteration (e.g. date-fns'
// parseISO/eachDayOfInterval, which interpret date-only strings and iterate
// using local calendar days) because on any machine whose timezone isn't
// UTC+0 that silently shifts calendar dates by a day — the Java side's
// RatePlan/Availability are @db.Date columns and its day keys must line up
// with the exact UTC midnight instant, or a night resolves to the wrong day.

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

// Parses a "YYYY-MM-DD" key as a UTC midnight instant. Throws rather than
// returning an Invalid Date on anything malformed — a silent Invalid Date
// makes every later >=/< comparison against it resolve to `false`, which
// previously zeroed out revenueThisMonth/occupancyPct on the admin
// dashboard without so much as a console error. Loud failure here is
// strictly better than a quietly wrong money figure.
export function parseDateKey(key: string) {
  if (!DATE_KEY_RE.test(key)) {
    throw new Error(`parseDateKey: expected "YYYY-MM-DD", got ${JSON.stringify(key)}`);
  }
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  // Date.UTC silently rolls over out-of-range components (e.g. month 13,
  // day 45) into a different, shape-valid-looking date instead of failing —
  // catch that here too.
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) {
    throw new Error(`parseDateKey: "${key}" is not a valid calendar date`);
  }
  return date;
}

export function dateOnlyUTC(date: Date | string) {
  // Slicing to the first 10 chars is a no-op on an already-bare "YYYY-MM-DD" key (every date
  // field in this API, Booking.checkIn/checkOut included), so this one line works for any of
  // them without needing to know which shape it's holding — kept deliberately rather than
  // trimmed to a bare parseDateKey(date), since a future field regenerated with a stray
  // datetime suffix survives this function unnoticed instead of breaking it.
  if (typeof date === "string") return parseDateKey(date.slice(0, 10));
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDaysUTC(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// Whole days between two UTC midnight instants — positive when `to` is later. Exported (unlike
// most helpers in this file's original private form) because callers outside this file need it
// too: the calendar's Prev/Next/Today navigation shifts by exactly the currently-visible span,
// and its range picker needs the same count to enforce the backend's max-range limit before
// submitting.
export function daysBetweenUTC(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

// Nights of a stay: [checkIn, checkOut) — checkout day itself isn't a night.
export function getNights(checkIn: Date | string, checkOut: Date | string) {
  const start = dateOnlyUTC(checkIn);
  const end = dateOnlyUTC(checkOut);
  const nightCount = daysBetweenUTC(start, end);
  return Array.from({ length: Math.max(nightCount, 0) }, (_, i) => addDaysUTC(start, i));
}

export function startOfMonthUTC(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function endOfMonthUTC(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

export function addMonthsUTC(date: Date, months: number) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));
}
