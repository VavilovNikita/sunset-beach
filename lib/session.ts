import { BACKEND_URL } from "@/lib/backend";

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

export type SessionUser = {
  id: string;
  email: string;
  role: Role;
};

export const SESSION_COOKIE_NAME = "session-token";

// The VPS this app deploys to (thesunsetbeachsip.ddns.net:8888, see
// DEPLOY.md) serves plain HTTP — its ISP blocks inbound 80/443, so there is
// no TLS and no Let's Encrypt cert in this setup. A `secure` cookie is
// silently dropped by the browser over HTTP, which would break login there.
// `NODE_ENV` is "production" in that deployment too, so it can't be used to
// decide `secure` — this has to be its own explicit flag, opt-in only when
// the deployment actually terminates TLS in front of this app.
export const COOKIE_SECURE = process.env.COOKIE_SECURE === "true";

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
