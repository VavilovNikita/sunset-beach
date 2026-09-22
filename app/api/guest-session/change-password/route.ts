import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";
import { GUEST_SESSION_COOKIE_NAME, guestSessionCookieOptions } from "@/lib/guestSession";

// PATCH /guest/password bumps the caller's tokenVersion and returns a fresh token in the same
// response - same reason this can't just go through the generic /api/guest-proxy as
// /api/session/change-password's own comment gives for the staff equivalent: the generic proxy
// would forward that response body untouched, leaving the httpOnly cookie holding the now-invalid
// old token and signing the guest out on their very next request.
export async function POST(req: Request) {
  const store = await cookies();
  const token = store.get(GUEST_SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.text();

  const backendRes = await fetch(`${BACKEND_URL}/guest/password`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });

  const data = await backendRes.json().catch(() => null);

  if (!backendRes.ok) {
    return NextResponse.json(data ?? { error: "Could not change password" }, { status: backendRes.status });
  }

  const newToken = typeof (data as { token?: unknown })?.token === "string" ? (data as { token: string }).token : null;
  if (!newToken) {
    return NextResponse.json({ error: "Unexpected response from auth server" }, { status: 502 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(GUEST_SESSION_COOKIE_NAME, newToken, guestSessionCookieOptions());
  return res;
}
