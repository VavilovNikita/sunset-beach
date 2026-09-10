// Shared client-side calls for the segment-scoped room operations added alongside
// lib/bookingRoomUnitClient.ts's whole-booking PUT /bookings/{id}/room-unit: PUT
// /bookings/{id}/segments/{segmentId}/room-unit (the same assign-or-clear shape, addressed at a
// named segment instead of implicitly "the sole segment" - legal on any booking regardless of how
// many segments it has), and POST /bookings/{id}/segments/{segmentId}/swap-room-unit (the atomic
// two-booking room exchange the calendar's drag-one-bar-onto-another gesture needs - two
// sequential PUT .../room-unit calls can't do this, see that endpoint's own backend description).
// Neither reprices - both only ever move a *unit* within the same already-agreed room type.
import { adminRequest } from "@/lib/adminFetch";
import type { Booking } from "@/lib/types";

export type SegmentRoomUnitAssignResult = { ok: true; booking: Booking } | { ok: false; error: string };
export type SegmentSwapResult = { ok: true; booking: Booking } | { ok: false; error: string };

export async function assignBookingSegmentRoomUnit(
  bookingId: string,
  segmentId: string,
  roomUnitId: string | null
): Promise<SegmentRoomUnitAssignResult> {
  const result = await adminRequest<Booking>(
    `/bookings/${bookingId}/segments/${segmentId}/room-unit`,
    { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roomUnitId }) },
    "Could not update this segment's room."
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, booking: result.data };
}

// Returns only the dragged booking's own updated row, matching the endpoint's single-booking-
// nesting convention - the caller must router.refresh() (or otherwise refetch) to see the other
// booking's own side of the exchange, same as the endpoint's own description explains.
export async function swapBookingSegmentRoomUnit(
  bookingId: string,
  segmentId: string,
  withSegmentId: string
): Promise<SegmentSwapResult> {
  const result = await adminRequest<Booking>(
    `/bookings/${bookingId}/segments/${segmentId}/swap-room-unit`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ withSegmentId }) },
    "Could not swap these rooms."
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, booking: result.data };
}
