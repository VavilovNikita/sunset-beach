"use client";

import { useState } from "react";
import Link from "next/link";
import { ADMIN_API_URL } from "@/lib/backend";
import { usePolling } from "@/lib/usePolling";
import type { PrintJob } from "@/lib/posTypes";

// An unprinted ticket is an unserved dish — this needs to be seen the moment
// staff look at the board, not just by whoever happens to open
// /admin/pos/print-jobs on their own. GET /print-jobs is role-scoped
// server-side (WAITER/CASHIER only ever see their own kitchen-ticket/prebill
// failures, MANAGER+ sees everything), so this polls the same way any staff
// member would and shows exactly what they're allowed to see — no client-side
// filtering on top of that.
//
// `count === null` means "couldn't check" (initial SSR fetch failed, or a
// poll hasn't succeeded yet) and is shown as its own state rather than
// treated as zero — collapsing the two would read as "no failures" during
// exactly the kind of outage (print backend down/restarting) most likely to
// also mean prints are actually failing.
export default function FailedPrintJobsBadge({ initialCount }: { initialCount: number | null }) {
  const [count, setCount] = useState<number | null>(initialCount);

  async function refetch() {
    const res = await fetch(`${ADMIN_API_URL}/print-jobs?status=FAILED`, { credentials: "include" });
    if (res.ok) {
      const jobs: PrintJob[] = await res.json();
      setCount(jobs.length);
    }
    // Leave `count` as-is on failure — a transient poll miss shouldn't wipe
    // out the last known-good reading, only the very first (SSR) load has no
    // prior value to fall back on.
  }

  usePolling(refetch, 15000);

  if (count === null) {
    return (
      <Link
        href="/admin/pos/print-jobs"
        className="flex items-center gap-2 rounded-full bg-cream/10 text-cream/60 px-4 py-2 text-sm font-medium hover:text-cream transition-colors"
      >
        <span className="w-2 h-2 rounded-full bg-cream/40" />
        Print status unavailable — check queue
      </Link>
    );
  }

  if (count === 0) return null;

  return (
    <Link
      href="/admin/pos/print-jobs"
      className="flex items-center gap-2 rounded-full bg-coral/15 text-coral px-4 py-2 text-sm font-medium hover:bg-coral/25 transition-colors"
    >
      <span className="w-2 h-2 rounded-full bg-coral" />
      {count} failed print {count === 1 ? "job" : "jobs"} — a ticket may not have reached the kitchen/bar
    </Link>
  );
}
