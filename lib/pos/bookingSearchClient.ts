// Booking lookup for "charge to room" (RoomChargeSearch.tsx, on both POS surfaces) — the
// /bookings?from&to filter (a genuine overlap test, see BookingService.java's
// buildSpecification: `checkOut > from AND checkIn <= to`, so a guest who checked in yesterday
// and is still staying is correctly included by from=to=today, not just same-day arrivals).
// Adds `guestName` (case-insensitive substring, backend query param) so staff can search by
// typing instead of scrolling every currently-staying booking. Includes a guest still checked in
// past checkOut (the backend's OverstayRule widens this filter). "Today" is the hotel's date.
// Eligibility (checked in, not cancelled) is filtered client-side - see isChargeableToRoom.
import { posRequest, type PosResult } from "@/lib/pos/posFetch";
import { addDaysToDateKey, hotelDateKey } from "@/lib/hotelDate";
import { isChargeableToRoom } from "@/lib/pos/roomCharge";
import type { Booking } from "@/lib/types";

export async function searchActiveBookings(guestName: string): Promise<PosResult<Booking[]>> {
  const today = hotelDateKey(new Date());
  // From yesterday: the filter is `checkOut > from`, so from today it left out a guest due out today who is still in
  // the house and still runs up a tab.
  const params = new URLSearchParams({ from: addDaysToDateKey(today, -1), to: today });
  if (guestName.trim()) params.set("guestName", guestName.trim());
  const result = await posRequest<Booking[]>(`/bookings?${params.toString()}`, undefined, "Could not search bookings.");
  if (!result.ok) return result;
  return { ...result, data: result.data.filter(isChargeableToRoom) };
}

// The order's own guest, read by id - null when they cannot be charged (or cannot be read: the list still works).
export async function chargeableBooking(bookingId: string): Promise<Booking | null> {
  const result = await posRequest<Booking>(`/bookings/${bookingId}`, undefined, "Could not load this booking.");
  return result.ok && isChargeableToRoom(result.data) ? result.data : null;
}
