import Link from "next/link";
import { requireRoleAtLeast } from "@/lib/rbac";
import { hotelDateKey } from "@/lib/dashboardOps";
import { parseNightAuditDateParam } from "@/lib/nightAudit";
import {
  GUEST_LTV_LIMIT_OPTIONS,
  isRangeInverted,
  parseGuestLtvLimit,
  parseReportRange,
  type ReportRange,
} from "@/lib/reports";
import {
  REPORT_TABS,
  parseReportTab,
  reportsHiddenFields,
  reportsHref,
  type ReportsParamName,
  type ReportsState,
} from "@/lib/reportsTabs";
import ManagerReportView from "@/components/admin/ManagerReportView";
import {
  GuestLtvSection,
  MarketSegmentSection,
  OccupancySection,
  SalesMixSection,
  TopProductionSection,
  load,
} from "@/components/admin/reports/sections";
import type {
  GuestLtvReport,
  ManagerReport,
  MarketSegmentReport,
  OccupancyReport,
  PosSalesMixReport,
  TopProductionReport,
} from "@/lib/types";

// Every report here is MANAGER+ (same floor as the revenue export), one report per tab, and a tab
// loads only its own report - one failing shows its error on its own tab. Parameters: the manager
// report has ?date=, occupancy / top production / market segment / sales mix share ?from=&to=,
// guest LTV has ?limit=. All of them stay in the address across tabs, and each tab's form sends
// the others as hidden inputs, so changing one never resets another. Every figure is the server's;
// nothing is summed here.
export default async function ReportsPage({
  searchParams,
}: {
  searchParams: { tab?: string; date?: string; from?: string; to?: string; limit?: string };
}) {
  await requireRoleAtLeast("MANAGER");

  const tab = parseReportTab(searchParams.tab);
  const date = parseNightAuditDateParam(searchParams.date);
  const range = parseReportRange(searchParams.from, searchParams.to, hotelDateKey(new Date()));
  const limit = parseGuestLtvLimit(searchParams.limit);

  // Only what somebody actually chose goes into the address; the rest keeps its server default.
  const state: ReportsState = {
    tab,
    date: date ?? undefined,
    from: searchParams.from && searchParams.to ? range.from : undefined,
    to: searchParams.from && searchParams.to ? range.to : undefined,
    limit: searchParams.limit ? String(limit) : undefined,
  };

  let content: React.ReactNode;
  if (tab === "manager") {
    const report = await load<ManagerReport>(date ? `/reports/manager?date=${date}` : "/reports/manager");
    content = (
      <>
        <p className="text-sm text-cream/60 mb-6">
          One night&apos;s rooms, guests, bookings and room revenue, beside the same calendar date last year. Room
          revenue is the agreed room price, not money collected.
        </p>
        <form method="get" className="flex items-end gap-3 mb-8">
          <HiddenFields state={state} own={["date"]} />
          <div>
            <label className="eyebrow text-cream/60 block mb-1">Night of</label>
            <input
              type="date"
              name="date"
              defaultValue={report.ok ? report.data.date : date ?? undefined}
              className={inputClass}
            />
          </div>
          <button type="submit" className="rounded-full border border-cream/20 hover:border-coral px-4 py-2 text-sm">
            View
          </button>
          {date && (
            <Link href={reportsHref(state, { date: undefined })} className="text-sm text-cream/60 hover:text-coral py-2">
              Today
            </Link>
          )}
        </form>
        {report.ok ? (
          <ManagerReportView report={report.data} />
        ) : (
          <p className="text-sm text-coral">Couldn&apos;t load the manager report: {report.error}</p>
        )}
      </>
    );
  } else if (tab === "guests") {
    const result = await load<GuestLtvReport>(`/reports/guest-ltv?limit=${limit}`);
    content = (
      <>
        <form method="get" className="flex flex-wrap items-end gap-3 mb-6">
          <HiddenFields state={state} own={["limit"]} />
          <div>
            <label className="eyebrow text-cream/60 block mb-1">Show top</label>
            <select name="limit" defaultValue={limit} className="bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm">
              {GUEST_LTV_LIMIT_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} guests
                </option>
              ))}
            </select>
          </div>
          <button type="submit" className="rounded-full border border-cream/20 hover:border-coral px-4 py-2 text-sm">
            View
          </button>
        </form>
        <GuestLtvSection result={result} />
      </>
    );
  } else {
    const query = `from=${range.from}&to=${range.to}`;
    const inverted = isRangeInverted(range);
    let report: React.ReactNode = null;
    if (!inverted) {
      if (tab === "occupancy") report = <OccupancySection result={await load<OccupancyReport>(`/reports/occupancy?${query}`)} />;
      else if (tab === "production")
        report = <TopProductionSection result={await load<TopProductionReport>(`/reports/top-production?${query}`)} />;
      else if (tab === "segments")
        report = <MarketSegmentSection result={await load<MarketSegmentReport>(`/reports/market-segment?${query}`)} />;
      else report = <SalesMixSection result={await load<PosSalesMixReport>(`/reports/pos-sales-mix?${query}`)} />;
    }
    content = (
      <>
        {tab !== "sales" && (
          <p className="text-sm text-cream/60 mb-6">
            Room reports count every night of every booking that isn&apos;t cancelled, with both dates included as
            nights. Room revenue is the agreed room price, not money collected.
          </p>
        )}
        <RangeForm state={state} range={range} />
        {inverted ? (
          <p className="text-sm text-coral mb-8">&ldquo;From&rdquo; must be on or before &ldquo;To&rdquo;.</p>
        ) : (
          report
        )}
      </>
    );
  }

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <p className="eyebrow text-sea mb-2">Reports</p>
        <h1 className="font-display italic text-3xl">Reports</h1>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-cream/10 mb-6">
        {REPORT_TABS.map((t) => (
          <Link
            key={t.key}
            href={reportsHref(state, { tab: t.key })}
            className={`px-4 py-2 text-sm rounded-t-lg transition-colors ${
              tab === t.key ? "bg-ink2 text-coral" : "text-cream/60 hover:text-cream"
            }`}
          >
            {t.label}
          </Link>
        ))}
      </div>

      {content}
    </div>
  );
}

const inputClass = "bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral";

function HiddenFields({ state, own }: { state: ReportsState; own: ReportsParamName[] }) {
  return (
    <>
      {reportsHiddenFields(state, own).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
    </>
  );
}

function RangeForm({ state, range }: { state: ReportsState; range: ReportRange }) {
  return (
    <form method="get" className="flex flex-wrap items-end gap-3 mb-8">
      <HiddenFields state={state} own={["from", "to"]} />
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
