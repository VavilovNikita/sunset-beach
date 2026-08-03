// Single source of truth for the Java backend's base URL. Safe to import from
// both Server and Client Components — no next/headers here (see
// lib/backendServer.ts for the cookie-forwarding server-side fetch helper).

// Used for server-to-server calls (Server Components, generateMetadata). In
// Docker this may be an internal hostname (e.g. http://backend:8080/api)
// that's unreachable from the browser.
export const BACKEND_URL = process.env.BACKEND_API_URL ?? "http://localhost:8080/api";

// Used by Client Components and for any URL rendered into HTML (e.g. <img
// src>) — must always be reachable by the browser.
export const PUBLIC_BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_API_URL ?? BACKEND_URL;

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
