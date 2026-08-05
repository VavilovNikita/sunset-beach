import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { BACKEND_URL } from "@/lib/backend";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/session";

export async function POST(req: Request) {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value ?? null;
  const caller = await getCurrentUser(token);
  if (!caller) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (caller.role !== "ADMIN") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : null;
  const password = typeof body?.password === "string" ? body.password : null;
  const role = typeof body?.role === "string" ? body.role : null;
  if (!email || !password || !role) {
    return NextResponse.json({ error: "email, password and role are required" }, { status: 400 });
  }

  const backendRes = await fetch(`${BACKEND_URL}/auth/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ email, password, role }),
    cache: "no-store",
  });

  const data = await backendRes.json().catch(() => null);
  if (!backendRes.ok) {
    return NextResponse.json(data ?? { error: "Registration failed" }, { status: backendRes.status });
  }
  return NextResponse.json(data ?? { success: true }, { status: backendRes.status });
}
