import type { FolioPaymentInput, FolioPaymentMethod } from "@/lib/posTypes";
import type { BookingStatus, OccupancyStatus } from "@/lib/types";

// Shared by the two booking edit forms (BookingStatusForm on the booking page, the calendar
// panel's StatusAndNoteEditor), so the cancel rule can't drift between them. Pure, tested in
// bookingStatusChange.test.ts.

// Cancelling releases the room and, for a PAID booking, reverses its ledger settlement - not
// something a stray dropdown change should do on Save. Moving *into* CANCELLED asks first, with a
// reason; saving an already-cancelled booking (a payment-note fix) doesn't.
export function needsCancellationConfirm(current: BookingStatus, next: BookingStatus): boolean {
  return next === "CANCELLED" && current !== "CANCELLED";
}

// A guest who has arrived is not cancelled: the server answers a change into CANCELLED for a
// CHECKED_IN or CHECKED_OUT booking with a 409, so the screens don't offer it (check the guest out,
// shortening the stay if they leave early, instead). A booking that is already CANCELLED is never
// moved out of it (409 too: its room may have been sold since) - the dropdown offers only its own
// status, and the way back is a new booking.
export const BOOKING_STATUSES: readonly BookingStatus[] = ["NEW", "CONFIRMED", "PAID", "CANCELLED"];

export function canCancelBooking(status: BookingStatus, occupancyStatus: OccupancyStatus): boolean {
  if (status === "CANCELLED") return false;
  return occupancyStatus !== "CHECKED_IN" && occupancyStatus !== "CHECKED_OUT";
}

export function selectableStatuses(status: BookingStatus, occupancyStatus: OccupancyStatus): BookingStatus[] {
  if (status === "CANCELLED") return ["CANCELLED"];
  return BOOKING_STATUSES.filter((s) => s !== "CANCELLED" || canCancelBooking(status, occupancyStatus));
}

// Why options are missing from the dropdown, shown next to it - or null when every one is offered.
export function statusOptionsNote(status: BookingStatus, occupancyStatus: OccupancyStatus): string | null {
  if (status === "CANCELLED") return "A cancelled booking can't be reinstated - its room may have been sold since. Create a new booking instead.";
  if (canCancelBooking(status, occupancyStatus)) return null;
  return occupancyStatus === "CHECKED_OUT"
    ? "This guest has checked out, so the booking can't be cancelled."
    : "This guest is checked in, so the booking can't be cancelled - check them out instead.";
}

// Marking a booking PAID never writes money off: whatever is still owed has to arrive with the
// request as a payment (BookingStatusInput.payment), so the change opens a payment dialog first.
// `amountDue` is the server's figure (Folio.amountToMarkPaid, or Booking.balanceDue before the
// folio has loaded) - nothing is worked out here. When nothing is owed the status just saves.
export function needsPaymentDialog(current: BookingStatus, next: BookingStatus, amountDue: string | null | undefined): boolean {
  return next === "PAID" && current !== "PAID" && Number(amountDue) > 0;
}

// The payment the dialog collects: a method has to be chosen (no default - the desk says how the
// money came in) and the amount must be a positive number. Whether it is exactly what is owed is
// the server's call; a different figure comes back as a 409 naming the right one.
export function validatePaidPayment(method: FolioPaymentMethod | "", amount: string): string | null {
  if (!method) return "Choose how the guest paid.";
  const value = Number(amount);
  if (amount.trim() === "" || !Number.isFinite(value) || value <= 0) return "Enter the amount collected.";
  return null;
}

export function paidPaymentInput(method: FolioPaymentMethod, amount: string): FolioPaymentInput {
  return { method, amount: amount.trim() };
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
