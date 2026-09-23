import { BACKEND_URL } from "@/lib/backend";

// Mirrors lib/session.ts's shape exactly, for a completely separate identity system — a
// GuestAccount is never a User (see the backend's GuestAccountAuth/GuestAccount tag
// descriptions). No next/headers import here on purpose, same reason as lib/session.ts: this
// module can be imported from middleware.ts (Edge runtime, reads cookies via NextRequest.cookies)
// as well as from Route Handlers / Server Components (which read the raw cookie themselves via
// next/headers' cookies() and GUEST_SESSION_COOKIE_NAME below).

export type GuestSessionAccount = {
  id: string;
  email: string;
  name: string | null;
  emailVerifiedAt: string | null;
  createdAt: string;
};

// The narrow shape GET /guest/bookings returns - deliberately not the staff Booking type (see
// that operation's own description): no paymentNote, source, guestId/guest, roomUnitId/roomUnit,
// or occupancy timestamps. occupancyStatus is the one occupancy field it does carry - a UI
// convenience so the frontend can offer room service only on a CHECKED_IN booking; the real gate
// is server-side on every /guest/orders write, re-checked on every call, never trusted from here.
export type GuestBooking = {
  id: string;
  roomName: string;
  roomLabel: string | null;
  checkIn: string;
  checkOut: string;
  totalPrice: string;
  status: "NEW" | "CONFIRMED" | "PAID" | "CANCELLED";
  occupancyStatus: "EXPECTED" | "CHECKED_IN" | "CHECKED_OUT" | "NO_SHOW";
  createdAt: string;
};

export const GUEST_SESSION_COOKIE_NAME = "guest-session-token";

// Same HTTPS-only production setup as lib/session.ts's COOKIE_SECURE (true in production) — see
// that file's own comment.
// Deliberately the same env flag, not a second one: both cookies are dropped by the same browser
// under the same deployment if it's wrong, so there's nothing for a separate flag to express.
const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";

export function guestSessionCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    secure: COOKIE_SECURE,
  };
}

/**
 * Single source of truth for "is this guest token still valid, and whose account is it" —
 * always asks the Java backend (GET /guest/me) rather than decoding the JWT locally, same
 * reasoning as lib/session.ts's getCurrentUser: sunset stays the only place that needs to know how
 * to verify its own tokens, and a guest account disabled/changed server-side takes effect on the
 * very next request instead of whenever this cookie happens to expire.
 */
export async function getCurrentGuestAccount(token: string | null): Promise<GuestSessionAccount | null> {
  if (!token) return null;

  const res = await fetch(`${BACKEND_URL}/guest/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;

  return (await res.json()) as GuestSessionAccount;
}
