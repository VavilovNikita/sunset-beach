import { NextResponse } from "next/server";
import { GUEST_SESSION_COOKIE_NAME, guestSessionCookieOptions } from "@/lib/guestSession";

export async function POST() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(GUEST_SESSION_COOKIE_NAME, "", { ...guestSessionCookieOptions(), maxAge: 0 });
  return res;
}
