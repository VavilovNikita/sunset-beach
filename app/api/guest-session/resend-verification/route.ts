import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";

export async function POST(req: Request) {
  const body = await req.text();

  const backendRes = await fetch(`${BACKEND_URL}/guest-auth/resend-verification`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    cache: "no-store",
  });

  const data = await backendRes.json().catch(() => null);
  return NextResponse.json(data ?? { error: "Could not resend verification email" }, { status: backendRes.status });
}
