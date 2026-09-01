import type { Booking } from "@/lib/types";

// A POS order can be charged to a booking's room only while the booking still plausibly means
// "a guest is staying here and this is going on their tab": CONFIRMED, or PAID. PAID means the
// stay itself has been paid for (common for a resort taking prepayment) - it does NOT mean the
// guest has checked out or stopped owing anything; the folio on the booking page is what tracks
// amount actually due, independent of this status. NEW is an unconfirmed inquiry, not a guest
// who has arrived. CANCELLED obviously isn't staying either.
//
// Shared by RoomChargeLink.tsx (admin dropdown) and bookingSearchClient.ts (mobile name search)
// so the two can't drift apart. Applied client-side after a date-range-only fetch because the
// backend's GET /bookings `status` filter only accepts a single value - see either caller for
// why an unfiltered-by-status fetch plus this filter, rather than three separate requests.
const CHARGEABLE_STATUSES: ReadonlyArray<Booking["status"]> = ["CONFIRMED", "PAID"];

export function isChargeableBookingStatus(status: Booking["status"]): boolean {
  return CHARGEABLE_STATUSES.includes(status);
}
