import { cookies } from "next/headers";
import { BACKEND_URL, BackendError } from "@/lib/backend";
import { SESSION_COOKIE_NAME } from "@/lib/session";

// A server-side fetch() never forwards the visitor's browser cookies on its
// own — the session token has to be read out of this request's cookie jar
// and attached by hand, as a Bearer token, for Java's JWT filter to see it.
async function authHeader() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  return token ? `Bearer ${token}` : null;
}

export async function backendFetch(
  path: string,
  init?: RequestInit & { auth?: boolean }
): Promise<Response> {
  const { auth = false, headers, ...rest } = init ?? {};
  const finalHeaders = new Headers(headers);

  if (auth) {
    const authorization = await authHeader();
    if (authorization) finalHeaders.set("Authorization", authorization);
  }

  return fetch(`${BACKEND_URL}${path}`, { ...rest, headers: finalHeaders, cache: "no-store" });
}

async function parseErrorBody(res: Response) {
  try {
    return await res.json();
  } catch {
    return null;
  }
}

export async function backendJson<T>(path: string, init?: RequestInit & { auth?: boolean }): Promise<T> {
  const res = await backendFetch(path, init);
  if (!res.ok) {
    throw new BackendError(res.status, await parseErrorBody(res));
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

// For data a page can render without — a fetch that throws here would
// otherwise take down a whole Promise.all (and with it, an unrelated core
// screen) over something secondary. Same shape as adminStats.ts's
// getPosSummary, generalized because it's now needed at three call sites: a
// POS board's failed-print badge, and an order ticket's table label/add-item
// menu. `fallback` is returned as-is on any failure — network error, 401,
// 500, anything — the caller decides what "couldn't load this" should look
// like (empty list, `null` for "unknown" vs. "zero").
export async function backendJsonOrDefault<T>(
  path: string,
  fallback: T,
  init?: RequestInit & { auth?: boolean }
): Promise<T> {
  try {
    return await backendJson<T>(path, init);
  } catch {
    return fallback;
  }
}
