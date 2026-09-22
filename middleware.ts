import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/session";
import { getCurrentGuestAccount, GUEST_SESSION_COOKIE_NAME } from "@/lib/guestSession";

export async function middleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/guest/account") || req.nextUrl.pathname.startsWith("/guest/room-service")) {
    return guestMiddleware(req);
  }
  return staffMiddleware(req);
}

async function staffMiddleware(req: NextRequest) {
  if (req.nextUrl.pathname.startsWith("/admin/login")) {
    return NextResponse.next();
  }

  const token = req.cookies.get(SESSION_COOKIE_NAME)?.value ?? null;
  const user = await getCurrentUser(token);

  if (!user) {
    const loginUrl = new URL("/admin/login", req.url);
    loginUrl.searchParams.set("callbackUrl", req.nextUrl.pathname);
    const res = NextResponse.redirect(loginUrl);
    res.cookies.delete(SESSION_COOKIE_NAME);
    return res;
  }

  return NextResponse.next();
}

// Entirely separate identity system from staff (see lib/guestSession.ts) - its own cookie, its
// own backend check, its own redirect target. /guest/register|login|verify stay unmatched (see
// config.matcher below) since those must stay reachable with no session at all.
async function guestMiddleware(req: NextRequest) {
  const token = req.cookies.get(GUEST_SESSION_COOKIE_NAME)?.value ?? null;
  const account = await getCurrentGuestAccount(token);

  if (!account) {
    const res = NextResponse.redirect(new URL("/guest/login", req.url));
    res.cookies.delete(GUEST_SESSION_COOKIE_NAME);
    return res;
  }

  return NextResponse.next();
}

export const config = {
  // /pos is a separate root section (staff floor UI for WAITER/CASHIER, see app/pos/layout.tsx)
  // but shares this same auth check and the same /admin/login page — it has no login route of
  // its own, so an unauthenticated visit here also needs covering, or /pos would be reachable
  // with no session at all. /guest/account and /guest/room-service are the guest-facing routes
  // that need a session; /guest/register|login|verify are deliberately not listed, same
  // reasoning as /admin/login.
  matcher: ["/admin/:path*", "/pos/:path*", "/guest/account/:path*", "/guest/room-service/:path*"],
};
