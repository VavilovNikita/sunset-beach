import { cookies } from "next/headers";
import { BACKEND_URL, BackendError } from "@/lib/backend";

const SESSION_COOKIE_NAMES = ["__Secure-next-auth.session-token", "next-auth.session-token"];

// A server-side fetch() never forwards the visitor's browser cookies on its
// own — they have to be read out of this request's cookie jar and attached
// by hand for the Java side (NextAuthSessionAuthFilter) to see a session.
async function sessionCookieHeader() {
  const store = await cookies();
  for (const name of SESSION_COOKIE_NAMES) {
    const cookie = store.get(name);
    if (cookie) return `${cookie.name}=${cookie.value}`;
  }
  return null;
}

export async function backendFetch(
  path: string,
  init?: RequestInit & { auth?: boolean }
): Promise<Response> {
  const { auth = false, headers, ...rest } = init ?? {};
  const finalHeaders = new Headers(headers);

  if (auth) {
    const cookieHeader = await sessionCookieHeader();
    if (cookieHeader) finalHeaders.set("Cookie", cookieHeader);
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
