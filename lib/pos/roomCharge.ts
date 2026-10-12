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

// Which booking the "Charge to room" list has selected after it (re)loads. Whoever is picked here
// is the guest the order gets charged to, so the default matters:
//  - a pick the cashier already made stays, as long as it is still in the list;
//  - an order that already belongs to a guest (a spa ticket opened from the guest's appointment
//    names that booking) opens on that guest, not on whoever happens to be first in the list;
//  - if that guest is not in the list (not checked in) and nothing was typed, nothing is selected -
//    quietly falling back to the first row would charge a stranger;
//  - otherwise the first row, as a search-as-you-type list always did.
export function pickRoomChargeSelection(
  bookings: ReadonlyArray<{ id: string }>,
  previousId: string | null,
  preferredId: string | null | undefined,
  queryTyped: boolean
): string | null {
  if (previousId && bookings.some((b) => b.id === previousId)) return previousId;
  if (preferredId) {
    if (bookings.some((b) => b.id === preferredId)) return preferredId;
    if (!queryTyped) return null;
  }
  return bookings[0]?.id ?? null;
}
