import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "@/lib/session";

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : null;
  const password = typeof body?.password === "string" ? body.password : null;
  if (!email || !password) {
    return NextResponse.json({ error: "Email and password are required" }, { status: 400 });
  }

  const backendRes = await fetch(`${BACKEND_URL}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
    cache: "no-store",
  });

  if (!backendRes.ok) {
    return NextResponse.json({ error: "Invalid email or password" }, { status: backendRes.status === 401 ? 401 : 502 });
  }

  const data = await backendRes.json().catch(() => null);
  const token = typeof data?.token === "string" ? data.token : null;
  if (!token) {
    return NextResponse.json({ error: "Unexpected response from auth server" }, { status: 502 });
  }

  // role is echoed back so the login page can pick a role-appropriate
  // landing page (a WAITER has no use for the dashboard's booking/occupancy
  // cards — see AdminSidebar's own role split) without a second round trip.
  const role = typeof data?.user?.role === "string" ? data.user.role : null;

  const res = NextResponse.json({ success: true, role });
  res.cookies.set(SESSION_COOKIE_NAME, token, sessionCookieOptions());
  return res;
}
