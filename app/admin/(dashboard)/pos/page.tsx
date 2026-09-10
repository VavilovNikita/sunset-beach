import Link from "next/link";
import OrderBoard from "@/components/admin/pos/OrderBoard";
import TableManager from "@/components/admin/pos/TableManager";
import FailedPrintJobsBadge from "@/components/admin/pos/FailedPrintJobsBadge";
import { backendJson, backendJsonOrDefault } from "@/lib/backendServer";
import { getSessionUser, hasRoleAtLeast } from "@/lib/rbac";
import type { Order, Table, PrintJob } from "@/lib/posTypes";

export default async function AdminPosPage() {
  const [user, tables, openOrders, sentOrders, failedPrintJobs] = await Promise.all([
    getSessionUser(),
    backendJson<Table[]>("/tables", { auth: true }),
    backendJson<Order[]>("/orders?status=OPEN", { auth: true }),
    backendJson<Order[]>("/orders?status=SENT", { auth: true }),
    // Printing is ancillary to running the floor — this screen is the one
    // staff actually work orders from, so a broken/restarting print backend
    // must never take it down. `null` (not `[]`) on failure: the badge needs
    // to tell "couldn't check" apart from "checked, zero failures", since
    // the former is a case where prints might well be silently failing too.
    backendJsonOrDefault<PrintJob[] | null>("/print-jobs?status=FAILED", null, { auth: true }),
  ]);
  const canManageTables = !!user && hasRoleAtLeast(user.role, "MANAGER");
  // Spa tables live on their own screen now (/admin/spa/tables) - a treatment table was never
  // really part of the restaurant floor, and showing it here too would just be a second, stale-
  // prone place to find the same row. Orders against a SPA table (and billing a treatment to
  // one) are unaffected - this only hides the tile/management row, not the underlying Table or
  // any order tied to it.
  const restaurantTables = tables.filter((t) => t.zone !== "SPA");

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
        <div>
          <p className="eyebrow text-sea mb-2">POS</p>
          <h1 className="font-display italic text-3xl">Tables &amp; tickets</h1>
        </div>
        <div className="flex items-center gap-4">
          {/* PAID/CANCELLED orders vanish from this live board on purpose (see OrderBoard's
              status=OPEN/SENT fetch) - this is the only way back to one after the fact. */}
          {canManageTables && (
            <Link
              href="/admin/pos/orders"
              className="text-sm text-sea hover:text-coral transition-colors underline underline-offset-4"
            >
              Order history →
            </Link>
          )}
          <FailedPrintJobsBadge initialCount={failedPrintJobs?.length ?? null} />
        </div>
      </div>

      <OrderBoard initialTables={restaurantTables} initialOrders={[...openOrders, ...sentOrders]} />
      <TableManager initialTables={restaurantTables} canManage={canManageTables} zones={["RESTAURANT", "BAR", "POOL", "ROOM_SERVICE"]} />
    </div>
  );
}
