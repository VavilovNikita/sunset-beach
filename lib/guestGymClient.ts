// Client for the guest's own gym booking (app/guest/gym/page.tsx) - through /api/guest-proxy (the
// httpOnly guest-session cookie, forwarded server-side as a Bearer token), like room service. The
// backend re-checks everything on every call: a guest needs a CHECKED_IN booking of their own
// account (403 otherwise), the slot must lie within the stay, and so on - what the screen hides is
// a convenience, never the gate.
import { guestProxyRequest, type GuestResult } from "@/lib/roomServiceOrderClient";
import type { GymGuestInfo, GymGuestReservation, GymSlotDay } from "@/lib/types";

export type { GuestResult };

const JSON_HEADERS = { "Content-Type": "application/json" };

export function fetchGymInfo(): Promise<GuestResult<GymGuestInfo>> {
  return guestProxyRequest<GymGuestInfo>("/gym/info", undefined, "Could not load the gym booking.");
}

export function fetchGymSlots(date: string, bookingId?: string): Promise<GuestResult<GymSlotDay>> {
  const params = new URLSearchParams({ date });
  if (bookingId) params.set("bookingId", bookingId);
  return guestProxyRequest<GymSlotDay>(`/gym/slots?${params.toString()}`, undefined, "Could not load the free times.");
}

export function fetchMyGymReservations(): Promise<GuestResult<GymGuestReservation[]>> {
  return guestProxyRequest<GymGuestReservation[]>("/gym/reservations", undefined, "Could not load your gym bookings.");
}

export function reserveGym(input: {
  bookingId?: string;
  date: string;
  startTime: string;
  durationMinutes: number;
}): Promise<GuestResult<GymGuestReservation>> {
  return guestProxyRequest<GymGuestReservation>(
    "/gym/reservations",
    { method: "POST", headers: JSON_HEADERS, body: JSON.stringify(input) },
    "Could not book the gym — try again."
  );
}

export function cancelMyGymReservation(id: string): Promise<GuestResult<GymGuestReservation>> {
  return guestProxyRequest<GymGuestReservation>(`/gym/reservations/${id}/cancel`, { method: "POST" }, "Could not cancel — try again.");
}
