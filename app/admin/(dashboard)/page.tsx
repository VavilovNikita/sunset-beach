import { getDashboardStats } from "@/lib/bookings";
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
          label="Revenue (paid)"
          value={`฿${stats.revenueThisMonth.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
          sublabel={`${MONTH_LABEL}, by check-in date`}
        />
      </div>
    </div>
  );
}
