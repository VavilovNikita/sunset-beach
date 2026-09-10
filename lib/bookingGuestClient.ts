// Shared client-side call for PUT /bookings/{id}/guest — links or clears which Guest a booking
// points to. Sibling to lib/bookingRoomUnitClient.ts, same one-function-per-endpoint convention:
// on the backend this is its own operation (BookingService#assignGuest), an ordinary transaction
// with no inventory contention, so relinking to a different guest needs no confirmation and no
// quote step — just apply and read back the result. Never touches guestName/guestEmail/
// guestPhone, which stay frozen regardless of what this does.
import { adminRequest } from "@/lib/adminFetch";
import type { Booking } from "@/lib/types";

export type GuestLinkResult = { ok: true; booking: Booking } | { ok: false; error: string };

export async function assignBookingGuest(bookingId: string, guestId: string | null): Promise<GuestLinkResult> {
  const result = await adminRequest<Booking>(
    `/bookings/${bookingId}/guest`,
    { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ guestId }) },
    "Could not update the linked guest."
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, booking: result.data };
}
