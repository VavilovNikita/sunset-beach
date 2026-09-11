// Shared client-side call for POST /bookings/{id}/folio-payments - mirrors
// lib/bookingRepriceClient.ts's exact pattern (same ok/error result shape, same adminRequest
// use). CASHIER+ on the backend. The GET side (listing payments) is fetched server-side directly
// via backendJson in the booking detail page, not through a client wrapper - see that page.
import { adminRequest } from "@/lib/adminFetch";
import type { FolioPayment, FolioPaymentInput } from "@/lib/posTypes";

export type FolioPaymentRecordResult = { ok: true; payment: FolioPayment } | { ok: false; error: string };

export async function recordFolioPayment(bookingId: string, input: FolioPaymentInput): Promise<FolioPaymentRecordResult> {
  const result = await adminRequest<FolioPayment>(
    `/bookings/${bookingId}/folio-payments`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
    "Could not record this payment."
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, payment: result.data };
}
