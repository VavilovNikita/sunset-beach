import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";
import { forwardedIpHeaders } from "@/lib/clientIp";

// Same-origin stand-in for sunset, used by *unauthenticated* Client Components (the guest
// booking form and its live price/availability re-quote) that used to fetch PUBLIC_BACKEND_URL
// directly. That worked at the network/CORS level but is blocked outright by this app's
// Content-Security-Policy (`connect-src 'self'`) — a real browser on the actual booking page
// never reached the backend at all, which is exactly the kind of gap a CSP is supposed to close
// and exactly why it went unnoticed until someone tested the form itself rather than a static
// page. Routing through here also means sunset no longer needs to be reachable from the browser
// at all — only this Next.js app does; see PUBLIC_BACKEND_URL's remaining callers (room photo
// <img> src) for the one thing that still assumes otherwise.
//
// Unlike admin-proxy, there is no session cookie here to gate access — anyone on the internet
// can call this route with any path/method. The allowlist below is the entire security boundary:
// it exists precisely because sunset's own SecurityConfig currently relies on this backend not
// being publicly reachable to keep everything else (bookings list, pricing writes, user
// management, ...) behind auth. A proxy that forwarded any path/method here would hand that
// protection straight back to the internet. Both method AND path are checked — a POST to an
// otherwise-GET-only path (or vice versa) is rejected, not just an unlisted path.
const ALLOWED: { method: string; matches: (path: string[]) => boolean }[] = [
  // GET /public/rooms, /public/rooms/{id}, /public/rooms/{id}/pricing, /public/rooms/{id}/availability,
  // /public/rooms/{id}/quote (the server-computed price of a stay - RoomBookingPanel's live total)
  { method: "GET", matches: (p) => p.length === 2 && p[0] === "public" && p[1] === "rooms" },
  { method: "GET", matches: (p) => p.length === 3 && p[0] === "public" && p[1] === "rooms" && p[2] !== "" },
  {
    method: "GET",
    matches: (p) =>
      p.length === 4 &&
      p[0] === "public" &&
      p[1] === "rooms" &&
      p[2] !== "" &&
      (p[3] === "pricing" || p[3] === "availability" || p[3] === "quote"),
  },
  // POST /bookings — the public guest-inquiry flow (BookingCreateInput), not /bookings/staff.
  { method: "POST", matches: (p) => p.length === 1 && p[0] === "bookings" },
  // GET /public/menu, GET /public/orders/{id}, POST /public/orders/{id}/items — dine-in QR
  // ordering (app/order/[orderId]/page.tsx). Gated entirely by the `?token=` query string these
  // requests carry (forwarded automatically via incomingUrl.search below, same as every other
  // rule here) — see the backend's OrderService#requireGuestAccess.
  { method: "GET", matches: (p) => p.length === 2 && p[0] === "public" && p[1] === "menu" },
  { method: "GET", matches: (p) => p.length === 3 && p[0] === "public" && p[1] === "orders" && p[2] !== "" },
  {
    method: "POST",
    matches: (p) => p.length === 4 && p[0] === "public" && p[1] === "orders" && p[2] !== "" && p[3] === "items",
  },
];

function isAllowed(method: string, path: string[]): boolean {
  return ALLOWED.some((rule) => rule.method === method && rule.matches(path));
}

async function proxy(req: Request, path: string[]) {
  if (!isAllowed(req.method, path)) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const incomingUrl = new URL(req.url);
  const target = `${BACKEND_URL}/${path.join("/")}${incomingUrl.search}`;

  // sunset rate limits the public quote and booking endpoints per visitor - see lib/clientIp.ts.
  const headers: Record<string, string> = forwardedIpHeaders(req.headers);

  const init: RequestInit = { method: req.method, cache: "no-store", headers };
  if (req.method === "POST") {
    headers["Content-Type"] = "application/json";
    init.body = await req.text();
  }

  const res = await fetch(target, init);
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
