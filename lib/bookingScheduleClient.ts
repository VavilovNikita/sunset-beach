// Shared client-side calls for POST /bookings/{id}/schedule/quote and PATCH
// /bookings/{id}/schedule — used by both the booking calendar grid (drag/resize/move) and the
// booking detail page's schedule form (the non-mouse fallback for the same operation), so the
// two paths can't drift in how they build the request or read the response.
import { adminRequest } from "@/lib/adminFetch";
import type { Booking, BookingScheduleInput, BookingScheduleQuote } from "@/lib/types";

export type ScheduleQuoteResult = { ok: true; quote: BookingScheduleQuote } | { ok: false; error: string };
export type ScheduleApplyResult = { ok: true; booking: Booking } | { ok: false; error: string };

export async function quoteBookingSchedule(bookingId: string, input: BookingScheduleInput): Promise<ScheduleQuoteResult> {
  const result = await adminRequest<BookingScheduleQuote>(
    `/bookings/${bookingId}/schedule/quote`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
    "Could not price this change."
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, quote: result.data };
}

export async function applyBookingSchedule(bookingId: string, input: BookingScheduleInput): Promise<ScheduleApplyResult> {
  const result = await adminRequest<Booking>(
    `/bookings/${bookingId}/schedule`,
    { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
    "Could not apply this change."
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, booking: result.data };
}
