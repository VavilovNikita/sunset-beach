import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/session";

// PATCH /auth/password bumps the caller's tokenVersion and returns a fresh token in the same
// response - going through the generic /api/admin-proxy would forward that response body to the
// browser untouched, leaving the httpOnly session cookie holding the now-invalid old token and
// signing the user out on their very next request. This route exists specifically to write that
// fresh token into the cookie, the same way /api/session/login does for a brand-new login.
export async function POST(req: Request) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.text();

  const backendRes = await fetch(`${BACKEND_URL}/auth/password`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });

  const data = await backendRes.json().catch(() => null);

  if (!backendRes.ok) {
    // Passed through as-is (ErrorMessage or ValidationError shape) so the client can use the
    // same extractApiError() every other admin form already uses.
    return NextResponse.json(data ?? { error: "Could not change password" }, { status: backendRes.status });
  }

  const newToken = typeof (data as { token?: unknown })?.token === "string" ? (data as { token: string }).token : null;
  if (!newToken) {
    return NextResponse.json({ error: "Unexpected response from auth server" }, { status: 502 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE_NAME, newToken, sessionCookieOptions());
  return res;
}
