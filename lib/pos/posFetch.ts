// Shared request helper for every lib/pos/*Client.ts file — the one place that decides how a
// failed request is reported, so no individual screen can accidentally leave a button stuck on
// "Sending…" after a dropped connection. This project has no offline mode (pretending an action
// saved without a network would be worse than an honest, visible failure), and a restaurant floor
// loses signal often enough that this has to be a designed-for case, not an edge case: a thrown
// fetch (no connectivity, DNS failure, timeout) gets its own message, distinct from a real
// non-2xx response from the server, and the caller always gets a settled result — never a promise
// that resolves after the UI has already given up.
import { ADMIN_API_URL } from "@/lib/backend";
import { extractApiError } from "@/lib/apiError";

// `status` rides along on both branches (not just the failure one) so a caller that needs to
// treat one particular status as a legitimate outcome - e.g. GET /shifts/current's 404 meaning
// "no open shift", not an error - can branch on the real HTTP status rather than pattern-match
// the error text, which would break the moment the backend's wording changed.
export type PosResult<T> = { ok: true; data: T; status: number } | { ok: false; error: string; status: number };

export async function posRequest<T>(path: string, init: RequestInit | undefined, fallbackError: string): Promise<PosResult<T>> {
  let res: Response;
  try {
    res = await fetch(`${ADMIN_API_URL}${path}`, { credentials: "include", ...init });
  } catch {
    return { ok: false, error: "No connection — check the network and try again.", status: 0 };
  }

  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // A 204 No Content (or any other body-less success) has nothing to parse - only treat this
    // as a real problem when the status itself says the request failed.
    if (!res.ok) return { ok: false, error: fallbackError, status: res.status };
  }

  if (!res.ok) return { ok: false, error: extractApiError(body, fallbackError), status: res.status };
  return { ok: true, data: body as T, status: res.status };
}

export function posJsonInit(method: string, body?: unknown): RequestInit {
  return {
    method,
    headers: body !== undefined ? { "Content-Type": "application/json" } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  };
}
