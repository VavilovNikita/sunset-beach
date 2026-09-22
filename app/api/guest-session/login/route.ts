import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";
import { GUEST_SESSION_COOKIE_NAME, guestSessionCookieOptions } from "@/lib/guestSession";

export async function POST(req: Request) {
  const body = await req.text();

  const backendRes = await fetch(`${BACKEND_URL}/guest-auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });

  const data = await backendRes.json().catch(() => null);

  if (!backendRes.ok) {
    // Passed through as-is: 401 ("Invalid email or password") and 403 ("Please verify your
    // email...") are deliberately distinct messages/status codes (see the backend's own
    // description) - the login form branches on this status to offer a "resend verification"
    // action only for the 403 case, not for a wrong password.
    return NextResponse.json(data ?? { error: "Could not log in" }, { status: backendRes.status });
  }

  const token = typeof (data as { token?: unknown })?.token === "string" ? (data as { token: string }).token : null;
  if (!token) {
    return NextResponse.json({ error: "Unexpected response from auth server" }, { status: 502 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(GUEST_SESSION_COOKIE_NAME, token, guestSessionCookieOptions());
  return res;
}
