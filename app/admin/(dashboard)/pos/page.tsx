import Link from "next/link";
import OrderBoard from "@/components/admin/pos/OrderBoard";
import TableManager from "@/components/admin/pos/TableManager";
import FailedPrintJobsBadge from "@/components/admin/pos/FailedPrintJobsBadge";
import LongOpenShiftNotice from "@/components/LongOpenShiftNotice";
import { backendJson, backendJsonOrDefault } from "@/lib/backendServer";
import { hotelDateKey } from "@/lib/hotelDate";
import { isLongOpenShift } from "@/lib/shiftReconciliation";
import { loadNotPrintedJobs } from "@/lib/printQueueServer";
import { summarizeNotPrinted } from "@/lib/printQueue";
import { getSessionUser, hasRoleAtLeast } from "@/lib/rbac";
import type { Order, ShiftListItem, ShiftSummary, Table } from "@/lib/posTypes";

export default async function AdminPosPage() {
  const [user, tables, openOrders, sentOrders, notPrintedJobs] = await Promise.all([
    getSessionUser(),
    backendJson<Table[]>("/tables", { auth: true }),
    backendJson<Order[]>("/orders?status=OPEN", { auth: true }),
    backendJson<Order[]>("/orders?status=SENT", { auth: true }),
    // Printing is ancillary to running the floor — this screen is the one
    // staff actually work orders from, so a broken/restarting print backend
    // must never take it down. `null` (not `[]`) on failure: the badge needs
    // to tell "couldn't check" apart from "checked, zero failures", since
    // the former is a case where prints might well be silently failing too.
    loadNotPrintedJobs(),
  ]);
  const canManageTables = !!user && hasRoleAtLeast(user.role, "MANAGER");
  // Spa tables live on their own screen now (/admin/spa/tables) - a treatment table was never
  // really part of the restaurant floor, and showing it here too would just be a second, stale-
  // prone place to find the same row. Orders against a SPA table (and billing a treatment to
  // one) are unaffected - this only hides the tile/management row, not the underlying Table or
  // any order tied to it.
  const restaurantTables = tables.filter((t) => t.zone !== "SPA");

  // A cash shift left open for over a day (lib/shiftReconciliation.ts#isLongOpenShift). A manager
  // sees anyone's (GET /shifts, MANAGER+, bounded to a year back so the board doesn't pull every
  // shift ever); a cashier sees their own (GET /shifts/current). Secondary - a failed read just
  // shows nothing.
  const now = new Date();
  const isManager = !!user && hasRoleAtLeast(user.role, "MANAGER");
  const isCashier = !!user && hasRoleAtLeast(user.role, "CASHIER");
  const candidateShifts: (ShiftListItem | ShiftSummary)[] = isManager
    ? await backendJsonOrDefault<ShiftListItem[]>(`/shifts?from=${hotelDateKey(new Date(now.getTime() - 365 * 86400_000))}`, [], { auth: true })
    : isCashier
      ? [await backendJsonOrDefault<ShiftSummary | null>("/shifts/current", null, { auth: true })].filter((s): s is ShiftSummary => s !== null)
      : [];
  const longOpenShifts = candidateShifts.filter((s) => isLongOpenShift(s, now));

  return (
    <div>
      <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
        <div>
          <p className="eyebrow text-sea mb-2">Restaurant</p>
          <h1 className="font-display italic text-3xl">Tables &amp; tickets</h1>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin/pos/map" className="text-sm text-sea hover:text-coral transition-colors underline underline-offset-4">
            Floor map →
          </Link>
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
          <FailedPrintJobsBadge initialSummary={notPrintedJobs ? summarizeNotPrinted(notPrintedJobs) : null} />
        </div>
      </div>

      <LongOpenShiftNotice shifts={longOpenShifts} now={now} shiftsHref={isManager ? "/admin/pos/shifts/history" : "/admin/pos/shifts"} />
      <OrderBoard initialTables={restaurantTables} initialOrders={[...openOrders, ...sentOrders]} />
      <TableManager initialTables={restaurantTables} canManage={canManageTables} zones={["RESTAURANT", "BAR", "POOL", "ROOM_SERVICE"]} />
    </div>
  );
}
