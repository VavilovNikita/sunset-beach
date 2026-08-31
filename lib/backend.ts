// Single source of truth for the Java backend's base URL. Safe to import from
// both Server and Client Components — no next/headers here (see
// lib/backendServer.ts for the cookie-forwarding server-side fetch helper).

// Used for server-to-server calls (Server Components, generateMetadata). In
// Docker this may be an internal hostname (e.g. http://backend:8080/api)
// that's unreachable from the browser.
export const BACKEND_URL = process.env.BACKEND_API_URL ?? "http://localhost:8080/api";

// Used for any URL rendered directly into HTML (e.g. <img src> for a
// staff-uploaded room photo — see resolveImageUrl below) — must be reachable
// by the browser. NOT for Client Component fetch()/XHR calls: this app's
// Content-Security-Policy (`connect-src 'self'`) blocks a script-initiated
// request to a cross-origin PUBLIC_BACKEND_URL outright, which is exactly
// what broke the guest booking form (see PUBLIC_PROXY_URL below, and
// app/api/public-proxy/[...path]/route.ts's comment for the full story).
// img-src is 'self' too, so this <img> case has the same CSP exposure —
// left as-is since only PUBLIC_PROXY_URL's callers were in scope for that
// fix, but it means sunset still needs to be browser-reachable for photos.
export const PUBLIC_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL ?? BACKEND_URL;

// Client Components that need to make an *authenticated* write/read against
// sunset (rooms, pricing, availability, bookings, users) go through this
// same-origin Next.js route instead of PUBLIC_BACKEND_URL directly — the
// session token lives in an httpOnly cookie client JS can't read, so it
// can't attach `Authorization: Bearer <token>` itself. See
// app/api/admin-proxy/[...path]/route.ts, which reads the cookie
// server-side and forwards the Bearer token to sunset.
export const ADMIN_API_URL = "/api/admin-proxy";

// Unauthenticated Client Components (the public booking form's price
// re-quote and its final submit) go through this same-origin route instead
// of PUBLIC_BACKEND_URL directly, for the CSP reason above. Unlike
// ADMIN_API_URL there's no session cookie to check, so the route itself
// only forwards an explicit allowlist of (method, path) pairs — see its
// comment for why that allowlist is the actual security boundary here.
export const PUBLIC_PROXY_URL = "/api/public-proxy";

export class BackendError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, body: unknown) {
    super(
      body && typeof body === "object" && "error" in body && typeof (body as { error: unknown }).error === "string"
        ? (body as { error: string }).error
        : `Backend request failed with ${status}`
    );
    this.status = status;
    this.body = body;
  }
}

// Room.images mixes two kinds of paths: statically-bundled seed photos
// (`/images/rooms/...`, served by this Next.js app's own /public folder) and
// staff-uploaded photos (`/uploads/rooms/{id}/...`, served by the Java app).
// Only the latter needs to be pointed at the backend origin. `path` is
// undefined whenever a room has no images yet (Room.images: []).
export function resolveImageUrl(path: string | undefined) {
  if (!path) return path;
  return path.startsWith("/uploads/") ? `${PUBLIC_BACKEND_URL}${path}` : path;
}
