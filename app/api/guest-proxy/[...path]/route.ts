import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";
import { GUEST_SESSION_COOKIE_NAME } from "@/lib/guestSession";

// Guest-account analogue of /api/admin-proxy - reads the httpOnly guest-session cookie
// server-side and forwards it as `Authorization: Bearer <token>` to sunset's /guest/** routes,
// since browser JS can't read that cookie to do this itself. PATCH /guest/password is still the
// one exception that needs its own dedicated route rather than going through here - it rotates
// `tokenVersion` server-side, so the response has to rewrite the httpOnly cookie with the fresh
// token, something a generic pass-through can't do (see /api/guest-session/change-password's own
// comment). POST is otherwise a plain pass-through like GET: room-service ordering
// (POST /guest/orders, POST /guest/orders/{id}/items) never rotates the token, so there's nothing
// for this proxy to rewrite - the body is just forwarded through, same as the response.
async function proxy(req: Request, path: string[]) {
  const store = await cookies();
  const token = store.get(GUEST_SESSION_COOKIE_NAME)?.value;
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const incomingUrl = new URL(req.url);
  const target = `${BACKEND_URL}/guest/${path.join("/")}${incomingUrl.search}`;

  const headers = new Headers({ Authorization: `Bearer ${token}` });
  const hasBody = req.method !== "GET" && req.method !== "HEAD";
  if (hasBody) headers.set("Content-Type", req.headers.get("content-type") ?? "application/json");

  const res = await fetch(target, {
    method: req.method,
    headers,
    body: hasBody ? await req.text() : undefined,
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

export async function POST(req: Request, { params }: RouteContext) {
  return proxy(req, params.path);
}
