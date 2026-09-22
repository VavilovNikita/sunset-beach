import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";
import { GUEST_SESSION_COOKIE_NAME } from "@/lib/guestSession";

// Guest-account analogue of /api/admin-proxy - reads the httpOnly guest-session cookie
// server-side and forwards it as `Authorization: Bearer <token>` to sunset's /guest/** routes,
// since browser JS can't read that cookie to do this itself. GET-only: every /guest/** route this
// app currently calls through here (GET /guest/me, GET /guest/bookings) is a read; the one write
// (PATCH /guest/password) needs its own route to rewrite the httpOnly cookie with the fresh token
// the backend returns - see /api/guest-session/change-password's own comment for why that can't
// go through a generic pass-through proxy at all.
async function proxy(req: Request, path: string[]) {
  const store = await cookies();
  const token = store.get(GUEST_SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const incomingUrl = new URL(req.url);
  const target = `${BACKEND_URL}/guest/${path.join("/")}${incomingUrl.search}`;

  const res = await fetch(target, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const body = await res.arrayBuffer();
  return new NextResponse(body, {
    status: res.status,
    headers: { "Content-Type": res.headers.get("content-type") ?? "application/json" },
  });
}

type RouteContext = { params: { path: string[] } };

export async function GET(req: Request, { params }: RouteContext) {
  return proxy(req, params.path);
}
