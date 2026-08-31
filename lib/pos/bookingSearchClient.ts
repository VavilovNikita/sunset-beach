// Booking lookup for "charge to room" — same /bookings?from&to&status=CONFIRMED filter the
// admin's RoomChargeLink.tsx already uses (a genuine overlap test, see BookingService.java's
// buildSpecification: `checkOut > from AND checkIn <= to`, so a guest who checked in yesterday
// and is still staying is correctly included by from=to=today, not just same-day arrivals).
// Adds `guestName` (case-insensitive substring, new backend query param) so a phone can search
// by typing instead of scrolling every currently-staying booking in a `<select>`.
import { posRequest, type PosResult } from "@/lib/pos/posFetch";
import { toDateKey } from "@/lib/bookings";
import type { Booking } from "@/lib/types";

export function searchActiveBookings(guestName: string): Promise<PosResult<Booking[]>> {
  const today = toDateKey(new Date());
  const params = new URLSearchParams({ from: today, to: today, status: "CONFIRMED" });
  if (guestName.trim()) params.set("guestName", guestName.trim());
  return posRequest<Booking[]>(`/bookings?${params.toString()}`, undefined, "Could not search bookings.");
}
