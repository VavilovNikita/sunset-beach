// The hotel's own calendar date (Asia/Bangkok), not the browser's or the Next server's ambient
// zone, and not UTC - `toDateKey(new Date())` (lib/bookings.ts) is the UTC date, which is still
// yesterday here until 07:00. Safe to import from client components (no server-only imports).
export function hotelDateKey(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok" }).format(now);
}
