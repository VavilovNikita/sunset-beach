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

// The list as it is shown: the guest the order already belongs to goes first, so the row that is selected is on
// screen - the list is a short scrolling box ordered by arrival, and a guest who arrived today sat below its edge,
// looking unselected. `orderGuest` is that booking when the search did not return it (loaded on its own, and only if
// chargeable); it is added to the unfiltered list only, never to the results of a typed name it may not match.
export function roomChargeList<T extends { id: string }>(
  found: ReadonlyArray<T>,
  preferredId: string | null | undefined,
  orderGuest: T | null,
  query: string
): T[] {
  const own = found.find((b) => b.id === preferredId) ?? (query.trim() === "" && orderGuest?.id === preferredId ? orderGuest : null);
  return own ? [own, ...found.filter((b) => b.id !== own.id)] : [...found];
}

// Which booking the "Charge to room" list has selected after it (re)loads. Whoever is picked here
// is the guest the order gets charged to, and one Confirm charges them, so nobody is picked for the
// cashier:
//  - a pick the cashier already made stays, as long as it is still in the list;
//  - an order that already belongs to a guest (a spa ticket opened from the guest's appointment
//    names that booking) opens on that guest;
//  - otherwise nothing is selected until a row is tapped - not the first row, and not the only match
//    of a half-typed name either, which may well be a stranger.
export function pickRoomChargeSelection(
  bookings: ReadonlyArray<{ id: string }>,
  previousId: string | null,
  preferredId: string | null | undefined
): string | null {
  if (previousId && bookings.some((b) => b.id === previousId)) return previousId;
  if (preferredId && bookings.some((b) => b.id === preferredId)) return preferredId;
  return null;
}
