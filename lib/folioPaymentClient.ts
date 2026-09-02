// Shared client-side calls for GET/POST /bookings/{id}/folio-payments - mirrors
// lib/bookingRepriceClient.ts's exact pattern (same ok/error result shape, same adminRequest
// use). CASHIER+ on the backend for the POST; the GET is any authenticated staff session, same
// floor as GET /bookings/{id}/folio.
import { adminRequest } from "@/lib/adminFetch";
import type { FolioPayment, FolioPaymentInput } from "@/lib/posTypes";

export type FolioPaymentListResult = { ok: true; payments: FolioPayment[] } | { ok: false; error: string };
export type FolioPaymentRecordResult = { ok: true; payment: FolioPayment } | { ok: false; error: string };

export async function listFolioPayments(bookingId: string): Promise<FolioPaymentListResult> {
  const result = await adminRequest<FolioPayment[]>(
    `/bookings/${bookingId}/folio-payments`,
    undefined,
    "Could not load payments."
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, payments: result.data };
}

export async function recordFolioPayment(bookingId: string, input: FolioPaymentInput): Promise<FolioPaymentRecordResult> {
  const result = await adminRequest<FolioPayment>(
    `/bookings/${bookingId}/folio-payments`,
    { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input) },
    "Could not record this payment."
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, payment: result.data };
}
