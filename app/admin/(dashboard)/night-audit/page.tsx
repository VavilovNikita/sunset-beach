import Link from "next/link";
import { backendJson } from "@/lib/backendServer";
import { requireRoleAtLeast } from "@/lib/rbac";
import { describeOverdue, parseNightAuditDateParam } from "@/lib/nightAudit";
import StatCard from "@/components/admin/StatCard";
import NightAuditCloseForm from "@/components/admin/NightAuditCloseForm";
import type { NightAudit, NightAuditBooking } from "@/lib/types";

// The front desk's once-a-day review: who should have arrived or left and didn't, the day's room
// figures, and a "Close day" receipt. GET /night-audit and POST /night-audit/close are CASHIER+ -
// routine daily work, not a MANAGER+ report. Nothing here acts on a booking; each row links to the
// booking, where check-in, check-out and no-show already live.
//
// With no ?date= the server picks today (hotel-local), so this page never has to work out "today"
// itself; the date picker below just navigates to ?date=.
export default async function NightAuditPage({ searchParams }: { searchParams: { date?: string } }) {
  await requireRoleAtLeast("CASHIER", "/admin/pos");

  const date = parseNightAuditDateParam(searchParams.date);
  const audit = await backendJson<NightAudit>(date ? `/night-audit?date=${date}` : "/night-audit", { auth: true });
  const snapshot = audit.snapshot;

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <p className="eyebrow text-sea mb-2">Front desk</p>
        <h1 className="font-display italic text-3xl">Night audit</h1>
        <p className="text-sm text-cream/60 mt-3">
          Review the day before closing it: guests who should have arrived or left and haven&apos;t, and the day&apos;s room
          figures. Lists show what is still unresolved now, including anything left over from earlier days.
        </p>
      </div>

      <form method="get" className="flex items-end gap-3 mb-8">
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Date</label>
          <input
            type="date"
            name="date"
            defaultValue={audit.date}
            className="bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
          />
        </div>
        <button type="submit" className="rounded-full border border-cream/20 hover:border-coral px-4 py-2 text-sm">
          View
        </button>
        {date && (
          <Link href="/admin/night-audit" className="text-sm text-cream/60 hover:text-coral py-2">
            Today
          </Link>
        )}
      </form>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <StatCard
          label="Room-nights sold"
          value={String(snapshot.roomNightsSold)}
          sublabel={`of ${snapshot.roomNightsAvailable} available`}
        />
        <StatCard label="Occupancy" value={snapshot.occupancyPercent === null ? "—" : `${snapshot.occupancyPercent}%`} />
        <StatCard
          label="Room revenue"
          value={`฿${Number(snapshot.roomRevenue).toLocaleString("en-US")}`}
          sublabel="Agreed room price for this night, not money collected"
        />
      </div>

      <BookingList
        title="Missed arrivals"
        empty="No expected guest is overdue to arrive."
        hint="Still expected, with a check-in on or before this date. Check the guest in, or mark them no-show from the booking."
        bookings={audit.missedArrivals}
        dueDate={(b) => b.checkIn}
        reviewedDate={audit.date}
      />
      <BookingList
        title="Missed departures"
        empty="No checked-in guest is past their check-out."
        hint="Still checked in, with a check-out on or before this date."
        bookings={audit.missedDepartures}
        dueDate={(b) => b.checkOut}
        reviewedDate={audit.date}
      />

      <NightAuditCloseForm key={audit.date} date={audit.date} initialClosure={audit.closure} />
    </div>
  );
}

function BookingList({
  title,
  empty,
  hint,
  bookings,
  dueDate,
  reviewedDate,
}: {
  title: string;
  empty: string;
  hint: string;
  bookings: NightAuditBooking[];
  dueDate: (b: NightAuditBooking) => string;
  reviewedDate: string;
}) {
  return (
    <section className="mb-8">
      <h2 className="font-display italic text-xl mb-1">
        {title} <span className="text-cream/40 not-italic text-base">({bookings.length})</span>
      </h2>
      <p className="text-xs text-cream/40 mb-3">{hint}</p>
      {bookings.length === 0 ? (
        <p className="text-sm text-cream/60">{empty}</p>
      ) : (
        <ul className="divide-y divide-cream/10 border border-cream/10 rounded-xl">
          {bookings.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 text-sm">
              <div className="min-w-0">
                <Link href={`/admin/bookings/${b.id}`} className="text-cream hover:text-coral transition-colors font-medium">
                  {b.guestName}
                </Link>
                <p className="text-xs text-cream/50">
                  {b.roomName}
                  {b.roomUnitLabel ? ` · ${b.roomUnitLabel}` : " · no room assigned"} · {b.checkIn} → {b.checkOut}
                </p>
              </div>
              <span className="text-xs text-amber-400">{describeOverdue(dueDate(b), reviewedDate)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
