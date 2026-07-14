import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export const MAX_RANGE_DAYS = 366;

type Db = PrismaClient | Prisma.TransactionClient;

export class BookingConflictError extends Error {
  constructor() {
    super("Selected dates are no longer available");
  }
}

// All date-only math here is done with Date.UTC/getUTC*/setUTC* exclusively.
// This project never uses local-time Date parsing/iteration (e.g. date-fns'
// parseISO/eachDayOfInterval, which interpret date-only strings and iterate
// using local calendar days) because on any machine whose timezone isn't
// UTC+0 that silently shifts calendar dates by a day — RatePlan/Availability
// are @db.Date columns and must line up with the exact UTC midnight instant
// Prisma sends, or upserts land on the wrong day.

// Parses a "YYYY-MM-DD" key as a UTC midnight instant.
export function parseDateKey(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function dateOnlyUTC(date: Date | string) {
  if (typeof date === "string") return parseDateKey(date);
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export function toDateKey(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDaysUTC(date: Date, days: number) {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

function daysBetweenUTC(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

// Inclusive list of calendar dates between two ISO strings (used for
// pricing/availability range writes, which operate per-day).
export function eachDateInRange(fromKey: string, toKey: string) {
  const from = parseDateKey(fromKey);
  const to = parseDateKey(toKey);
  const span = daysBetweenUTC(from, to);
  return Array.from({ length: Math.max(span, -1) + 1 }, (_, i) => addDaysUTC(from, i));
}

// Nights of a stay: [checkIn, checkOut) — checkout day itself isn't a night.
export function getNights(checkIn: Date | string, checkOut: Date | string) {
  const start = dateOnlyUTC(checkIn);
  const end = dateOnlyUTC(checkOut);
  const nightCount = daysBetweenUTC(start, end);
  return Array.from({ length: Math.max(nightCount, 0) }, (_, i) => addDaysUTC(start, i));
}

export function startOfMonthUTC(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

export function endOfMonthUTC(date: Date) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0));
}

// A range is available if no night is manually blocked and no other
// (non-CANCELLED) booking overlaps it. Pass a transaction client when calling
// this immediately before creating the booking, so the check and the insert
// are part of the same atomic unit of work.
export async function isRangeAvailable(
  db: Db,
  roomId: string,
  checkIn: Date,
  checkOut: Date,
  excludeBookingId?: string
) {
  const [blockedCount, overlappingCount] = await Promise.all([
    db.availability.count({
      where: { roomId, isBlocked: true, date: { gte: checkIn, lt: checkOut } },
    }),
    db.booking.count({
      where: {
        roomId,
        status: { not: "CANCELLED" },
        ...(excludeBookingId ? { id: { not: excludeBookingId } } : {}),
        checkIn: { lt: checkOut },
        checkOut: { gt: checkIn },
      },
    }),
  ]);
  return blockedCount === 0 && overlappingCount === 0;
}

// Room.basePrice is required, so every night always resolves to a price —
// either an explicit RatePlan override or the room's base rate.
export async function computeTotalPrice(db: Db, roomId: string, checkIn: Date, checkOut: Date) {
  const room = await db.room.findUnique({ where: { id: roomId } });
  if (!room) return null;

  const nights = getNights(checkIn, checkOut);
  if (nights.length === 0) return null;

  const rates = await db.ratePlan.findMany({ where: { roomId, date: { in: nights } } });
  const overrides = new Map(rates.map((r) => [toDateKey(r.date), Number(r.price)]));

  return nights.reduce((sum, night) => sum + (overrides.get(toDateKey(night)) ?? Number(room.basePrice)), 0);
}

function csvEscape(value: string) {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

type CsvBooking = {
  id: string;
  room: { name: string };
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  checkIn: Date;
  checkOut: Date;
  totalPrice: Prisma.Decimal | number;
  status: string;
  paymentNote: string | null;
  createdAt: Date;
};

export function buildBookingsCsv(bookings: CsvBooking[]) {
  const header = [
    "ID",
    "Room",
    "Guest",
    "Email",
    "Phone",
    "Check-in",
    "Check-out",
    "Total",
    "Status",
    "Payment note",
    "Created at",
  ];
  const rows = bookings.map((b) => [
    b.id,
    b.room.name,
    b.guestName,
    b.guestEmail,
    b.guestPhone,
    toDateKey(b.checkIn),
    toDateKey(b.checkOut),
    Number(b.totalPrice).toFixed(2),
    b.status,
    b.paymentNote ?? "",
    b.createdAt.toISOString(),
  ]);
  return [header, ...rows].map((row) => row.map((v) => csvEscape(String(v))).join(",")).join("\r\n");
}

const OCCUPANCY_WINDOW_DAYS = 30;

export async function getDashboardStats() {
  const now = new Date();
  const todayStart = dateOnlyUTC(now);
  const tomorrowStart = addDaysUTC(todayStart, 1);
  const weekStart = addDaysUTC(todayStart, -6); // rolling 7-day window, inclusive of today
  const monthStart = startOfMonthUTC(now);
  const nextMonthStart = addDaysUTC(endOfMonthUTC(now), 1);
  const occupancyWindowEnd = addDaysUTC(todayStart, OCCUPANCY_WINDOW_DAYS);

  const [bookingsToday, bookingsThisWeek, roomCount, occupancyBookings, revenueAgg] = await Promise.all([
    prisma.booking.count({ where: { createdAt: { gte: todayStart, lt: tomorrowStart } } }),
    prisma.booking.count({ where: { createdAt: { gte: weekStart, lt: tomorrowStart } } }),
    prisma.room.count(),
    prisma.booking.findMany({
      where: {
        status: { not: "CANCELLED" },
        checkIn: { lt: occupancyWindowEnd },
        checkOut: { gt: todayStart },
      },
      select: { checkIn: true, checkOut: true },
    }),
    prisma.booking.aggregate({
      where: { status: "PAID", checkIn: { gte: monthStart, lt: nextMonthStart } },
      _sum: { totalPrice: true },
    }),
  ]);

  // Nights booked within the occupancy window, clipped to the window on both ends.
  let bookedNights = 0;
  for (const b of occupancyBookings) {
    const start = b.checkIn > todayStart ? b.checkIn : todayStart;
    const end = b.checkOut < occupancyWindowEnd ? b.checkOut : occupancyWindowEnd;
    bookedNights += Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
  }
  const totalRoomNights = roomCount * OCCUPANCY_WINDOW_DAYS;
  const occupancyPct = totalRoomNights > 0 ? Math.round((bookedNights / totalRoomNights) * 100) : 0;

  return {
    bookingsToday,
    bookingsThisWeek,
    occupancyPct,
    occupancyWindowDays: OCCUPANCY_WINDOW_DAYS,
    revenueThisMonth: Number(revenueAgg._sum.totalPrice ?? 0),
  };
}
