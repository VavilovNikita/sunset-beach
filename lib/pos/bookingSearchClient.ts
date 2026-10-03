// Booking lookup for "charge to room" (RoomChargeSearch.tsx, on both POS surfaces) — the
// /bookings?from&to filter (a genuine overlap test, see BookingService.java's
// buildSpecification: `checkOut > from AND checkIn <= to`, so a guest who checked in yesterday
// and is still staying is correctly included by from=to=today, not just same-day arrivals).
// Adds `guestName` (case-insensitive substring, backend query param) so staff can search by
// typing instead of scrolling every currently-staying booking. Includes a guest still checked in
// past checkOut (the backend's OverstayRule widens this filter). "Today" is the hotel's date.
// Status eligibility (CONFIRMED/PAID only) is filtered client-side - see isChargeableBookingStatus.
import { posRequest, type PosResult } from "@/lib/pos/posFetch";
import { hotelDateKey } from "@/lib/hotelDate";
import { isChargeableBookingStatus } from "@/lib/pos/roomCharge";
import type { Booking } from "@/lib/types";

export async function searchActiveBookings(guestName: string): Promise<PosResult<Booking[]>> {
  const today = hotelDateKey(new Date());
  const params = new URLSearchParams({ from: today, to: today });
  if (guestName.trim()) params.set("guestName", guestName.trim());
  const result = await posRequest<Booking[]>(`/bookings?${params.toString()}`, undefined, "Could not search bookings.");
  if (!result.ok) return result;
  return { ...result, data: result.data.filter((b) => isChargeableBookingStatus(b.status)) };
}
