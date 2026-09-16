import { BACKEND_URL } from "@/lib/backend";
import type { StaffArea } from "@/lib/types";

// No `next/headers` import here on purpose — this module is also imported
// by middleware.ts, which runs on the Edge runtime and reads cookies via
// NextRequest.cookies, not next/headers. Route Handlers / Server Components
// that need the raw cookie value read it themselves with next/headers'
// `cookies()` and SESSION_COOKIE_NAME below.

// Mirrors the Java `Role` enum (see the old prisma/schema.prisma, now owned
// by the sunset (Java) repo). Update this if that enum ever changes shape.
// Hierarchical: ADMIN > MANAGER > CASHIER > WAITER (see lib/rbac.ts's
// hasRoleAtLeast) — CASHIER/WAITER were added for the POS module.
export type Role = "ADMIN" | "MANAGER" | "CASHIER" | "WAITER";

// A second, independent authorization axis alongside Role (see openapi.yaml's `JobFunction`) —
// a sideways job, not a step on the ADMIN > MANAGER > CASHIER > WAITER ladder. Not part of
// `hasRoleAtLeast`/the role hierarchy at all; a function grants nothing beyond the specific
// endpoints gated on it. Nothing gates on this yet (see lib/adminNav.ts if/when a nav link
// needs to check one — do not overload hasRoleAtLeast for that). THERAPIST marks a staff account
// as a bookable spa therapist (see lib/types.ts's SpaAppointment) — no endpoint is gated on it in
// v1, there is no therapist self-service screen (reception is the only spa surface).
export type JobFunction = "ENGINEER" | "HOUSEKEEPER" | "THERAPIST";

// Full shape of the backend's `User` schema — the same one GET /users
// returns (see lib/types.ts, which re-exports this as `User` rather than
// keeping its own copy). It used to be redeclared there without `createdAt`,
// a second copy of the same entity that had already drifted out of sync;
// nothing here currently reads `createdAt` off a session user, but there's
// no reason a session-scoped type should structurally lie about what the
// backend actually sends back.
//
// `email` is optional: this same type also stands in for every row GET
// /users returns (see lib/types.ts's re-export comment), which includes
// no-login accounts (see lib/types.ts's UserCreateInput) — an actual
// getCurrentUser() session always has one in practice (logging in requires
// it), but the shared type can't promise that for the admin-listing case
// without lying about what a GET /users row can be. `name` is required
// either way — see UserCreateInput's own comment for why it's the one
// identifier that's never absent.
export type SessionUser = {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  active: boolean;
  functions: JobFunction[];
  // A fact about the person, not derived from their shift code - see the backend's
  // User.overtimeEligible doc for why. Defaults true at creation; set per person via
  // PATCH /users/{id}/overtime-eligibility. Nothing in this app computes or accrues overtime
  // pay from this yet - it only records the fact.
  overtimeEligible: boolean;
  // The fingerprint terminal's own numeric PIN for this person, not this app's id - a device
  // punch is attributed by this number alone. Null for staff who never punch a terminal. Set or
  // cleared via PATCH /users/{id}/enrollment-number (ADMIN only, matching /users/** generally).
  enrollmentNumber: number | null;
  // What department this person belongs to - a fact about the person, not part of an
  // EmployeePattern (which also needs workDaysPerWeek/weeklyDayOff, neither of which one month of
  // attendance reliably establishes). Absent until set, at creation or via
  // PATCH /users/{id}/staff-area (ADMIN only, matching /users/** generally). The roster grid
  // groups by this field, so an account without one sits under "No area set".
  staffArea: StaffArea | null;
  createdAt: string;
};

export const SESSION_COOKIE_NAME = "session-token";

// The VPS this app deploys to (thesunsetbeachsip.ddns.net:8888, see
// DEPLOY.md) serves plain HTTP — its ISP blocks inbound 80/443, so there is
// no TLS and no Let's Encrypt cert in this setup. A `secure` cookie is
// silently dropped by the browser over HTTP, which would break login there.
// `NODE_ENV` is "production" in that deployment too, so it can't be used to
// decide `secure` — this has to be its own explicit flag, opt-in only when
// the deployment actually terminates TLS in front of this app.
const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";

export function sessionCookieOptions() {
  return {
    httpOnly: true as const,
    sameSite: "lax" as const,
    path: "/",
    secure: COOKIE_SECURE,
  };
}

// Single source of truth for "is this token still valid, and who is it
// for" — always asks the Java backend rather than decoding the JWT locally,
// so Java stays the only place that needs to know how to verify its own
// tokens (see lib/backendServer.ts for the same Bearer-token pattern used
// against protected resource endpoints).
export async function getCurrentUser(token: string | null): Promise<SessionUser | null> {
  if (!token) return null;

  const res = await fetch(`${BACKEND_URL}/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) return null;

  return (await res.json()) as SessionUser;
}
