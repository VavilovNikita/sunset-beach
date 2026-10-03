import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";

// POST /guest-auth/forgot-password always answers with the same generic message (it never says
// whether the email has an account) - passed through as-is.
export async function POST(req: Request) {
  const body = await req.text();

  const backendRes = await fetch(`${BACKEND_URL}/guest-auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });

  const data = await backendRes.json().catch(() => null);
  return NextResponse.json(data ?? { error: "Could not send the reset email" }, { status: backendRes.status });
}
