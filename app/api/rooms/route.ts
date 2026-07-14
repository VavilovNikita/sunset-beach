import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiAuth } from "@/lib/rbac";
import { roomSchema } from "@/lib/validation";

export const POST = withApiAuth(async (req) => {
  const body = await req.json();
  const parsed = roomSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const room = await prisma.room.create({ data: parsed.data });
  return NextResponse.json(room, { status: 201 });
});
