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

/**
 * How many days from the bar's real check-in the pointer grabbed it. The bar on screen starts at the
 * grid's first column when the stay began before it (the calendar opens on today, so every guest in
 * the house is like that), so counting from the visible left edge alone is short by the clipped days -
 * and a drag that only meant to change the ROOM moved the stay later by exactly that many days (and
 * the drop was then answered with a clash or a "different room type" error instead of the room move).
 */
export function grabDayOffset(pointerX: number, barLeft: number, dayWidth: number, checkInKey: string, gridFromKey: string): number {
  const visible = Math.floor((pointerX - barLeft) / dayWidth);
  const clipped = checkInKey < gridFromKey ? Math.round((Date.parse(`${gridFromKey}T00:00:00Z`) - Date.parse(`${checkInKey}T00:00:00Z`)) / 86_400_000) : 0;
  return visible + clipped;
}

export type DropOutcome = "gone" | "swap-other-type" | "missed";

/**
 * The sentence shown next to the grid when a drop ends without a dialog. A drop always ends in one of
 * the two - a dialog to confirm, or one of these - never in nothing, so the desk can tell "refused" from
 * "the page ignored me".
 */
export function dropOutcomeMessage(kind: DropOutcome, guestName: string, otherGuestName?: string): string {
  switch (kind) {
    case "gone":
      return "That booking is no longer on the calendar - reload the page and try again.";
    case "swap-other-type":
      return `${guestName} and ${otherGuestName ?? "that guest"} are in different room types, so they can't swap rooms. Drop on a free night of a room to move ${guestName} there.`;
    case "missed":
      return `Nothing was changed: ${guestName} was dropped between rooms. Drop on another booking to swap rooms, or on a free night of a room to move there.`;
  }
}

export type OccupantBar = { bookingId: string; segmentId: string; roomId: string; roomUnitId: string | null; guestName: string; checkIn: string; checkOut: string };

/**
 * The booking that holds `roomUnitId` on the night `dateKey` (its departure day is free), other than the
 * one being dragged. This is how a drop on a booking of the same dates is recognised: once the dragged bar
 * enters the target row it is laid out beside the booking underneath (the two overlap, so each takes its own
 * lane), and what is under the pointer on screen is then a lane or a gap, not that booking - asking the
 * data instead of the pixels is what keeps "drop on a booking = swap" independent of the layout.
 */
export function findOccupant<T extends OccupantBar>(bookings: T[], roomUnitId: string, dateKey: string, excludeSegmentId: string): T | undefined {
  if (roomUnitId === "") return undefined;
  return bookings.find((b) => b.segmentId !== excludeSegmentId && b.roomUnitId === roomUnitId && b.checkIn <= dateKey && dateKey < b.checkOut);
}

/**
 * Whether a bar found under the pointer may decide the drop. The cell under the pointer says which room the release
 * is in; a bar of another room that happens to overlap the pointer on screen decides nothing. With no cell to compare
 * (the pointer is off the grid) the bar is taken as before.
 */
export function barAgreesWithCell(barRoomUnitId: string | undefined, cellRoomUnitId: string | undefined): boolean {
  if (barRoomUnitId === undefined) return false;
  if (cellRoomUnitId === undefined) return true;
  return barRoomUnitId === cellRoomUnitId;
}
