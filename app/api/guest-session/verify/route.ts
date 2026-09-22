import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";
import { GUEST_SESSION_COOKIE_NAME, guestSessionCookieOptions } from "@/lib/guestSession";

// POST /guest-auth/verify logs the guest in immediately on success (returns a working token, no
// separate login step) - this route writes that token into the httpOnly cookie the same way
// /api/guest-session/login does for an ordinary login.
export async function POST(req: Request) {
  const body = await req.text();

  const backendRes = await fetch(`${BACKEND_URL}/guest-auth/verify`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });

  const data = await backendRes.json().catch(() => null);

  if (!backendRes.ok) {
    return NextResponse.json(data ?? { error: "Invalid or expired verification token" }, { status: backendRes.status });
  }

  const token = typeof (data as { token?: unknown })?.token === "string" ? (data as { token: string }).token : null;
  if (!token) {
    return NextResponse.json({ error: "Unexpected response from auth server" }, { status: 502 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(GUEST_SESSION_COOKIE_NAME, token, guestSessionCookieOptions());
  return res;
}
