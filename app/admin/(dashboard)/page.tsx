import Link from "next/link";
import { redirect } from "next/navigation";
import { getDashboardStats } from "@/lib/adminStats";
import { getDashboardOps, type DashboardBlock } from "@/lib/dashboardOps";
import { STAFF_AREA_LABELS } from "@/lib/rosterGrid";
import { requireSessionUser } from "@/lib/rbac";
import StatCard from "@/components/admin/StatCard";

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", { month: "long", timeZone: "UTC" }).format(new Date());

// One compact card per operational block. "forbidden" renders nothing (a role-appropriate gap,
// same as the money blocks); "error" says so in-place rather than taking the page down.
function OpsCard<T>({
  label,
  href,
  block,
  children,
}: {
  label: string;
  href: string;
  block: DashboardBlock<T>;
  children: (data: T) => React.ReactNode;
}) {
  if (block.status === "forbidden") return null;
  return (
    <Link href={href} className="block bg-ink2/40 border border-cream/10 hover:border-cream/25 transition-colors rounded-xl p-5">
      <p className="eyebrow text-cream/50">{label}</p>
      {block.status === "ok" ? children(block.data) : <p className="mt-2 text-sm text-coral">Couldn&rsquo;t load — open to check.</p>}
    </Link>
  );
}

export default async function AdminDashboardPage() {
  // Every figure below needs a CASHIER+ read (see getDashboardStats/adminStats.ts) - for a
  // WAITER there is nothing this page can ever show, "forbidden" both times, so land them on
  // their own base instead of a heading with nothing under it. Not reachable from the sidebar
  // any more (see AdminSidebar), but a bookmark or a typed URL still could be.
  const user = await requireSessionUser();
  if (user.role === "WAITER") redirect("/admin/pos");

  const [stats, ops] = await Promise.all([getDashboardStats(), getDashboardOps()]);
  const anyOpsVisible = [ops.shiftBoard, ops.coverage, ops.devices, ops.maintenance].some((b) => b.status !== "forbidden");

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Overview</p>
      <h1 className="font-display italic text-3xl mb-8">Dashboard</h1>

      {stats.roomStats.status === "ok" && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          <StatCard label="Bookings today" value={String(stats.roomStats.bookingsToday)} />
          <StatCard
            label="Bookings this week"
            value={String(stats.roomStats.bookingsThisWeek)}
            sublabel="Rolling 7 days"
          />
          <StatCard
            label="Occupancy"
            value={`${stats.roomStats.occupancyPct}%`}
            sublabel={`Next ${stats.occupancyWindowDays} days`}
          />
          <StatCard
            label="Room revenue (paid)"
            value={`฿${stats.roomStats.revenueThisMonth.toLocaleString("en-US", { maximumFractionDigits: 0 })}`}
            sublabel={`${MONTH_LABEL}, by check-in date`}
          />
        </div>
      )}

      {/* "forbidden" (a WAITER, below the CASHIER+ these figures require) renders nothing here,
          same as the POS block below — a role-appropriate gap, not a failure to explain. */}
      {stats.roomStats.status === "error" && (
        <div className="bg-coral/10 border border-coral/30 rounded-xl p-5">
          <p className="text-coral text-sm font-medium">
            Couldn&rsquo;t load booking/occupancy figures — check{" "}
            <Link href="/admin/bookings" className="underline underline-offset-4">
              bookings
            </Link>{" "}
            directly if you need them now.
          </p>
        </div>
      )}

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

      {anyOpsVisible && (
        <div className="mt-8 pt-8 border-t border-cream/10">
          <p className="eyebrow text-cream/50 mb-4">Today</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
            <OpsCard label="On shift now" href="/admin/roster?tab=today" block={ops.shiftBoard}>
              {(d) => (
                <>
                  <p className="mt-2 font-display italic text-3xl text-coral">{d.onShift}</p>
                  <p className="mt-1 text-xs text-cream/40">
                    of {d.scheduledToday} rostered today
                    {d.late > 0 && <span className="text-amber-400"> · {d.late} late</span>}
                    {d.missed > 0 && <span className="text-coral"> · {d.missed} missed</span>}
                  </p>
                </>
              )}
            </OpsCard>

            <OpsCard label="Staffing gaps today" href="/admin/roster" block={ops.coverage}>
              {(warnings) =>
                warnings.length === 0 ? (
                  <>
                    <p className="mt-2 font-display italic text-3xl text-cream/60">0</p>
                    <p className="mt-1 text-xs text-cream/40">Every department at its minimum</p>
                  </>
                ) : (
                  <>
                    <p className="mt-2 font-display italic text-3xl text-amber-400">{warnings.length}</p>
                    <ul className="mt-1 text-xs text-cream/50 space-y-0.5">
                      {warnings.map((w) => (
                        <li key={w.staffArea}>
                          {STAFF_AREA_LABELS[w.staffArea]}: {w.workingCount} of {w.minimumWorking}
                        </li>
                      ))}
                    </ul>
                  </>
                )
              }
            </OpsCard>

            <OpsCard label="Fingerprint terminals" href="/admin/attendance-devices" block={ops.devices}>
              {(d) =>
                d.quiet.length === 0 ? (
                  <>
                    <p className="mt-2 font-display italic text-3xl text-cream/60">{d.active === 0 ? "—" : "OK"}</p>
                    <p className="mt-1 text-xs text-cream/40">
                      {d.active === 0 ? "No active terminals" : `${d.active} active, all reporting`}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="mt-2 font-display italic text-3xl text-coral">{d.quiet.length} quiet</p>
                    <ul className="mt-1 text-xs text-cream/50 space-y-0.5">
                      {d.quiet.map((q) => (
                        <li key={q.name}>
                          {q.name}: {q.neverReached ? "never reached" : "silent over 24h"}
                        </li>
                      ))}
                    </ul>
                  </>
                )
              }
            </OpsCard>

            <OpsCard label="Maintenance" href="/admin/maintenance" block={ops.maintenance}>
              {(m) => (
                <>
                  <p className={`mt-2 font-display italic text-3xl ${m.open + m.inProgress > 0 ? "text-coral" : "text-cream/60"}`}>
                    {m.open + m.inProgress}
                  </p>
                  <p className="mt-1 text-xs text-cream/40">
                    {m.open} open · {m.inProgress} in progress
                    {m.blockingRooms > 0 && ` · ${m.blockingRooms} with a room blocked`}
                  </p>
                </>
              )}
            </OpsCard>
          </div>
        </div>
      )}
    </div>
  );
}
