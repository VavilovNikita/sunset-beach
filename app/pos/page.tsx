import { backendJson, backendJsonOrDefault } from "@/lib/backendServer";
import { getSessionUser, hasRoleAtLeast } from "@/lib/rbac";
import { isLongOpenShift } from "@/lib/shiftReconciliation";
import LongOpenShiftNotice from "@/components/LongOpenShiftNotice";
import { loadNotPrintedJobs } from "@/lib/printQueueServer";
import { summarizeNotPrinted } from "@/lib/printQueue";
import PosTableBoard from "@/components/pos/PosTableBoard";
import PosFailedPrintBanner from "@/components/pos/PosFailedPrintBanner";
import type { Order, ShiftSummary, Table } from "@/lib/posTypes";

export default async function PosHomePage() {
  const [user, tables, openOrders, sentOrders, notPrintedJobs] = await Promise.all([
    getSessionUser(),
    backendJson<Table[]>("/tables", { auth: true }),
    backendJson<Order[]>("/orders?status=OPEN", { auth: true }),
    backendJson<Order[]>("/orders?status=SENT", { auth: true }),
    // A restarting/unreachable print backend must never take this screen down with it - `null`
    // (not `[]`) on failure so the banner can tell "couldn't check" apart from "nothing waiting".
    loadNotPrintedJobs(),
  ]);

  // The phone's own cash shift, flagged once it has been open over a day (see the admin board for
  // the same notice). GET /shifts/current is CASHIER+; a waiter has no drawer to flag.
  const now = new Date();
  const currentShift =
    user && hasRoleAtLeast(user.role, "CASHIER")
      ? await backendJsonOrDefault<ShiftSummary | null>("/shifts/current", null, { auth: true })
      : null;

  return (
    <div>
      <div className="px-4 pt-4 empty:hidden">
        <LongOpenShiftNotice shifts={currentShift && isLongOpenShift(currentShift, now) ? [currentShift] : []} now={now} shiftsHref="/pos/shifts" />
      </div>
      <PosFailedPrintBanner initialSummary={notPrintedJobs ? summarizeNotPrinted(notPrintedJobs) : null} />
      <PosTableBoard initialTables={tables} initialOrders={[...openOrders, ...sentOrders]} />
    </div>
  );
}
