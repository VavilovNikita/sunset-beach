import { backendJson } from "@/lib/backendServer";
import { addDaysUTC, dateOnlyUTC, startOfMonthUTC, endOfMonthUTC } from "@/lib/bookings";
import type { Booking, Room } from "@/lib/types";

const OCCUPANCY_WINDOW_DAYS = 30;

// No dedicated stats endpoint exists on the Java side yet, so this pulls the
// full room/booking lists (staff-authed) and does the same aggregation the
// old Prisma-backed version did, just over fetched JSON instead of a DB
// query. Fine at this resort's booking volume; revisit if that ever grows
// large enough to need a real aggregate endpoint.
export async function getDashboardStats() {
  const [rooms, bookings] = await Promise.all([
    backendJson<Room[]>("/rooms", { auth: true }),
    backendJson<Booking[]>("/bookings", { auth: true }),
  ]);

  const now = new Date();
  const todayStart = dateOnlyUTC(now);
  const tomorrowStart = addDaysUTC(todayStart, 1);
  const weekStart = addDaysUTC(todayStart, -6); // rolling 7-day window, inclusive of today
  const monthStart = startOfMonthUTC(now);
  const nextMonthStart = addDaysUTC(endOfMonthUTC(now), 1);
  const occupancyWindowEnd = addDaysUTC(todayStart, OCCUPANCY_WINDOW_DAYS);

  let bookingsToday = 0;
  let bookingsThisWeek = 0;
  let revenueThisMonth = 0;
  let bookedNights = 0;

  for (const b of bookings) {
    const createdAt = new Date(b.createdAt);
    if (createdAt >= todayStart && createdAt < tomorrowStart) bookingsToday += 1;
    if (createdAt >= weekStart && createdAt < tomorrowStart) bookingsThisWeek += 1;

    const checkIn = dateOnlyUTC(b.checkIn);
    const checkOut = dateOnlyUTC(b.checkOut);

    if (b.status === "PAID" && checkIn >= monthStart && checkIn < nextMonthStart) {
      revenueThisMonth += Number(b.totalPrice);
    }

    if (b.status !== "CANCELLED" && checkIn < occupancyWindowEnd && checkOut > todayStart) {
      const start = checkIn > todayStart ? checkIn : todayStart;
      const end = checkOut < occupancyWindowEnd ? checkOut : occupancyWindowEnd;
      bookedNights += Math.max(0, Math.round((end.getTime() - start.getTime()) / 86_400_000));
    }
  }

  const totalRoomNights = rooms.length * OCCUPANCY_WINDOW_DAYS;
  const occupancyPct = totalRoomNights > 0 ? Math.round((bookedNights / totalRoomNights) * 100) : 0;

  return {
    bookingsToday,
    bookingsThisWeek,
    occupancyPct,
    occupancyWindowDays: OCCUPANCY_WINDOW_DAYS,
    revenueThisMonth,
  };
}
