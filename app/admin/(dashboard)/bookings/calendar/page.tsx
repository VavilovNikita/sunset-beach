import Link from "next/link";
import { backendJson } from "@/lib/backendServer";
import { addDaysUTC, endOfMonthUTC, startOfMonthUTC, toDateKey } from "@/lib/bookings";
import BookingCalendarGrid from "@/components/admin/BookingCalendarGrid";
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

export default async function AdminBookingCalendarPage({ searchParams }: { searchParams: { month?: string } }) {
  const monthStart = parseMonthParam(searchParams.month);
  const monthEnd = endOfMonthUTC(monthStart);
  const from = toDateKey(monthStart);
  const to = toDateKey(addDaysUTC(monthEnd, 1)); // exclusive, same [from, to) convention as a stay

  const prevMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() - 1, 1));
  const nextMonth = new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1));

  const data = await backendJson<BookingCalendarResponse>(`/bookings/calendar?from=${from}&to=${to}`, { auth: true });

  return (
    <div>
      <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
        <div>
          <p className="eyebrow text-sea mb-2">Reservations</p>
          <h1 className="font-display italic text-3xl">Calendar</h1>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href={`/admin/bookings/calendar?month=${monthKey(prevMonth)}`}
            className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-4 py-2 text-sm"
          >
            ← Prev
          </Link>
          <p className="text-cream text-sm min-w-[8rem] text-center">
            {monthStart.toLocaleDateString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })}
          </p>
          <Link
            href={`/admin/bookings/calendar?month=${monthKey(nextMonth)}`}
            className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-4 py-2 text-sm"
          >
            Next →
          </Link>
        </div>
      </div>

      <p className="text-xs text-cream/40 mb-4">
        Drag across free nights on a room's row to create a booking. Drag a booking's edge to change dates, or drag the
        whole bar to move it. Every change is confirmed with a server-priced total before it applies.
      </p>

      <BookingCalendarGrid data={data} />
    </div>
  );
}
