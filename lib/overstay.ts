// Display side of the backend's OverstayRule: a guest still CHECKED_IN after their checkOut date
// is still in the house and still occupies their room tonight. The server decides who is overdue
// and by how many days (`overdueDays` on TodayBoardEntry / PropertyMapCurrentBooking / InHouseRow,
// `overstayUntil` on CalendarBooking) - this file only words it, so every screen says it the same
// way the night audit does ("N days overdue").
export function overdueLabel(overdueDays: number | null | undefined): string | null {
  if (!overdueDays || overdueDays <= 0) return null;
  return overdueDays === 1 ? "1 day overdue" : `${overdueDays} days overdue`;
}

// The booking page has a Booking, not one of the server-flagged rows above, so it asks the same
// question of the booking's own fields: still checked in, and checkOut before the hotel's today
// (hotelDateKey in lib/hotelDate.ts - Asia/Bangkok, never the browser's zone). Same rule as
// OverstayRule.overdueDays: the departure day itself is "due out", not overdue.
export function overdueDaysFor(
  booking: { occupancyStatus: string; status: string; checkOut: string },
  todayKey: string
): number {
  if (booking.occupancyStatus !== "CHECKED_IN" || booking.status === "CANCELLED") return 0;
  const checkOut = Date.parse(`${booking.checkOut}T00:00:00Z`);
  const today = Date.parse(`${todayKey}T00:00:00Z`);
  if (Number.isNaN(checkOut) || Number.isNaN(today) || checkOut >= today) return 0;
  return Math.round((today - checkOut) / 86_400_000);
}
