import { backendJson, backendJsonOrDefault } from "@/lib/backendServer";
import PosTableBoard from "@/components/pos/PosTableBoard";
import PosFailedPrintBanner from "@/components/pos/PosFailedPrintBanner";
import type { Order, Table, PrintJob } from "@/lib/posTypes";

export default async function PosHomePage() {
  const [tables, openOrders, sentOrders, failedPrintJobs] = await Promise.all([
    backendJson<Table[]>("/tables", { auth: true }),
    backendJson<Order[]>("/orders?status=OPEN", { auth: true }),
    backendJson<Order[]>("/orders?status=SENT", { auth: true }),
    // A restarting/unreachable print backend must never take this screen down with it - `null`
    // (not `[]`) on failure so the banner can tell "couldn't check" apart from "zero failures".
    backendJsonOrDefault<PrintJob[] | null>("/print-jobs?status=FAILED", null, { auth: true }),
  ]);

  return (
    <div>
      <PosFailedPrintBanner initialCount={failedPrintJobs?.length ?? null} />
      <PosTableBoard initialTables={tables} initialOrders={[...openOrders, ...sentOrders]} />
    </div>
  );
}
