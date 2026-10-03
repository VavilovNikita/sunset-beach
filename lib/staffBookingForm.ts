import { parseDateKey } from "@/lib/bookings";
import { parsePartySize } from "@/lib/bookingPurpose";
import type { BookingChannel, Guest } from "@/lib/types";

// The new-booking form's own validation (BookingCreateFromGridModal). Deliberately not the
// browser's: `required`/`type="email"` make the browser show its own bubble in the browser's own
// language - a Russian "Заполните это поле." in an English admin - so the form is `noValidate` and
// every message comes from here, in English, next to the field it's about. Mirrors what
// StaffBookingCreateInput accepts (guestName 2-120, phone 5-40, checkIn < checkOut, channel and
// at least one adult required) so a mistake is caught before the request, not as a server 400.
// Pure, tested in staffBookingForm.test.ts.

export type StaffBookingFormFields = {
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: string;
  checkOut: string;
  channel: BookingChannel | "";
  adults: string;
  children: string;
};

export type StaffBookingFormField = keyof StaffBookingFormFields;
export type StaffBookingFormErrors = Partial<Record<StaffBookingFormField, string>>;

// Not a full RFC 5322 check - the server's @Email has the last word. This only catches the
// obvious typo (no @, no domain) before a round trip.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function staffBookingDatesValid(checkIn: string, checkOut: string): boolean {
  try {
    return parseDateKey(checkIn).getTime() < parseDateKey(checkOut).getTime();
  } catch {
    return false;
  }
}

export function validateStaffBookingForm(f: StaffBookingFormFields): StaffBookingFormErrors {
  const errors: StaffBookingFormErrors = {};
  const name = f.guestName.trim();
  if (name.length < 2) errors.guestName = "Enter the guest's name (at least 2 characters).";
  else if (name.length > 120) errors.guestName = "The guest's name can be at most 120 characters.";

  const email = f.guestEmail.trim();
  if (email && !EMAIL_RE.test(email)) errors.guestEmail = "Enter a valid email address, or leave it blank.";

  const phone = f.guestPhone.trim();
  if (phone && (phone.length < 5 || phone.length > 40)) errors.guestPhone = "Enter a phone number of 5 to 40 characters, or leave it blank.";

  let checkInOk = true;
  try {
    parseDateKey(f.checkIn);
  } catch {
    checkInOk = false;
    errors.checkIn = "Choose a check-in date.";
  }
  let checkOutOk = true;
  try {
    parseDateKey(f.checkOut);
  } catch {
    checkOutOk = false;
    errors.checkOut = "Choose a check-out date.";
  }
  if (checkInOk && checkOutOk && !staffBookingDatesValid(f.checkIn, f.checkOut)) {
    errors.checkOut = "Check-out must be after check-in.";
  }

  if (!f.channel) errors.channel = "Choose how this booking came in.";

  const party = parsePartySize(f.adults, f.children);
  if ("error" in party) {
    if (party.error.startsWith("Children")) errors.children = party.error;
    else errors.adults = party.error;
  }
  return errors;
}

// Picking an existing guest card fills the booking's own contact snapshot from it - so a booking
// made for a known guest carries their email from the start (and the status emails reach them),
// instead of an empty guestEmail next to a linked card that has one. Still editable afterwards.
export function prefillFromGuest(guest: Pick<Guest, "name" | "email" | "phone">): Pick<StaffBookingFormFields, "guestName" | "guestEmail" | "guestPhone"> {
  return { guestName: guest.name, guestEmail: guest.email ?? "", guestPhone: guest.phone ?? "" };
}
