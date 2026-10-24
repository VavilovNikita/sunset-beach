// What the public booking form may prefill from a logged-in guest's account. Only name and
// email: a guest account carries no phone number anywhere, so the phone field is always typed
// fresh. Deliberately narrower than GuestSessionAccount, so the page doesn't ship the account's
// id/verification timestamps into the client bundle just to fill two inputs.
export type BookingGuestPrefill = { name: string | null; email: string };

export function guestFormDefaults(account: BookingGuestPrefill | null | undefined): {
  guestName: string;
  guestEmail: string;
} {
  return {
    guestName: account?.name ?? "",
    guestEmail: account?.email ?? "",
  };
}

// The POST /public/bookings body. Guest details are read from the submitted form only — never
// from the account the form was prefilled from — so a logged-in guest booking for someone else
// sends whatever they typed over the prefill.
export function bookingRequestBody(roomId: string, checkIn: string, checkOut: string, formData: FormData) {
  return {
    roomId,
    checkIn,
    checkOut,
    guestName: formData.get("guestName"),
    guestEmail: formData.get("guestEmail"),
    guestPhone: formData.get("guestPhone"),
    // Required by the API (at least 1); the input itself is required, so it's never blank here.
    adults: Number(formData.get("adults")),
    // Optional on the API (defaults to 0) - a blank field sends 0 rather than NaN.
    children: Number(formData.get("children") || 0),
  };
}

// The party the room can take (Room.capacity; the server refuses a public booking over it). Adults start at 1; the
// children's limit is what is left of the capacity once the adults are counted, so the form never offers a
// party the server would turn down.
export const DEFAULT_ADULTS = 1;

export function clampAdults(value: number, capacity: number): number {
  const max = Math.max(1, capacity);
  if (!Number.isFinite(value)) return DEFAULT_ADULTS;
  return Math.min(max, Math.max(1, Math.trunc(value)));
}

export function maxChildren(capacity: number, adults: number): number {
  return Math.max(0, capacity - adults);
}

export function clampChildren(value: number, capacity: number, adults: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(maxChildren(capacity, adults), Math.max(0, Math.trunc(value)));
}
