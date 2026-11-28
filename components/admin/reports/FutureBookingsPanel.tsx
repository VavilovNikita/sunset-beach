import Link from "next/link";
import { BOOKING_CHANNEL_LABELS } from "@/lib/bookingChannel";
import { bookingStatusLabel } from "@/lib/bookingStatusLabel";
import { formatDate } from "@/lib/formatDate";
import { FUTURE_STATUSES, futureQuery, isFutureRangeInverted } from "@/lib/futureBookings";
import { formatBaht } from "@/lib/reports";
import { reportsHiddenFields, type ReportsState } from "@/lib/reportsTabs";
import type { BookingStatus, FutureBookingsReport } from "@/lib/types";
import FutureBookingsExportButton from "@/components/admin/reports/FutureBookingsExportButton";
import { STAY_TOTAL_HINT, STAY_TOTAL_LABEL } from "@/lib/bookingList";

// The Future bookings tab: arrivals in a date range by status (Tentative / Confirmed / Room paid). The server sends
// every row and every total; this only lays them out. The status switches are a plain GET form - with none ticked the
// address falls back to all three, so the report can never be asked for nothing.

const th = "px-3 py-2 font-normal eyebrow text-cream/50 text-left";
const td = "px-3 py-2 align-top";

export default function FutureBookingsPanel({
  result,
  state,
  range,
  statuses,
}: {
  result: { ok: true; data: FutureBookingsReport } | { ok: false; error: string };
  state: ReportsState;
  range: { from: string; to: string };
  statuses: BookingStatus[];
}) {
  const inverted = isFutureRangeInverted(range);
  return (
    <>
      <p className="text-sm text-cream/60 mb-6">
        Bookings arriving in the range, by status. Cancelled bookings and no-shows are not listed. Tentative is a provisional booking; Room
        paid is a confirmed booking whose room is paid.
      </p>
      <form method="get" className="flex flex-wrap items-end gap-3 mb-6">
        {reportsHiddenFields(state, ["from", "to", "status"]).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Arriving from</label>
          <input type="date" name="from" defaultValue={range.from} className="bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">To</label>
          <input type="date" name="to" defaultValue={range.to} className="bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm" />
        </div>
        <fieldset>
          <legend className="eyebrow text-cream/60 mb-1">Status</legend>
          <div className="flex gap-2">
            {FUTURE_STATUSES.map((s) => (
              <label key={s} className="flex items-center gap-1.5 rounded-lg border border-cream/20 px-3 py-2 text-sm cursor-pointer">
                <input type="checkbox" name="status" value={s} defaultChecked={statuses.includes(s)} />
                {bookingStatusLabel(s)}
              </label>
            ))}
          </div>
        </fieldset>
        <button type="submit" className="rounded-full border border-cream/20 hover:border-coral px-4 py-2 text-sm">
          View
        </button>
      </form>

      {inverted ? (
        <p className="text-sm text-coral mb-8">&ldquo;From&rdquo; must be on or before &ldquo;To&rdquo;.</p>
      ) : !result.ok ? (
        <p className="text-sm text-coral">Couldn&apos;t load the future bookings: {result.error}</p>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 mb-6">
            {result.data.summary.map((s) => (
              <div key={s.status} className="bg-ink2/40 border border-cream/10 rounded-xl px-4 py-3 min-w-[10rem]">
                <p className="eyebrow text-cream/50">{bookingStatusLabel(s.status)}</p>
                <p className="text-lg font-display italic">
                  {s.bookings} {s.bookings === 1 ? "booking" : "bookings"}
                </p>
                <p className="text-xs text-cream/60">
                  {s.nights} {s.nights === 1 ? "night" : "nights"} · {formatBaht(s.totalPrice)}
                </p>
              </div>
            ))}
          </div>

          <div className="mb-4">
            <FutureBookingsExportButton query={futureQuery(range, statuses)} />
          </div>

          {result.data.rows.length === 0 ? (
            <p className="text-sm text-cream/50">No bookings arrive in this range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-cream/10">
                    <th className={th}>Guest</th>
                    <th className={th}>Room</th>
                    <th className={th}>Arrives</th>
                    <th className={th}>Departs</th>
                    <th className={th}>Nights</th>
                    <th className={th}>Guests</th>
                    <th className={th}>Channel</th>
                    <th className={th}>Status</th>
                    <th className={`${th} text-right`} title={STAY_TOTAL_HINT}>
                      {STAY_TOTAL_LABEL}
                    </th>
                    <th className={`${th} text-right`}>Balance due</th>
                    <th className={th}>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {result.data.rows.map((r) => (
                    <tr key={r.bookingId} className="border-b border-cream/5">
                      <td className={td}>
                        <Link href={`/admin/bookings/${r.bookingId}`} className="text-cream hover:text-coral transition-colors">
                          {r.guestName}
                        </Link>
                      </td>
                      <td className={`${td} text-cream/70`}>
                        {r.roomName}
                        {r.roomUnitLabel ? ` — ${r.roomUnitLabel}` : ""}
                      </td>
                      <td className={`${td} whitespace-nowrap`}>{formatDate(r.checkIn)}</td>
                      <td className={`${td} whitespace-nowrap`}>{formatDate(r.checkOut)}</td>
                      <td className={td}>{r.nights}</td>
                      <td className={td}>
                        {r.adults}
                        {r.children > 0 ? ` + ${r.children}` : ""}
                      </td>
                      <td className={`${td} text-cream/70`}>{BOOKING_CHANNEL_LABELS[r.channel]}</td>
                      <td className={td}>
                        <span className="rounded-full px-2.5 py-1 text-xs bg-cream/10 text-cream/80 whitespace-nowrap">{bookingStatusLabel(r.status)}</span>
                      </td>
                      <td className={`${td} text-right whitespace-nowrap`}>{formatBaht(r.totalPrice)}</td>
                      <td className={`${td} text-right whitespace-nowrap`}>{formatBaht(r.balanceDue)}</td>
                      <td className={`${td} text-cream/70 whitespace-pre-wrap break-words max-w-xs`}>{r.notes ?? ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </>
  );
}
