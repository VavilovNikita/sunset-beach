import Link from "next/link";
import { backendJson } from "@/lib/backendServer";
import { requireRoleAtLeast, hasRoleAtLeast } from "@/lib/rbac";
import { addDaysUTC, endOfMonthUTC, startOfMonthUTC, toDateKey } from "@/lib/bookings";
import { ZOOM_LEVELS, parseZoomParam, type ZoomLevel } from "@/lib/calendarZoom";
import BookingCalendarGrid from "@/components/admin/BookingCalendarGrid";
import CalendarRangePersistence from "@/components/admin/CalendarRangePersistence";
import type { BookingCalendarResponse } from "@/lib/types";

function parseMonthParam(month: string | undefined) {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [y, m] = month.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, 1));
  }
  return startOfMonthUTC(new Date());
}

function monthKey(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function rangeLabel(rangeStart: Date, windowMonths: number) {
  if (windowMonths === 1) {
    return rangeStart.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
  }
  const rangeEndInclusive = new Date(Date.UTC(rangeStart.getUTCFullYear(), rangeStart.getUTCMonth() + windowMonths - 1, 1));
  const fmt = (d: Date) => d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
  return `${fmt(rangeStart)} – ${fmt(rangeEndInclusive)}`;
}

export default async function AdminBookingCalendarPage({
  searchParams,
}: {
  searchParams: { month?: string; zoom?: string };
}) {
  // GET /bookings/calendar is CASHIER+ on the backend (matches GET /bookings/*).
  const user = await requireRoleAtLeast("CASHIER", "/admin/pos");
  const canManage = hasRoleAtLeast(user.role, "MANAGER");

  const zoom: ZoomLevel = parseZoomParam(searchParams.zoom);
  const windowMonths = ZOOM_LEVELS[zoom].windowMonths;
  const monthStart = parseMonthParam(searchParams.month);
  const currentMonthKey = monthKey(monthStart);

  // "day" zoom fetches one calendar month (unchanged from before zoom existed); "week"/"month"
  // widen the fetched window itself (3 / 12 months), not just the pixel density - zooming out is
  // meant to show more time, not the same month rendered smaller. 12 months is at most 366 days
  // (a leap year), exactly GET /bookings/calendar's own cap - see that endpoint's description.
  const rangeEnd = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + windowMonths, 1));
  const from = toDateKey(monthStart);
  const to = toDateKey(rangeEnd);

  const prevRangeStart = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - windowMonths, 1));
  const nextRangeStart = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + windowMonths, 1));

  const data = await backendJson<BookingCalendarResponse>(`/bookings/calendar?from=${from}&to=${to}`, { auth: true });

  return (
    <div>
      <CalendarRangePersistence
        hasExplicitParams={Boolean(searchParams.month || searchParams.zoom)}
        currentMonthKey={currentMonthKey}
        currentZoom={zoom}
      />

      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <p className="eyebrow text-sea mb-2">Reservations</p>
          <h1 className="font-display italic text-3xl">Calendar</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/bookings/calendar?month=${monthKey(prevRangeStart)}&zoom=${zoom}`}
            className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-4 py-2 text-sm"
          >
            ← Prev
          </Link>
          <p className="text-cream text-sm min-w-[10rem] text-center">{rangeLabel(monthStart, windowMonths)}</p>
          <Link
            href={`/admin/bookings/calendar?month=${monthKey(nextRangeStart)}&zoom=${zoom}`}
            className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-4 py-2 text-sm"
          >
            Next →
          </Link>
        </div>
      </div>

      <p className="text-xs text-cream/40 mb-4">
        Drag across free nights on a room's row to create a booking. Drag a booking's edge to change dates, or drag the
        whole bar to move it. Click a booking to open its details, change its status, or relocate it to another room.
      </p>

      <BookingCalendarGrid data={data} canManage={canManage} zoom={zoom} monthKey={currentMonthKey} />
    </div>
  );
}
