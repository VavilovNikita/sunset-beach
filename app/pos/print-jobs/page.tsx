import { loadNotPrintedJobs } from "@/lib/printQueueServer";
import PosPrintQueue from "@/components/pos/PosPrintQueue";

export default async function PosPrintJobsPage() {
  // Opens on "Not printed" (FAILED + still-retrying PENDING) - the same set the floor banner
  // counts, so the number there is the number of rows here. A failed first load is an error page
  // (as before), not an empty list.
  const jobs = await loadNotPrintedJobs();
  if (jobs === null) throw new Error("Could not load print jobs.");

  return (
    <div>
      <div className="px-4 pt-4">
        <h1 className="font-display italic text-2xl">Print jobs</h1>
      </div>
      <PosPrintQueue initialJobs={jobs} initialFilter="NOT_PRINTED" />
    </div>
  );
}
