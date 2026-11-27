// A refused PATCH /bookings/{id}, put beside the field the server names. The form keeps everything typed: it used to
// reset every field to the saved values, so a refused payment note also threw away the breakfast entry. Pure, tested
// in bookingFormError.test.ts.
export const BOOKING_FORM_FIELDS = [
  "status",
  "channel",
  "purpose",
  "adults",
  "children",
  "breakfastGuests",
  "breakfastRate",
  "paymentNote",
] as const;

export type BookingFormField = (typeof BOOKING_FORM_FIELDS)[number];

const LABELS: Record<BookingFormField, string> = {
  status: "Status",
  channel: "Channel",
  purpose: "Purpose",
  adults: "Adults",
  children: "Children",
  breakfastGuests: "Breakfast guests",
  breakfastRate: "Breakfast rate",
  paymentNote: "Payment note",
};

export type BookingFormError = {
  field: BookingFormField | null; // null: a message about the save as a whole
  message: string;
  // The line beside Save, so a refusal is seen even when the field is scrolled away.
  summary: string;
};

export function bookingFormError(error: string, body: unknown): BookingFormError {
  const inner = body && typeof body === "object" && "error" in body ? (body as { error: unknown }).error : null;
  const fields = inner && typeof inner === "object" ? ((inner as { fieldErrors?: Record<string, string[]> }).fieldErrors ?? {}) : {};
  for (const field of BOOKING_FORM_FIELDS) {
    const message = fields[field]?.[0];
    if (message) return { field, message, summary: `Not saved - see ${LABELS[field]}. What you entered is still here.` };
  }
  return { field: null, message: error, summary: `Not saved: ${error}` };
}
