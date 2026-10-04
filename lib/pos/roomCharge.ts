import type { Booking } from "@/lib/types";

// A POS order can be charged to a booking's room while the guest is physically in the house -
// occupancyStatus CHECKED_IN - whatever the booking's status says. Status and occupancy are
// different axes: a walk-in is created NEW and stays NEW until someone remembers to confirm it,
// and filtering on status (CONFIRMED/PAID only) hid every such guest from the room list while they
// were sitting in the restaurant. PAID doesn't end chargeability either - it means the room was
// paid, not that the guest stopped running up a tab; the folio tracks what's owed.
//
// The one status that still excludes: CANCELLED. A cancelled booking whose occupancy was never
// cleared (checked in, then cancelled instead of checked out) is stale data, not a guest - and
// the backend refuses a room charge to a cancelled booking anyway (OrderService#close).
//
// Applied by bookingSearchClient.ts (the room-charge search on both POS surfaces) client-side,
// after the date-range fetch - GET /bookings has no occupancy filter.
export function isChargeableToRoom(booking: Pick<Booking, "status" | "occupancyStatus">): boolean {
  return booking.status !== "CANCELLED" && booking.occupancyStatus === "CHECKED_IN";
}
