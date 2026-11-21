// Staff notes on a booking (Booking.notes): airport pickup, allergies, special requests. Mirrors what the server
// accepts - at most 1000 characters after trimming, blank means none - so a mistake is caught before the request.
// Pure, tested in bookingNotes.test.ts.

export const NOTES_MAX_LENGTH = 1000;
export const NOTES_PLACEHOLDER = "Airport pickup, allergies, special requests…";

export function notesError(text: string): string | null {
  return text.trim().length > NOTES_MAX_LENGTH ? `Notes can be at most ${NOTES_MAX_LENGTH} characters.` : null;
}

// The create form sends notes only when there is something to send.
export function notesForCreate(text: string): string | undefined {
  const trimmed = text.trim();
  return trimmed ? trimmed : undefined;
}

// PATCH /bookings/{id} needs the status; sending the booking's own current one changes nothing about it. Empty text
// clears the notes (null) - "not sent" would leave them as they were.
export function notesPatchBody(status: string, text: string): { status: string; notes: string | null } {
  const trimmed = text.trim();
  return { status, notes: trimmed ? trimmed : null };
}

// "3 / 1000" counter text; the character count is of what would be saved.
export function notesCounter(text: string): string {
  return `${text.trim().length} / ${NOTES_MAX_LENGTH}`;
}
