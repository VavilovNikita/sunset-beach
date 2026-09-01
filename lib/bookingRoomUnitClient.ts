// Shared client-side call for PUT /bookings/{id}/room-unit — assigns or clears which physical
// room a single-segment booking's stay uses, without touching dates. Deliberately separate from
// lib/bookingScheduleClient.ts: on the backend this is its own endpoint (BookingWriter's
// assignRoomUnit/unassignRoomUnit, only legal while a booking has exactly one segment - see
// MULTI_SEGMENT_MESSAGE), not a variant of the schedule PATCH, and never changes price (same
// room type, same dates), so there's no quote step - just apply and read back the result.
import { adminRequest } from "@/lib/adminFetch";
import type { Booking } from "@/lib/types";

export type RoomUnitAssignResult = { ok: true; booking: Booking } | { ok: false; error: string };

export async function assignBookingRoomUnit(bookingId: string, roomUnitId: string | null): Promise<RoomUnitAssignResult> {
  const result = await adminRequest<Booking>(
    `/bookings/${bookingId}/room-unit`,
    { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roomUnitId }) },
    "Could not update the room unit."
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, booking: result.data };
}
