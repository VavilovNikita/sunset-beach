// The hotel's own calendar date (Asia/Bangkok), not the browser's or the Next server's ambient
// zone, and not UTC - `toDateKey(new Date())` (lib/bookings.ts) is the UTC date, which is still
// yesterday here until 07:00. Safe to import from client components (no server-only imports).
export function hotelDateKey(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now);
}

// The hotel's current year and month (1-12) - what "this month" means on a roster or report screen.
// `now.getFullYear()/getMonth()` are the browser's (or the Next server's) zone, which on a laptop in
// Moscow or a UTC container is a different month for the first hours of the 1st.
export function hotelYearMonth(now: Date): { year: number; month: number } {
  const [year, month] = hotelDateKey(now).split("-").map(Number);
  return { year, month };
}

// A hotel date key shifted by whole days, with no Date in the middle that could pick up a zone.
export function addDaysToDateKey(key: string, days: number): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
