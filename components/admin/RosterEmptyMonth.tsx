"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { copyRosterMonth, generateRosterMonth } from "@/lib/rosterClient";
import { previousMonthRange } from "@/lib/rosterGrid";
import { formatMonth } from "@/lib/formatDate";

// What the grid shows instead of a month of red coverage rows when nothing is rostered yet. The two buttons are the
// toolbar's own calls (both only ever fill empty cells - they never overwrite), with the same defaults: patterns, or
// the whole previous month by weekday. Anything finer (a narrower source range) stays in the toolbar.
export default function RosterEmptyMonth({ year, month, canEdit }: { year: number; month: number; canEdit: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"generate" | "copy" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const label = formatMonth(`${year}-${String(month).padStart(2, "0")}`);

  async function run(kind: "generate" | "copy") {
    setBusy(kind);
    setError(null);
    const result =
      kind === "generate"
        ? await generateRosterMonth(year, month)
        : await copyRosterMonth({ year, month, sourceFrom: previousMonthRange(year, month).from, sourceTo: previousMonthRange(year, month).to });
    setBusy(null);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="print:hidden rounded-xl border border-cream/15 bg-ink2/40 px-6 py-8 mb-4 text-center">
      <p className="font-display italic text-xl text-cream mb-1">Nothing is rostered for {label} yet</p>
      <p className="text-sm text-cream/60 max-w-xl mx-auto">
        {canEdit
          ? "Start the month from the employees' weekly patterns, or copy what was worked last month. Either only fills empty days; you can still edit every cell afterwards."
          : "The schedule for this month has not been published yet."}
      </p>
      {canEdit && (
        <div className="mt-5 flex flex-wrap justify-center gap-3">
          <button
            type="button"
            onClick={() => run("generate")}
            disabled={busy !== null}
            className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {busy === "generate" ? "Generating…" : "Generate from patterns"}
          </button>
          <button
            type="button"
            onClick={() => run("copy")}
            disabled={busy !== null}
            className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-5 py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {busy === "copy" ? "Copying…" : "Copy previous month"}
          </button>
        </div>
      )}
      {error && <p className="mt-3 text-sm text-coral">{error}</p>}
    </div>
  );
}
