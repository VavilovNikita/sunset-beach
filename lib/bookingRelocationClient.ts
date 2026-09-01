// Shared client-side calls for POST /bookings/{id}/relocate(/quote) and
// POST /bookings/{id}/undo-relocation — mirrors lib/bookingScheduleClient.ts's exact pattern
// (same ok/error result shape, same adminRequest use) so the calendar grid and the booking
// card panel read these the same way the schedule quote/apply calls already do.
import { adminRequest } from "@/lib/adminFetch";
import type { Booking, BookingScheduleQuote, RelocationInput, RelocationUndoInput } from "@/lib/types";

export type RelocationQuoteResult = { ok: true; quote: BookingScheduleQuote } | { ok: false; error: string };
export type RelocationApplyResult = { ok: true; booking: Booking } | { ok: false; error: string };

export async function quoteBookingRelocation(bookingId: string, input: RelocationInput): Promise<RelocationQuoteResult> {
  const result = await adminRequest<BookingScheduleQuote>(
    `/bookings/${bookingId}/relocate/quote`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
    "Could not price this relocation."
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, quote: result.data };
}

export async function applyBookingRelocation(bookingId: string, input: RelocationInput): Promise<RelocationApplyResult> {
  const result = await adminRequest<Booking>(
    `/bookings/${bookingId}/relocate`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
    "Could not relocate this booking."
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, booking: result.data };
}

export async function undoBookingRelocation(bookingId: string, input: RelocationUndoInput): Promise<RelocationApplyResult> {
  const result = await adminRequest<Booking>(
    `/bookings/${bookingId}/undo-relocation`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
    "Could not undo this relocation."
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, booking: result.data };
}
