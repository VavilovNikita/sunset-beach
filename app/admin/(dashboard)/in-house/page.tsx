import Link from "next/link";
import { backendJson } from "@/lib/backendServer";
import { requireRoleAtLeast } from "@/lib/rbac";
import { parseNightAuditDateParam } from "@/lib/nightAudit";
import { MARKET_SEGMENT_LABELS } from "@/lib/reports";
import type { InHouseReport } from "@/lib/types";

// Who is in which room tonight (the legacy Z180). GET /reports/in-house is CASHIER+ - the front
// desk's routine daily list, same tier as the night audit, unlike the MANAGER+ reports page.
//
// With no ?date= the server picks tonight (hotel-local); the date picker just navigates to ?date=.
// Same param handling as the night-audit page.
export default async function InHousePage({ searchParams }: { searchParams: { date?: string } }) {
  await requireRoleAtLeast("CASHIER", "/admin/pos");

  const date = parseNightAuditDateParam(searchParams.date);
  const report = await backendJson<InHouseReport>(date ? `/reports/in-house?date=${date}` : "/reports/in-house", { auth: true });
  const { total } = report;

  return (
    <div className="max-w-5xl">
      <div className="mb-8">
        <p className="eyebrow text-sea mb-2">Front desk</p>
        <h1 className="font-display italic text-3xl">In house</h1>
        <p className="text-sm text-cream/60 mt-3">
          Every room occupied on this night by a guest who has checked in. Guests still expected to arrive aren&apos;t
          listed - see the night audit for those.
        </p>
      </div>

      <form method="get" className="flex items-end gap-3 mb-8">
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Night of</label>
          <input
            type="date"
            name="date"
            defaultValue={report.date}
            className="bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
          />
        </div>
        <button type="submit" className="rounded-full border border-cream/20 hover:border-coral px-4 py-2 text-sm">
          View
        </button>
        {date && (
          <Link href="/admin/in-house" className="text-sm text-cream/60 hover:text-coral py-2">
            Tonight
          </Link>
        )}
      </form>

      {report.rooms.length === 0 ? (
        <p className="text-sm text-cream/60">No checked-in guests on this night.</p>
      ) : (
        <div className="border border-cream/10 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="border-b border-cream/10">
                <th className={th}>Room</th>
                <th className={th}>Room type</th>
                <th className={th}>Guest</th>
                <th className={`${th} text-right`}>Adults</th>
                <th className={`${th} text-right`}>Children</th>
                <th className={th}>Segment</th>
                <th className={th}>Arrival</th>
                <th className={th}>Departure</th>
                <th className={th}>Booking</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream/10">
              {report.rooms.map((row) => (
                <tr key={row.bookingId}>
                  <td className={`${td} whitespace-nowrap`}>
                    {row.roomUnitLabel ?? <span className="text-amber-400">Unassigned</span>}
                  </td>
                  <td className={td}>{row.roomName}</td>
                  <td className={td}>
                    <Link href={`/admin/bookings/${row.bookingId}`} className="text-cream hover:text-coral transition-colors">
                      {row.guestName}
                    </Link>
                  </td>
                  <td className={`${td} text-right`}>{row.adults}</td>
                  <td className={`${td} text-right`}>{row.children}</td>
                  <td className={`${td} whitespace-nowrap`} title={MARKET_SEGMENT_LABELS[row.marketSegment]}>
                    {row.marketSegment}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{row.arrival}</td>
                  <td className={`${td} whitespace-nowrap`}>{row.departure}</td>
                  <td className={`${td} text-xs text-cream/50 font-mono`}>{row.bookingId.slice(0, 8)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-cream/20 font-medium">
                <td className={td} colSpan={3}>
                  Total: {total.rooms} {total.rooms === 1 ? "room" : "rooms"}
                </td>
                <td className={`${td} text-right`}>{total.adults}</td>
                <td className={`${td} text-right`}>{total.children}</td>
                <td className={td} colSpan={4} />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      <p className="text-xs text-cream/40 mt-2">
        Adults and children are the booking&apos;s own counts. Nationality, company and remarks aren&apos;t recorded
        in the system, so they aren&apos;t shown.
      </p>
    </div>
  );
}

const th = "px-4 py-2 font-normal eyebrow text-cream/50";
const td = "px-4 py-2";
