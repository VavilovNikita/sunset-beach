import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/session";

export async function middleware(req: NextRequest) {
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

export const config = {
  // /pos is a separate root section (staff floor UI for WAITER/CASHIER, see app/pos/layout.tsx)
  // but shares this same auth check and the same /admin/login page — it has no login route of
  // its own, so an unauthenticated visit here also needs covering, or /pos would be reachable
  // with no session at all.
  matcher: ["/admin/:path*", "/pos/:path*"],
};
