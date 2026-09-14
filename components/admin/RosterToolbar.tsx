"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { exportRosterActualsCsv, generateRosterMonth } from "@/lib/rosterClient";

// Generate seeds a month from every employee's pattern (never overwrites an existing entry - see
// POST /roster/generate's own description), so it's safe to press again after adding a pattern
// partway through setting up a month. Export downloads the actuals CSV client-side: the backend
// returns text/csv directly, so this builds the download itself via a Blob + a throwaway <a>
// rather than navigating to the URL (a manager stays on the grid, not bounced to a raw CSV tab).
export default function RosterToolbar({ year, month }: { year: number; month: number }) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setGenerating(true);
    setError(null);
    const result = await generateRosterMonth(year, month);
    setGenerating(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  async function handleExport() {
    setExporting(true);
    setError(null);
    const result = await exportRosterActualsCsv(year, month);
    setExporting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const blob = new Blob([result.data], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `roster-actuals-${year}-${String(month).padStart(2, "0")}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleGenerate}
        disabled={generating}
        className="rounded-full bg-cream/10 hover:bg-cream/20 transition-colors px-4 py-2 text-sm disabled:opacity-60"
      >
        {generating ? "Generating…" : "Generate from patterns"}
      </button>
      <button
        type="button"
        onClick={handleExport}
        disabled={exporting}
        className="rounded-full bg-cream/10 hover:bg-cream/20 transition-colors px-4 py-2 text-sm disabled:opacity-60"
      >
        {exporting ? "Exporting…" : "Export actuals (CSV)"}
      </button>
      {error && <p className="text-sm text-coral">{error}</p>}
    </div>
  );
}
