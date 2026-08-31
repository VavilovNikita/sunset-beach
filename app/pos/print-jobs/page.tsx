import { backendJson } from "@/lib/backendServer";
import PosPrintQueue from "@/components/pos/PosPrintQueue";
import type { PrintJob } from "@/lib/posTypes";

export default async function PosPrintJobsPage() {
  const jobs = await backendJson<PrintJob[]>("/print-jobs?status=FAILED", { auth: true });

  return (
    <div>
      <div className="px-4 pt-4">
        <h1 className="font-display italic text-2xl">Print jobs</h1>
      </div>
      <PosPrintQueue initialJobs={jobs} initialFilter="FAILED" />
    </div>
  );
}
