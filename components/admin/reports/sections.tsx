import Link from "next/link";
import { backendJson } from "@/lib/backendServer";
import {
  MARKET_SEGMENT_LABELS,
  SALES_MIX_DEPARTMENT_LABELS,
  formatBaht,
  formatBahtOrDash,
  formatPercent,
} from "@/lib/reports";
import type {
  GuestLtvReport,
  MarketSegmentReport,
  MarketSegmentRow,
  OccupancyReport,
  OccupancyReportRow,
  PosSalesMixReport,
  TopProductionReport,
} from "@/lib/types";

// The report tables of /admin/reports, one section per tab. Every figure, share and ratio is the
// server's; nothing is summed here. Each tab loads only its own report, so a failure shows its own
// error on its own tab.

export type Loaded<T> = { ok: true; data: T } | { ok: false; error: string };

export async function load<T>(path: string): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await backendJson<T>(path, { auth: true }) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Couldn't load this report." };
  }
}

export function SectionHeader({ title, hint }: { title: string; hint: string }) {
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

export function OccupancySection({ result }: { result: Loaded<OccupancyReport> }) {
  return (
    <section className="mb-8">
      <SectionHeader
        title="Occupancy, ADR and RevPAR"
        hint="One set of figures for the whole range, per room type and for the property. ADR is room revenue per night sold; RevPAR is room revenue per night available."
      />
      {!result.ok ? (
        <p className="text-sm text-coral">Couldn&apos;t load occupancy: {result.error}</p>
      ) : (
        <>
          <div className="border border-cream/10 rounded-xl overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left">
                <tr className="border-b border-cream/10">
                  <th className={th}>Room type</th>
                  <th className={`${th} text-right`}>Occupancy</th>
                  <th className={`${th} text-right`}>Sold / available</th>
                  <th className={`${th} text-right`}>Revenue</th>
                  <th className={`${th} text-right`}>ADR</th>
                  <th className={`${th} text-right`}>RevPAR</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-cream/10">
                {result.data.rooms.map((row) => (
                  <OccupancyRow key={row.roomId} label={row.roomName ?? ""} row={row} />
                ))}
              </tbody>
              <tfoot>
                <OccupancyRow label="Total" row={result.data.total} className="border-t border-cream/20 font-medium" />
              </tfoot>
            </table>
          </div>
          <p className="text-xs text-cream/40 mt-2">
            Nights available is today&apos;s active rooms × {result.data.nights}{" "}
            {result.data.nights === 1 ? "night" : "nights"} - not a day-by-day history. A room added or taken out of
            service during the range counts as if it had always been in today&apos;s state, and blocked nights
            aren&apos;t subtracted, so occupancy and RevPAR for a past range are approximate.
          </p>
        </>
      )}
    </section>
  );
}

function OccupancyRow({ label, row, className }: { label: string; row: OccupancyReportRow; className?: string }) {
  return (
    <tr className={className}>
      <td className={td}>{label}</td>
      <td className={`${td} text-right`}>{formatPercent(row.occupancyPercent)}</td>
      <td className={`${td} text-right whitespace-nowrap`}>
        {row.roomNightsSold} / {row.roomNightsAvailable}
      </td>
      <td className={`${td} text-right whitespace-nowrap`}>{formatBaht(row.roomRevenue)}</td>
      <td className={`${td} text-right whitespace-nowrap`}>{formatBahtOrDash(row.adr)}</td>
      <td className={`${td} text-right whitespace-nowrap`}>{formatBahtOrDash(row.revpar)}</td>
    </tr>
  );
}

export function TopProductionSection({ result }: { result: Loaded<TopProductionReport> }) {
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

export function MarketSegmentSection({ result }: { result: Loaded<MarketSegmentReport> }) {
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

export function SalesMixSection({ result }: { result: Loaded<PosSalesMixReport> }) {
  return (
    <section className="mb-8">
      <SectionHeader
        title="POS sales mix"
        hint="Items on paid orders, by the day they were paid - room charges included. Revenue is the price on the order, not today's menu price; names and groupings are the menu's current ones."
      />
      {!result.ok ? (
        <p className="text-sm text-coral">Couldn&apos;t load the sales mix: {result.error}</p>
      ) : result.data.items.length === 0 ? (
        <p className="text-sm text-cream/60">No paid orders in this range.</p>
      ) : (
        <div className="space-y-4">
          <MixTable
            heading="Department"
            rows={result.data.departments.map((d) => ({
              key: d.department,
              label: SALES_MIX_DEPARTMENT_LABELS[d.department],
              quantity: d.quantity,
              revenue: d.revenue,
            }))}
            totalQuantity={result.data.totalQuantity}
            totalRevenue={result.data.totalRevenue}
          />
          <MixTable
            heading="Category"
            rows={result.data.categories.map((c) => ({
              key: c.category,
              label: c.category,
              quantity: c.quantity,
              revenue: c.revenue,
            }))}
            totalQuantity={result.data.totalQuantity}
            totalRevenue={result.data.totalRevenue}
          />
          <details>
            <summary className="cursor-pointer text-sm text-sea hover:text-coral transition-colors mb-3">
              All {result.data.items.length} items
            </summary>
            <MixTable
              heading="Item"
              rows={result.data.items.map((item) => ({
                key: item.menuItemId,
                label: item.name,
                detail: `${item.category} · ${SALES_MIX_DEPARTMENT_LABELS[item.department]}`,
                quantity: item.quantity,
                revenue: item.revenue,
              }))}
              totalQuantity={result.data.totalQuantity}
              totalRevenue={result.data.totalRevenue}
            />
          </details>
        </div>
      )}
    </section>
  );
}

type MixRow = { key: string; label: string; detail?: string; quantity: number; revenue: string };

function MixTable({
  heading,
  rows,
  totalQuantity,
  totalRevenue,
}: {
  heading: string;
  rows: MixRow[];
  totalQuantity: number;
  totalRevenue: string;
}) {
  return (
    <div className="border border-cream/10 rounded-xl overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left">
          <tr className="border-b border-cream/10">
            <th className={th}>{heading}</th>
            <th className={`${th} text-right`}>Qty</th>
            <th className={`${th} text-right`}>Revenue</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-cream/10">
          {rows.map((row) => (
            <tr key={row.key}>
              <td className={td}>
                {row.label}
                {row.detail && <span className="text-xs text-cream/40 ml-2">{row.detail}</span>}
              </td>
              <td className={`${td} text-right`}>{row.quantity}</td>
              <td className={`${td} text-right whitespace-nowrap`}>{formatBaht(row.revenue)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t border-cream/20 font-medium">
            <td className={td}>Total</td>
            <td className={`${td} text-right`}>{totalQuantity}</td>
            <td className={`${td} text-right whitespace-nowrap`}>{formatBaht(totalRevenue)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// Lifetime, so it takes no from/to of its own - its tab has only the "show top" form.
export function GuestLtvSection({ result }: { result: Loaded<GuestLtvReport> }) {
  return (
    <section className="mb-8">
      <SectionHeader
        title="Guest lifetime value"
        hint="Every booking ever made, future ones included - not affected by the dates above. Only bookings linked to a guest card count, cancelled ones excluded. Ranked by room revenue; room charges (POS orders charged to the room) are shown alongside but don't affect the rank."
      />
      {!result.ok ? (
        <p className="text-sm text-coral">Couldn&apos;t load guest lifetime value: {result.error}</p>
      ) : result.data.guests.length === 0 ? (
        <p className="text-sm text-cream/60">No guests with a linked, non-cancelled booking yet.</p>
      ) : (
        <div className="border border-cream/10 rounded-xl overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left">
              <tr className="border-b border-cream/10">
                <th className={th}>#</th>
                <th className={th}>Guest</th>
                <th className={`${th} text-right`}>Bookings</th>
                <th className={`${th} text-right`}>Nights</th>
                <th className={`${th} text-right`}>Room revenue</th>
                <th className={`${th} text-right`}>Room charges</th>
                <th className={th}>First stay</th>
                <th className={th}>Latest stay</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cream/10">
              {result.data.guests.map((row, i) => (
                <tr key={row.guestId}>
                  <td className={`${td} text-cream/40`}>{i + 1}</td>
                  <td className={td}>
                    <Link href={`/admin/guests/${row.guestId}`} className="text-sea hover:text-coral transition-colors">
                      {row.name}
                    </Link>
                    {row.email && <div className="text-xs text-cream/40">{row.email}</div>}
                  </td>
                  <td className={`${td} text-right`}>{row.bookingCount}</td>
                  <td className={`${td} text-right`}>{row.totalNights}</td>
                  <td className={`${td} text-right whitespace-nowrap`}>{formatBaht(row.roomRevenue)}</td>
                  <td className={`${td} text-right whitespace-nowrap text-cream/60`}>
                    {formatBaht(row.roomChargesTotal)}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>{row.firstCheckIn}</td>
                  <td className={`${td} whitespace-nowrap`}>{row.lastCheckIn}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
