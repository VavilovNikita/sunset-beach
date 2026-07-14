import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withApiAuth } from "@/lib/rbac";
import { roomSchema } from "@/lib/validation";

export const PATCH = withApiAuth(async (req, { params }) => {
  const body = await req.json();
  const parsed = roomSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const room = await prisma.room.update({ where: { id: params.id }, data: parsed.data });
    return NextResponse.json(room);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Room not found" }, { status: 404 });
    }
    throw e;
  }
});

export const DELETE = withApiAuth(async (_req, { params }) => {
  try {
    await prisma.room.delete({ where: { id: params.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError) {
      if (e.code === "P2025") {
        return NextResponse.json({ error: "Room not found" }, { status: 404 });
      }
      if (e.code === "P2003") {
        return NextResponse.json(
          { error: "This room has existing bookings and can't be deleted." },
          { status: 409 }
        );
      }
    }
    throw e;
  }
});
