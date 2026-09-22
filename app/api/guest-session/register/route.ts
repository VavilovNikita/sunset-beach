import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";

// POST /guest-auth/register never returns a token (the account isn't usable until verified — see
// that operation's own description) - this route just relays the always-generic message and the
// validation-failure shape unchanged. No cookie to set, unlike /api/guest-session/login|verify.
export async function POST(req: Request) {
  const body = await req.text();

  const backendRes = await fetch(`${BACKEND_URL}/guest-auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });

  const data = await backendRes.json().catch(() => null);
  return NextResponse.json(data ?? { error: "Could not register" }, { status: backendRes.status });
}
