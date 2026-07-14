import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withApiAuth } from "@/lib/rbac";
import { userRoleUpdateSchema } from "@/lib/validation";

export const PATCH = withApiAuth(
  async (req, { params }, sessionUser) => {
    if (params.id === sessionUser.id) {
      return NextResponse.json({ error: "You can't change your own role" }, { status: 400 });
    }

    const body = await req.json();
    const parsed = userRoleUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    try {
      const user = await prisma.user.update({
        where: { id: params.id },
        data: { role: parsed.data.role },
        select: { id: true, email: true, role: true, createdAt: true },
      });
      return NextResponse.json(user);
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
        return NextResponse.json({ error: "User not found" }, { status: 404 });
      }
      throw e;
    }
  },
  { role: "ADMIN" }
);
