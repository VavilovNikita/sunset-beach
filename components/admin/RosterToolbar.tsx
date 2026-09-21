"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { exportRosterActualsXlsx, exportRosterGridXlsx, generateRosterMonth } from "@/lib/rosterClient";

// Generate seeds a month from every employee's pattern (never overwrites an existing entry - see
// POST /roster/generate's own description), so it's safe to press again after adding a pattern
// partway through setting up a month. Both exports download client-side: the backend returns the
// .xlsx workbook's own binary content type directly, so this builds the download itself via a
// Blob + a throwaway <a> rather than navigating to the URL (a manager stays on the grid, not
// bounced to a raw file in a new tab).
export default function RosterToolbar({ year, month, isAdmin }: { year: number; month: number; isAdmin: boolean }) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingGrid, setExportingGrid] = useState(false);
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
    const result = await exportRosterActualsXlsx(year, month);
    setExporting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const url = URL.createObjectURL(result.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `roster-actuals-${year}-${String(month).padStart(2, "0")}.xlsx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  // ADMIN only on the backend - the button itself is hidden for a MANAGER (see isAdmin below),
  // so this only ever runs for someone the endpoint will actually accept.
  async function handleExportGrid() {
    setExportingGrid(true);
    setError(null);
    const result = await exportRosterGridXlsx(year, month);
    setExportingGrid(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const url = URL.createObjectURL(result.data);
    const a = document.createElement("a");
    a.href = url;
    a.download = `roster-${year}-${String(month).padStart(2, "0")}.xlsx`;
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
        {exporting ? "Exporting…" : "Export actuals (Excel)"}
      </button>
      {isAdmin && (
        <button
          type="button"
          onClick={handleExportGrid}
          disabled={exportingGrid}
          className="rounded-full bg-cream/10 hover:bg-cream/20 transition-colors px-4 py-2 text-sm disabled:opacity-60"
        >
          {exportingGrid ? "Exporting…" : "Export grid (Excel)"}
        </button>
      )}
      {error && <p className="text-sm text-coral">{error}</p>}
    </div>
  );
}
