import type { BookingStatus } from "@/lib/types";

// Shared by the two booking edit forms (BookingStatusForm on the booking page, the calendar
// panel's StatusAndNoteEditor), so the cancel rule can't drift between them. Pure, tested in
// bookingStatusChange.test.ts.

// Cancelling releases the room and, for a PAID booking, reverses its ledger settlement - not
// something a stray dropdown change should do on Save. Moving *into* CANCELLED asks first, with a
// reason; saving an already-cancelled booking (a payment-note fix) doesn't.
export function needsCancellationConfirm(current: BookingStatus, next: BookingStatus): boolean {
  return next === "CANCELLED" && current !== "CANCELLED";
}

export const CANCELLATION_REASON_MAX = 500;

// The reason is required by the admin screens (the API keeps it optional for system paths - see
// BookingStatusInput.cancellationReason). Returns an English message, or null when it's fine.
export function validateCancellationReason(reason: string): string | null {
  const trimmed = reason.trim();
  if (trimmed.length < 3) return "Say why the booking is being cancelled.";
  if (trimmed.length > CANCELLATION_REASON_MAX) return `Keep the reason under ${CANCELLATION_REASON_MAX} characters.`;
  return null;
}
