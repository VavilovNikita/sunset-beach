import { backendJson } from "@/lib/backendServer";
import { BackendError } from "@/lib/backend";
import { requireRoleAtLeast, hasRoleAtLeast } from "@/lib/rbac";
import { daysBetweenUTC, parseDateKey, startOfMonthUTC, toDateKey, addMonthsUTC } from "@/lib/bookings";
import { MAX_CALENDAR_RANGE_DAYS } from "@/lib/calendarRange";
import BookingCalendarGrid from "@/components/admin/BookingCalendarGrid";
import CalendarPeriodPersistence from "@/components/admin/CalendarPeriodPersistence";
import CalendarPeriodControls from "@/components/admin/CalendarPeriodControls";
import type { BookingCalendarResponse } from "@/lib/types";

function defaultPeriod() {
  const from = startOfMonthUTC(new Date());
  return { from, to: addMonthsUTC(from, 1) };
}

// Both `from` and `to` have to be present and well-formed together, or the whole pair is
// discarded in favor of the default - a lone/malformed param (a hand-edited URL, a stale link) is
// treated the same as no params at all rather than half-applied.
function parsePeriodParams(from: string | undefined, to: string | undefined) {
  if (from && to) {
    try {
      const parsedFrom = parseDateKey(from);
      const parsedTo = parseDateKey(to);
      if (parsedFrom.getTime() < parsedTo.getTime()) return { from: parsedFrom, to: parsedTo };
    } catch {
      // fall through to default
    }
  }
  return defaultPeriod();
}

export default async function AdminBookingCalendarPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string };
}) {
  // GET /bookings/calendar is CASHIER+ on the backend (matches GET /bookings/*).
  const user = await requireRoleAtLeast("CASHIER", "/admin/pos");
  const canManage = hasRoleAtLeast(user.role, "MANAGER");

  const { from: fromDate, to: toDate } = parsePeriodParams(searchParams.from, searchParams.to);
  const from = toDateKey(fromDate);
  const to = toDateKey(toDate);
  const rangeDays = daysBetweenUTC(fromDate, toDate);

  // Same cap GET /bookings/calendar enforces server-side (BookingCalendarService -
  // MAX_CALENDAR_RANGE_DAYS, sunset repo) - checked here too so a range that's too large never
  // even reaches the network, and CalendarPeriodControls checks it again before it navigates here
  // at all. Both are just the convenience path; the backend's own check is what actually protects
  // it regardless of what either frontend check does or doesn't catch (a hand-edited URL, a stale
  // bookmark from before this constant last changed, localStorage from a much older session).
  const rangeTooLarge = rangeDays > MAX_CALENDAR_RANGE_DAYS;

  let data: BookingCalendarResponse | null = null;
  let loadError: string | null = null;
  if (!rangeTooLarge) {
    try {
      data = await backendJson<BookingCalendarResponse>(`/bookings/calendar?from=${from}&to=${to}`, { auth: true });
    } catch (e) {
      if (e instanceof BackendError && e.status === 400) {
        loadError = e.message;
      } else {
        throw e;
      }
    }
  }

  return (
    <div>
      <CalendarPeriodPersistence
        hasExplicitParams={Boolean(searchParams.from || searchParams.to)}
        currentFrom={from}
        currentTo={to}
      />

      <div className="mb-2">
        <p className="eyebrow text-sea mb-2">Reservations</p>
        <h1 className="font-display italic text-3xl mb-6">Calendar</h1>
      </div>

      <CalendarPeriodControls from={from} to={to} />

      <p className="text-xs text-cream/40 mb-4">
        Drag across free nights on a room's row to create a booking. Drag a booking's edge to change dates, or drag the
        whole bar to move it. Click a booking to open its details, change its status, or relocate it to another room.
      </p>

      {rangeTooLarge ? (
        <p className="text-sm text-coral bg-coral/10 border border-coral/30 rounded-xl px-4 py-3">
          That range is {rangeDays} days — the calendar can show at most {MAX_CALENDAR_RANGE_DAYS} days (about a year)
          at once. Pick a shorter period above.
        </p>
      ) : loadError ? (
        <p className="text-sm text-coral bg-coral/10 border border-coral/30 rounded-xl px-4 py-3">{loadError}</p>
      ) : (
        <BookingCalendarGrid data={data!} canManage={canManage} />
      )}
    </div>
  );
}
