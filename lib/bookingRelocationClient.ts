// Shared client-side calls for POST /bookings/{id}/relocate(/quote) and
// POST /bookings/{id}/undo-relocation — mirrors lib/bookingScheduleClient.ts's exact pattern
// (same ok/error result shape, same extractApiError use) so the calendar grid and the booking
// card panel read these the same way the schedule quote/apply calls already do.
import { ADMIN_API_URL } from "@/lib/backend";
import { extractApiError } from "@/lib/apiError";
import type { Booking, BookingScheduleQuote, RelocationInput, RelocationUndoInput } from "@/lib/types";

export type RelocationQuoteResult = { ok: true; quote: BookingScheduleQuote } | { ok: false; error: string };
export type RelocationApplyResult = { ok: true; booking: Booking } | { ok: false; error: string };

export async function quoteBookingRelocation(bookingId: string, input: RelocationInput): Promise<RelocationQuoteResult> {
  const res = await fetch(`${ADMIN_API_URL}/bookings/${bookingId}/relocate/quote`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, error: extractApiError(data, "Could not price this relocation.") };
  return { ok: true, quote: data as BookingScheduleQuote };
}

export async function applyBookingRelocation(bookingId: string, input: RelocationInput): Promise<RelocationApplyResult> {
  const res = await fetch(`${ADMIN_API_URL}/bookings/${bookingId}/relocate`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, error: extractApiError(data, "Could not relocate this booking.") };
  return { ok: true, booking: data as Booking };
}

export async function undoBookingRelocation(bookingId: string, input: RelocationUndoInput): Promise<RelocationApplyResult> {
  const res = await fetch(`${ADMIN_API_URL}/bookings/${bookingId}/undo-relocation`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, error: extractApiError(data, "Could not undo this relocation.") };
  return { ok: true, booking: data as Booking };
}
