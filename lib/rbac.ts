import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { NextResponse, type NextRequest } from "next/server";
import type { Role } from "@prisma/client";
import { authOptions } from "@/lib/auth";

export async function getSessionUser() {
  const session = await getServerSession(authOptions);
  return session?.user ?? null;
}

// For Server Components/pages — redirects rather than returning a response.
export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  return user;
}

export async function requireAdminUser() {
  const user = await requireSessionUser();
  if (user.role !== "ADMIN") redirect("/admin");
  return user;
}

// For Route Handlers — wraps a handler with a session (+ optional role) check.
type SessionUser = { id: string; email?: string | null; role: Role };
type Ctx = { params: Record<string, string> };
type AuthedHandler = (req: NextRequest, ctx: Ctx, user: SessionUser) => Promise<Response>;

export function withApiAuth(handler: AuthedHandler, opts?: { role?: Role }) {
  return async (req: NextRequest, ctx: Ctx) => {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (opts?.role && session.user.role !== opts.role) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    return handler(req, ctx, session.user);
  };
}
