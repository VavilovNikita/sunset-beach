import { backendJson } from "@/lib/backendServer";
import { requireRoleAtLeast } from "@/lib/rbac";
import { hotelDateKey } from "@/lib/dashboardOps";
import {
  MARKET_SEGMENT_LABELS,
  formatBaht,
  formatPercent,
  isRangeInverted,
  parseReportRange,
  type ReportRange,
} from "@/lib/reports";
import type { MarketSegmentReport, MarketSegmentRow, TopProductionReport } from "@/lib/types";

// Room-night reports over one shared date range. GET /reports/top-production and
// /reports/market-segment are both MANAGER+ (same floor as the revenue export). Both count the
// same population as GET /reports/occupancy: nights of non-cancelled bookings inside the range,
// with from/to as inclusive nights. Every figure and share is the server's; nothing is summed here.
//
// Each report loads on its own, so one failing shows its own error without hiding the other.
export default async function ReportsPage({ searchParams }: { searchParams: { from?: string; to?: string } }) {
  await requireRoleAtLeast("MANAGER");

  const range = parseReportRange(searchParams.from, searchParams.to, hotelDateKey(new Date()));
  const inverted = isRangeInverted(range);
  const query = `from=${range.from}&to=${range.to}`;

  const [topProduction, marketSegment] = inverted
    ? [null, null]
    : await Promise.all([
        load<TopProductionReport>(`/reports/top-production?${query}`),
        load<MarketSegmentReport>(`/reports/market-segment?${query}`),
      ]);

  return (
    <div className="max-w-4xl">
      <div className="mb-8">
        <p className="eyebrow text-sea mb-2">Reports</p>
        <h1 className="font-display italic text-3xl">Room production</h1>
        <p className="text-sm text-cream/60 mt-3">
          Room-nights and room revenue by where the booking came from. Counts every night of every booking that isn&apos;t
          cancelled, with both dates included as nights. Revenue is the agreed room price, not money collected.
        </p>
      </div>

      <RangeForm range={range} />

      {inverted ? (
        <p className="text-sm text-coral">&ldquo;From&rdquo; must be on or before &ldquo;To&rdquo;.</p>
      ) : (
        <>
          <TopProductionSection result={topProduction!} />
          <MarketSegmentSection result={marketSegment!} />
        </>
      )}
    </div>
  );
}

type Loaded<T> = { ok: true; data: T } | { ok: false; error: string };

async function load<T>(path: string): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await backendJson<T>(path, { auth: true }) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't load this report." };
  }
}

function RangeForm({ range }: { range: ReportRange }) {
  const inputClass =
    "bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral";
  return (
    <form method="get" className="flex flex-wrap items-end gap-3 mb-8">
      <div>
        <label className="eyebrow text-cream/60 block mb-1">From</label>
        <input type="date" name="from" defaultValue={range.from} className={inputClass} />
      </div>
      <div>
        <label className="eyebrow text-cream/60 block mb-1">To</label>
        <input type="date" name="to" defaultValue={range.to} className={inputClass} />
      </div>
      <button type="submit" className="rounded-full border border-cream/20 hover:border-coral px-4 py-2 text-sm">
        View
      </button>
    </form>
  );
}

function SectionHeader({ title, hint }: { title: string; hint: string }) {
  return (
    <>
      <h2 className="font-display italic text-xl mb-1">{title}</h2>
      <p className="text-xs text-cream/40 mb-3">{hint}</p>
    </>
  );
}

const th = "px-4 py-2 font-normal eyebrow text-cream/50";
const td = "px-4 py-2";

function Share({ percent }: { percent: string | null }) {
  return <span className="text-xs text-cream/40 ml-2">{formatPercent(percent)}</span>;
}

function TopProductionSection({ result }: { result: Loaded<TopProductionReport> }) {
  return (
    <section className="mb-8">
      <SectionHeader
        title="Top production"
        hint="One row per channel, plus complimentary and house-use stays whatever their channel. Most room-nights first."
      />
      {!result.ok ? (
        <p className="text-sm text-coral">Couldn&apos;t load top production: {result.error}</p>
      ) : result.data.producers.length === 0 ? (
        <p className="text-sm text-cream/60">No room-nights in this range.</p>
      ) : (
        <div className="border border-cream/10 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="border-b border-cream/10">
                <th className={th}>#</th>
                <th className={th}>Producer</th>
                <th className={`${th} text-right`}>Room-nights</th>
                <th className={`${th} text-right`}>Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream/10">
              {result.data.producers.map((row, i) => (
                <tr key={row.producer ?? i}>
                  <td className={`${td} text-cream/40`}>{i + 1}</td>
                  <td className={td}>{row.label}</td>
                  <td className={`${td} text-right whitespace-nowrap`}>
                    {row.roomNights}
                    <Share percent={row.roomNightsPercent} />
                  </td>
                  <td className={`${td} text-right whitespace-nowrap`}>
                    {formatBaht(row.revenue)}
                    <Share percent={row.revenuePercent} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-cream/20 font-medium">
                <td className={td} />
                <td className={td}>Total</td>
                <td className={`${td} text-right`}>{result.data.total.roomNights}</td>
                <td className={`${td} text-right`}>{formatBaht(result.data.total.revenue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

function MarketSegmentSection({ result }: { result: Loaded<MarketSegmentReport> }) {
  return (
    <section className="mb-8">
      <SectionHeader
        title="Market segment"
        hint="Guests is adults plus children, counted once per booking with a night in the range - parties, not guest-nights."
      />
      {!result.ok ? (
        <p className="text-sm text-coral">Couldn&apos;t load market segments: {result.error}</p>
      ) : (
        <div className="border border-cream/10 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="border-b border-cream/10">
                <th className={th}>Segment</th>
                <th className={`${th} text-right`}>Rooms</th>
                <th className={`${th} text-right`}>Guests</th>
                <th className={`${th} text-right`}>Revenue</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream/10">
              {result.data.segments.map((row) => (
                <SegmentRow key={row.segment} row={row} />
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-cream/20 font-medium">
                <td className={td}>Total</td>
                <td className={`${td} text-right`}>{result.data.total.roomNights}</td>
                <td className={`${td} text-right`}>{result.data.total.guests}</td>
                <td className={`${td} text-right`}>{formatBaht(result.data.total.revenue)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

function SegmentRow({ row }: { row: MarketSegmentRow }) {
  return (
    <tr>
      <td className={td}>
        <span className="text-cream/40 mr-2">{row.segment}</span>
        {row.segment ? MARKET_SEGMENT_LABELS[row.segment] : ""}
      </td>
      <td className={`${td} text-right whitespace-nowrap`}>
        {row.roomNights}
        <Share percent={row.roomNightsPercent} />
      </td>
      <td className={`${td} text-right whitespace-nowrap`}>
        {row.guests}
        <Share percent={row.guestsPercent} />
      </td>
      <td className={`${td} text-right whitespace-nowrap`}>
        {formatBaht(row.revenue)}
        <Share percent={row.revenuePercent} />
      </td>
    </tr>
  );
}
