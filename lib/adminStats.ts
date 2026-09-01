import { backendJson } from "@/lib/backendServer";
import { BackendError } from "@/lib/backend";
import { addDaysUTC, dateOnlyUTC, startOfMonthUTC, endOfMonthUTC, toDateKey } from "@/lib/bookings";
import type { Booking, Room } from "@/lib/types";
import type { PaymentsSummary } from "@/lib/posTypes";

const OCCUPANCY_WINDOW_DAYS = 30;

// Three explicit outcomes rather than `PaymentsSummary | null` — "the
// manager isn't allowed to see this" (hide the POS cards, no complaint) and
// "the request failed" (say so, don't render as if there were simply
// nothing) need different UI, and collapsing them into one falsy value
// would lose that distinction the same way folio's silent-`null` bug did.
export type DashboardPosSummary =
  | { status: "ok"; data: PaymentsSummary }
  | { status: "forbidden" }
  | { status: "error" };

async function getPosSummary(from: string, to: string): Promise<DashboardPosSummary> {
  try {
    const data = await backendJson<PaymentsSummary>(`/payments/summary?from=${from}&to=${to}`, { auth: true });
    return { status: "ok", data };
  } catch (e) {
    if (e instanceof BackendError && e.status === 403) return { status: "forbidden" };
    return { status: "error" };
  }
}

// Same three-outcome shape as DashboardPosSummary above, for the same reason: GET /rooms and
// GET /bookings are CASHIER+ on the backend, and WAITER is below that — a WAITER opening the
// dashboard (still everyone's reachable landing page, see AdminSidebar) must see a dashboard
// with these cards missing, not a fully crashed page. This is exactly the bug the regression
// pass found: getDashboardStats() used to await these unconditionally, so a plain 403 became an
// uncaught rejection during the page's server render — a 500 for the whole route, not just a
// missing widget.
export type DashboardRoomStats =
  | {
      status: "ok";
      bookingsToday: number;
      bookingsThisWeek: number;
      occupancyPct: number;
      revenueThisMonth: number;
    }
  | { status: "forbidden" }
  | { status: "error" };

// The actual aggregation, split out from getRoomStats so it's testable without mocking a
// fetch: given "now" plus the room/booking lists that would otherwise come straight off the
// network, it's a pure function - same input, same output, every time. This is exactly the
// kind of arithmetic a bug hides in silently (a wrong comparison operator doesn't crash
// anything, it just quietly zeroes a number - see parseDateKey's history in lib/bookings.ts),
// so it's covered by lib/adminStats.test.ts rather than only ever eyeballed on the dashboard.
export function computeRoomStats(
  now: Date,
  rooms: Room[],
  bookings: Booking[]
): { bookingsToday: number; bookingsThisWeek: number; occupancyPct: number; revenueThisMonth: number } {
  const todayStart = dateOnlyUTC(now);
  const tomorrowStart = addDaysUTC(todayStart, 1);
  const weekStart = addDaysUTC(todayStart, -6); // rolling 7-day window, inclusive of today
  const monthStart = startOfMonthUTC(now);
  const monthEnd = endOfMonthUTC(now);
  const nextMonthStart = addDaysUTC(monthEnd, 1);
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

  // Each Room row is a room *type*; activeUnitCount is how many physical
  // RoomUnits currently sell under it — occupancy must be denominated by
  // total units, not by the number of room types.
  const totalUnits = rooms.reduce((sum, r) => sum + r.activeUnitCount, 0);
  const totalRoomNights = totalUnits * OCCUPANCY_WINDOW_DAYS;
  const occupancyPct = totalRoomNights > 0 ? Math.round((bookedNights / totalRoomNights) * 100) : 0;

  return { bookingsToday, bookingsThisWeek, occupancyPct, revenueThisMonth };
}

async function getRoomStats(now: Date): Promise<DashboardRoomStats> {
  try {
    const [rooms, bookings] = await Promise.all([
      backendJson<Room[]>("/rooms", { auth: true }),
      backendJson<Booking[]>("/bookings", { auth: true }),
    ]);

    return { status: "ok", ...computeRoomStats(now, rooms, bookings) };
  } catch (e) {
    if (e instanceof BackendError && e.status === 403) return { status: "forbidden" };
    return { status: "error" };
  }
}

// No dedicated stats endpoint exists on the Java side yet, so this pulls the
// full room/booking lists (staff-authed) and does the same aggregation the
// old Prisma-backed version did, just over fetched JSON instead of a DB
// query. Fine at this resort's booking volume; revisit if that ever grows
// large enough to need a real aggregate endpoint.
export async function getDashboardStats() {
  const now = new Date();
  const monthStart = startOfMonthUTC(now);
  const monthEnd = endOfMonthUTC(now);

  const [roomStats, posSummary] = await Promise.all([
    getRoomStats(now),
    // Same period as room revenue: the current calendar month.
    getPosSummary(toDateKey(monthStart), toDateKey(monthEnd)),
  ]);

  return {
    roomStats,
    occupancyWindowDays: OCCUPANCY_WINDOW_DAYS,
    posSummary,
  };
}
