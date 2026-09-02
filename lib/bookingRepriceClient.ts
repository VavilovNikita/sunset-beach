// Shared client-side calls for POST /bookings/{id}/reprice(/quote) - mirrors
// lib/bookingRelocationClient.ts's exact pattern (same ok/error result shape, same adminRequest
// use). MANAGER+ only on the backend: this deliberately overrides an already-agreed price rather
// than administering a guest's own request, so it sits above the CASHIER-level schedule/relocate
// operations those other clients call.
import { adminRequest } from "@/lib/adminFetch";
import type { Booking, RepriceInput, RepriceQuote } from "@/lib/types";

export type RepriceQuoteResult = { ok: true; quote: RepriceQuote } | { ok: false; error: string };
export type RepriceApplyResult = { ok: true; booking: Booking } | { ok: false; error: string };

export async function quoteBookingReprice(bookingId: string, input: RepriceInput): Promise<RepriceQuoteResult> {
  const result = await adminRequest<RepriceQuote>(
    `/bookings/${bookingId}/reprice/quote`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
    "Could not price this reprice."
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, quote: result.data };
}

export async function applyBookingReprice(bookingId: string, input: RepriceInput): Promise<RepriceApplyResult> {
  const result = await adminRequest<Booking>(
    `/bookings/${bookingId}/reprice`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
    "Could not reprice this booking."
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, booking: result.data };
}
