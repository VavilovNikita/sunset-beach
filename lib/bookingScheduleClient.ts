// Shared client-side calls for POST /bookings/{id}/schedule/quote and PATCH
// /bookings/{id}/schedule — used by both the booking calendar grid (drag/resize/move) and the
// booking detail page's schedule form (the non-mouse fallback for the same operation), so the
// two paths can't drift in how they build the request or read the response.
import { ADMIN_API_URL } from "@/lib/backend";
import { extractApiError } from "@/lib/apiError";
import type { Booking, BookingScheduleInput, BookingScheduleQuote } from "@/lib/types";

export type ScheduleQuoteResult = { ok: true; quote: BookingScheduleQuote } | { ok: false; error: string };
export type ScheduleApplyResult = { ok: true; booking: Booking } | { ok: false; error: string };

export async function quoteBookingSchedule(bookingId: string, input: BookingScheduleInput): Promise<ScheduleQuoteResult> {
  const res = await fetch(`${ADMIN_API_URL}/bookings/${bookingId}/schedule/quote`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, error: extractApiError(data, "Could not price this change.") };
  return { ok: true, quote: data as BookingScheduleQuote };
}

export async function applyBookingSchedule(bookingId: string, input: BookingScheduleInput): Promise<ScheduleApplyResult> {
  const res = await fetch(`${ADMIN_API_URL}/bookings/${bookingId}/schedule`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await res.json().catch(() => null);
  if (!res.ok) return { ok: false, error: extractApiError(data, "Could not apply this change.") };
  return { ok: true, booking: data as Booking };
}
