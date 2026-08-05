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
