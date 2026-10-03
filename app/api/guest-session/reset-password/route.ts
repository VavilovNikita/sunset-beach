import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";
import { GUEST_SESSION_COOKIE_NAME, guestSessionCookieOptions } from "@/lib/guestSession";

// POST /guest-auth/reset-password signs the guest in on success (it returns a fresh token, every
// older one is revoked) - written into the httpOnly cookie the same way /api/guest-session/verify does.
export async function POST(req: Request) {
  const body = await req.text();

  const backendRes = await fetch(`${BACKEND_URL}/guest-auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });

  const data = await backendRes.json().catch(() => null);

  if (!backendRes.ok) {
    return NextResponse.json(data ?? { error: "This reset link is invalid or has expired." }, { status: backendRes.status });
  }

  const token = typeof (data as { token?: unknown })?.token === "string" ? (data as { token: string }).token : null;
  if (!token) {
    return NextResponse.json({ error: "Unexpected response from auth server" }, { status: 502 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(GUEST_SESSION_COOKIE_NAME, token, guestSessionCookieOptions());
  return res;
}
