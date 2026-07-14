import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withApiAuth } from "@/lib/rbac";
import { bookingStatusSchema } from "@/lib/validation";
import { sendGuestStatusEmail } from "@/lib/email";

export const PATCH = withApiAuth(async (req, { params }) => {
  const body = await req.json();
  const parsed = bookingStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const booking = await prisma.booking.update({
      where: { id: params.id },
      data: { status: parsed.data.status, paymentNote: parsed.data.paymentNote },
      include: { room: true },
    });

    await sendGuestStatusEmail(booking);

    return NextResponse.json(booking);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return NextResponse.json({ error: "Booking not found" }, { status: 404 });
    }
    throw e;
  }
});
