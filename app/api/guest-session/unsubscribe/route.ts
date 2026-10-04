import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";
import { forwardedIpHeaders } from "@/lib/clientIp";

// Forwards the unsubscribe link's token to GET /guest-auth/unsubscribe - no session needed (a
// guest clicking a link in an email must not have to sign in first), and no cookie is set or
// read. Only `token` is forwarded, never an arbitrary query string.
export async function GET(req: Request) {
  const token = new URL(req.url).searchParams.get("token") ?? "";

  let backendRes: Response;
  try {
    backendRes = await fetch(`${BACKEND_URL}/guest-auth/unsubscribe?${new URLSearchParams({ token })}`, { cache: "no-store", headers: forwardedIpHeaders(req.headers) });
  } catch {
    return NextResponse.json({ error: "We couldn't reach our server. Please try again in a moment." }, { status: 502 });
  }

  const data = await backendRes.json().catch(() => null);
  return NextResponse.json(data ?? { error: "Something went wrong. Please try again." }, { status: backendRes.status });
}
