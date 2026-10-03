import { backendJson } from "@/lib/backendServer";
import { loadNotPrintedJobs } from "@/lib/printQueueServer";
import { summarizeNotPrinted } from "@/lib/printQueue";
import PosTableBoard from "@/components/pos/PosTableBoard";
import PosFailedPrintBanner from "@/components/pos/PosFailedPrintBanner";
import type { Order, Table } from "@/lib/posTypes";

export default async function PosHomePage() {
  const [tables, openOrders, sentOrders, notPrintedJobs] = await Promise.all([
    backendJson<Table[]>("/tables", { auth: true }),
    backendJson<Order[]>("/orders?status=OPEN", { auth: true }),
    backendJson<Order[]>("/orders?status=SENT", { auth: true }),
    // A restarting/unreachable print backend must never take this screen down with it - `null`
    // (not `[]`) on failure so the banner can tell "couldn't check" apart from "nothing waiting".
    loadNotPrintedJobs(),
  ]);

  return (
    <div>
      <PosFailedPrintBanner initialSummary={notPrintedJobs ? summarizeNotPrinted(notPrintedJobs) : null} />
      <PosTableBoard initialTables={tables} initialOrders={[...openOrders, ...sentOrders]} />
    </div>
  );
}
