import { NextResponse } from "next/server";
import type { BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { withApiAuth } from "@/lib/rbac";
import { buildBookingsCsv, parseDateKey } from "@/lib/bookings";

export const GET = withApiAuth(async (req) => {
  const { searchParams } = req.nextUrl;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const status = searchParams.get("status");

  const where: Prisma.BookingWhereInput = {};
  if (status) where.status = status as BookingStatus;
  if (from) where.checkOut = { gt: parseDateKey(from) };
  if (to) where.checkIn = { lt: parseDateKey(to) };

  const bookings = await prisma.booking.findMany({
    where,
    include: { room: true },
    orderBy: { checkIn: "asc" },
  });

  const csv = buildBookingsCsv(bookings);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bookings.csv"`,
    },
  });
});
