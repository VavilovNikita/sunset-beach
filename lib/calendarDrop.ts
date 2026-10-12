// What a booking bar dropped on the calendar means, decided by the room it started in. Pure, so the
// rule that once offered a "101 -> 101" swap is tested instead of read off a drag handler.
//
// - Dropped on another booking in a DIFFERENT room: the two exchange rooms (a swap).
// - Dropped on a booking in the SAME room: not a swap (a room exchanged with itself changes
//   nothing, but used to be confirmed and written to the history as "Swapped rooms"). The drag is
//   a date shift: the nights under the pointer are the new dates, and if another booking holds
//   them the desk is told which one.

export type DropBar = { bookingId: string; roomUnitId: string };

/** True when `hoveredBar` is a booking this one can swap rooms with. */
export function isSwapPartner(hoveredBar: DropBar | null, draggedBookingId: string, originalRoomUnitId: string): boolean {
  if (!hoveredBar || originalRoomUnitId === "") return false;
  return hoveredBar.bookingId !== draggedBookingId && hoveredBar.roomUnitId !== originalRoomUnitId;
}

export type OccupyingBooking = { bookingId: string; roomUnitId: string | null; checkIn: string; checkOut: string };

/**
 * Another booking holding `roomUnitId` on any night of [checkIn, checkOut) - dates are
 * `YYYY-MM-DD`, so they compare as strings, and a departure day is free (back-to-back stays are
 * valid), hence the strict comparisons.
 */
export function findClash<T extends OccupyingBooking>(
  bookings: T[],
  movingBookingId: string,
  roomUnitId: string | null,
  checkIn: string,
  checkOut: string
): T | undefined {
  if (!roomUnitId) return undefined;
  return bookings.find((b) => b.bookingId !== movingBookingId && b.roomUnitId === roomUnitId && b.checkIn < checkOut && checkIn < b.checkOut);
}
