// Booking lookup for "charge to room" — same /bookings?from&to filter the admin's
// RoomChargeLink.tsx already uses (a genuine overlap test, see BookingService.java's
// buildSpecification: `checkOut > from AND checkIn <= to`, so a guest who checked in yesterday
// and is still staying is correctly included by from=to=today, not just same-day arrivals).
// Adds `guestName` (case-insensitive substring, backend query param) so a phone can search by
// typing instead of scrolling every currently-staying booking.
// Status eligibility (CONFIRMED/PAID only) is filtered client-side - see isChargeableBookingStatus.
import { posRequest, type PosResult } from "@/lib/pos/posFetch";
import { toDateKey } from "@/lib/bookings";
import { isChargeableBookingStatus } from "@/lib/pos/roomCharge";
import type { Booking } from "@/lib/types";

export async function searchActiveBookings(guestName: string): Promise<PosResult<Booking[]>> {
  const today = toDateKey(new Date());
  const params = new URLSearchParams({ from: today, to: today });
  if (guestName.trim()) params.set("guestName", guestName.trim());
  const result = await posRequest<Booking[]>(`/bookings?${params.toString()}`, undefined, "Could not search bookings.");
  if (!result.ok) return result;
  return { ...result, data: result.data.filter((b) => isChargeableBookingStatus(b.status)) };
}
