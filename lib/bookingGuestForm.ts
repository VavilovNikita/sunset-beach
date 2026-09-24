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
  };
}
