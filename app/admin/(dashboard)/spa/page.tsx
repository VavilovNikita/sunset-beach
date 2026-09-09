import { backendJson, backendJsonOrDefault } from "@/lib/backendServer";
import { requireRoleAtLeast } from "@/lib/rbac";
import { addDaysUTC, dateOnlyUTC, parseDateKey, toDateKey } from "@/lib/bookings";
import SpaScheduleGrid from "@/components/admin/SpaScheduleGrid";
import type { MenuItem, SpaSchedule, SpaTherapist } from "@/lib/posTypes";
import type { Booking } from "@/lib/types";

// A lone bad ?date= (hand-edited URL, a stale link) falls back to today rather than 500ing -
// same "malformed param treated as absent" convention as the booking calendar's period params.
function parseDateParam(value: string | undefined): string {
  if (value) {
    try {
      parseDateKey(value);
      return value;
    } catch {
      // fall through to today
    }
  }
  return toDateKey(new Date());
}

export default async function AdminSpaPage({ searchParams }: { searchParams: { date?: string } }) {
  // GET /spa-appointments is CASHIER+ on the backend, same floor as the rest of front-desk work -
  // reception is the only surface in v1 (no therapist self-service, see JobFunction.THERAPIST).
  await requireRoleAtLeast("CASHIER", "/admin/pos");

  const date = parseDateParam(searchParams.date);
  // Bookings whose stay covers `date` inclusive of the departure day (CORRECTION 1 - the guest
  // is still in the hotel that morning): GET /bookings?from&to is `checkOut > from AND checkIn
  // <= to` (see RoomChargeLink's own comment on this endpoint), so from = date-1, to = date
  // widens it to checkOut >= date AND checkIn <= date - exactly the inclusive range the backend
  // itself uses to decide whether to warn.
  const dayBefore = toDateKey(addDaysUTC(dateOnlyUTC(date), -1));
  const [schedule, menuItems, bookings, therapists] = await Promise.all([
    backendJson<SpaSchedule>(`/spa-appointments?date=${date}`, { auth: true }),
    // Every menu item, not just SPA ones, so the create modal can say clearly why a non-treatment
    // item isn't offered rather than silently omitting it - see SpaScheduleGrid.
    backendJsonOrDefault<MenuItem[]>("/menu", [], { auth: true }),
    backendJsonOrDefault<Booking[]>(`/bookings?from=${dayBefore}&to=${date}`, [], { auth: true }),
    backendJsonOrDefault<SpaTherapist[]>("/spa-appointments/therapists", [], { auth: true }),
  ]);

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Front desk</p>
      <h1 className="font-display italic text-3xl mb-2">Spa</h1>
      <p className="text-xs text-cream/40 mb-6 max-w-2xl">
        Rows are spa tables, columns are {schedule.slotMinutes}-minute slots from {schedule.openingTime} to{" "}
        {schedule.closingTime}. Click a free slot to book a treatment; click a booked one to cancel, mark no-show, or
        complete it.
      </p>

      <SpaScheduleGrid schedule={schedule} menuItems={menuItems} bookings={bookings} therapists={therapists} date={date} />
    </div>
  );
}
