import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { withApiAuth } from "@/lib/rbac";
import { priceRangeSchema } from "@/lib/validation";
import { eachDateInRange, toDateKey, startOfMonthUTC, endOfMonthUTC, MAX_RANGE_DAYS } from "@/lib/bookings";

export const GET = withApiAuth(async (req, { params }) => {
  const room = await prisma.room.findUnique({ where: { id: params.roomId } });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const monthParam = req.nextUrl.searchParams.get("month"); // "YYYY-MM"
  const [y, m] = (monthParam ?? toDateKey(new Date()).slice(0, 7)).split("-").map(Number);
  const monthStart = startOfMonthUTC(new Date(Date.UTC(y, m - 1, 1)));
  const monthEnd = endOfMonthUTC(monthStart);

  const ratePlans = await prisma.ratePlan.findMany({
    where: { roomId: room.id, date: { gte: monthStart, lte: monthEnd } },
  });
  const overrides = new Map(ratePlans.map((r) => [toDateKey(r.date), Number(r.price)]));

  const days = eachDateInRange(toDateKey(monthStart), toDateKey(monthEnd)).map((date) => {
    const key = toDateKey(date);
    const override = overrides.get(key);
    return {
      date: key,
      price: override ?? Number(room.basePrice),
      isOverride: override !== undefined,
    };
  });

  return NextResponse.json({ basePrice: Number(room.basePrice), days });
});

export const PATCH = withApiAuth(async (req, { params }) => {
  const room = await prisma.room.findUnique({ where: { id: params.roomId } });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const body = await req.json();
  const parsed = priceRangeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { from, to, price } = parsed.data;
  const dates = eachDateInRange(from, to);
  if (dates.length > MAX_RANGE_DAYS) {
    return NextResponse.json({ error: `Range too large (max ${MAX_RANGE_DAYS} days)` }, { status: 400 });
  }

  await prisma.$transaction(
    dates.map((date) =>
      prisma.ratePlan.upsert({
        where: { roomId_date: { roomId: room.id, date } },
        update: { price },
        create: { roomId: room.id, date, price },
      })
    )
  );

  return NextResponse.json({ ok: true, updated: dates.length });
});
