import Link from "next/link";
import { getDashboardStats } from "@/lib/adminStats";
import StatCard from "@/components/admin/StatCard";

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(new Date());

export default async function AdminDashboardPage() {
  const stats = await getDashboardStats();

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Overview</p>
      <h1 className="font-display italic text-3xl mb-8">Dashboard</h1>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <StatCard label="Bookings today" value={String(stats.bookingsToday)} />
        <StatCard label="Bookings this week" value={String(stats.bookingsThisWeek)} sublabel="Rolling 7 days" />
        <StatCard
          label="Occupancy"
          value={`${stats.occupancyPct}%`}
          sublabel={`Next ${stats.occupancyWindowDays} days`}
        />
        <StatCard
          label="Room revenue (paid)"
          value={`฿${stats.revenueThisMonth.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
          sublabel={`${MONTH_LABEL}, by check-in date`}
        />
      </div>

      {/* POS numbers are kept in their own group, deliberately not summed
          with room revenue above: grandTotal already excludes room charges
          (they're a folio transfer, not money collected), and the pending
          room-charge figure is money that hasn't been collected at all yet
          — adding either to room revenue would double- or phantom-count it. */}
      {stats.posSummary.status === "ok" && (
        <div className="mt-8 pt-8 border-t border-cream/10">
          <p className="eyebrow text-cream/50 mb-4">POS</p>
          <div className="grid sm:grid-cols-2 gap-5">
            <StatCard
              label="POS revenue collected"
              value={`฿${Number(stats.posSummary.data.grandTotal).toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}`}
              sublabel={`${MONTH_LABEL} · cash + card + other — excludes room charges`}
            />
            <StatCard
              label="Charged to rooms, not yet collected"
              value={`฿${Number(stats.posSummary.data.totals.roomCharge).toLocaleString("en-US", {
                maximumFractionDigits: 0,
              })}`}
              sublabel="Not included in any revenue figure on this dashboard — reconcile against the folio at checkout (the booking page shows the amount due)"
            />
          </div>
        </div>
      )}

      {stats.posSummary.status === "error" && (
        <div className="mt-8 pt-8 border-t border-cream/10">
          <p className="eyebrow text-cream/50 mb-4">POS</p>
          <div className="bg-coral/10 border border-coral/30 rounded-xl p-5">
            <p className="text-coral text-sm font-medium">
              Couldn&rsquo;t load POS revenue for this period — check{" "}
              <Link href="/admin/pos/shifts" className="underline underline-offset-4">
                shifts
              </Link>{" "}
              directly if you need the numbers now.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
