"use client";

import { useState } from "react";
import Link from "next/link";
import { usePolling } from "@/lib/usePolling";
import { fetchPrintJobs } from "@/lib/pos/printJobsClient";

// Full-width and on the main screen itself, not a small corner badge (a waiter needs this the
// moment they look at the board — an unprinted kitchen ticket is a dish nobody's cooking yet).
// `count === null` means "couldn't check", kept as its own state rather than folded into zero:
// a print backend that's down or restarting is exactly the situation where prints might also be
// silently failing, so "no failures" and "couldn't tell" must never look the same.
export default function PosFailedPrintBanner({ initialCount }: { initialCount: number | null }) {
  const [count, setCount] = useState<number | null>(initialCount);

  async function refetch() {
    const result = await fetchPrintJobs("FAILED");
    if (result.ok) setCount(result.data.length);
    // Leave count as-is on a failed poll — a transient miss shouldn't erase the last known-good
    // reading, only the very first load has nothing to fall back on.
  }

  usePolling(refetch, 15000);

  if (count === null) {
    return (
      <Link
        href="/pos/print-jobs"
        className="flex items-center justify-center gap-2 bg-cream/10 text-cream/60 px-4 py-3 text-sm font-medium active:bg-cream/15 transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-cream/40 shrink-0" />
        Print status unavailable — check queue
      </Link>
    );
  }

  if (count === 0) return null;

  return (
    <Link
      href="/pos/print-jobs"
      className="flex items-center justify-center gap-2 bg-coral text-ink px-4 py-3 text-sm font-semibold active:bg-coraldeep transition-colors"
    >
      <span className="w-2 h-2 rounded-full bg-ink shrink-0" />
      {count} failed print {count === 1 ? "job" : "jobs"} — a ticket may not have reached the kitchen/bar
    </Link>
  );
}
