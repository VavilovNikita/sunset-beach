import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiAuth } from "@/lib/rbac";
import { availabilityRangeSchema } from "@/lib/validation";
import { eachDateInRange, toDateKey, startOfMonthUTC, endOfMonthUTC, MAX_RANGE_DAYS } from "@/lib/bookings";

export const GET = withApiAuth(async (req, { params }) => {
  const room = await prisma.room.findUnique({ where: { id: params.roomId } });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const monthParam = req.nextUrl.searchParams.get("month"); // "YYYY-MM"
  const [y, m] = (monthParam ?? toDateKey(new Date()).slice(0, 7)).split("-").map(Number);
  const monthStart = startOfMonthUTC(new Date(Date.UTC(y, m - 1, 1)));
  const monthEnd = endOfMonthUTC(monthStart);

  const [manualBlocks, bookings] = await Promise.all([
    prisma.availability.findMany({
      where: { roomId: room.id, date: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.booking.findMany({
      where: {
        roomId: room.id,
        status: { not: "CANCELLED" },
        checkIn: { lte: monthEnd },
        checkOut: { gt: monthStart },
      },
      select: { checkIn: true, checkOut: true },
    }),
  ]);

  const manualByDate = new Map(manualBlocks.map((a) => [toDateKey(a.date), a.isBlocked]));

  const bookedDates = new Set<string>();
  for (const b of bookings) {
    for (const night of eachDateInRange(toDateKey(b.checkIn), toDateKey(b.checkOut))) {
      if (toDateKey(night) === toDateKey(b.checkOut)) continue; // checkout day itself isn't occupied
      bookedDates.add(toDateKey(night));
    }
  }

  const days = eachDateInRange(toDateKey(monthStart), toDateKey(monthEnd)).map((date) => {
    const key = toDateKey(date);
    const isBooked = bookedDates.has(key);
    const manual = manualByDate.get(key) ?? false;
    return {
      date: key,
      isBlocked: isBooked || manual,
      source: isBooked ? ("booking" as const) : manual ? ("manual" as const) : null,
    };
  });

  return NextResponse.json({ days });
});

export const PATCH = withApiAuth(async (req, { params }) => {
  const room = await prisma.room.findUnique({ where: { id: params.roomId } });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const body = await req.json();
  const parsed = availabilityRangeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { from, to, isBlocked } = parsed.data;
  const dates = eachDateInRange(from, to);
  if (dates.length > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: `Range too large (max ${MAX_RANGE_DAYS} days)` }, { status: 400 });
  }

  await prisma.$transaction(
    dates.map((date) =>
      prisma.availability.upsert({
        where: { roomId_date: { roomId: room.id, date } },
        update: { isBlocked },
        create: { roomId: room.id, date, isBlocked },
      })
    )
  );

  return NextResponse.json({ ok: true, updated: dates.length });
});
