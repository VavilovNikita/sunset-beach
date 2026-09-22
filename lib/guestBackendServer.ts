import { cookies } from "next/headers";
import { BACKEND_URL, BackendError } from "@/lib/backend";
import { GUEST_SESSION_COOKIE_NAME } from "@/lib/guestSession";

// Guest-account analogue of lib/backendServer.ts - kept as its own small file rather than
// parameterizing that one over a cookie name, matching this whole feature's "brand-new, fully
// separate identity system" boundary (see lib/guestSession.ts's own comment) all the way down to
// the server-side fetch helper.
async function authHeader() {
  const store = await cookies();
  const token = store.get(GUEST_SESSION_COOKIE_NAME)?.value;
  return token ? `Bearer ${token}` : null;
}

export async function guestBackendJson<T>(path: string): Promise<T> {
  const authorization = await authHeader();
  const headers = new Headers();
  if (authorization) headers.set("Authorization", authorization);

  const res = await fetch(`${BACKEND_URL}${path}`, { headers, cache: "no-store" });
  if (!res.ok) {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // no body
    }
    throw new BackendError(res.status, body);
  }
  return (await res.json()) as T;
}
