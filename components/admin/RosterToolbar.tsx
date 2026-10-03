"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { copyRosterMonth, exportRosterActualsXlsx, exportRosterGridXlsx, generateRosterMonth } from "@/lib/rosterClient";
import { previousMonthRange } from "@/lib/rosterGrid";
import { formatDate } from "@/lib/formatDate";

// Generate seeds a month from every employee's pattern (never overwrites an existing entry - see
// POST /roster/generate's own description), so it's safe to press again after adding a pattern
// partway through setting up a month. Both exports download client-side: the backend returns the
// .xlsx workbook's own binary content type directly, so this builds the download itself via a
// Blob + a throwaway <a> rather than navigating to the URL (a manager stays on the grid, not
// bounced to a raw file in a new tab).
//
// "Copy previous month" is the way to set a month up when nobody has a pattern for Generate to
// work from: it copies an earlier stretch of the real roster by weekday (POST /roster/copy - a
// weekly day off stays on its weekday), never overwriting a cell that's already filled. The source
// defaults to the whole previous month and can be narrowed to any range of at least a week.
export default function RosterToolbar({ year, month, isAdmin }: { year: number; month: number; isAdmin: boolean }) {
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportingGrid, setExportingGrid] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const defaultSource = previousMonthRange(year, month);
  const [copyOpen, setCopyOpen] = useState(false);
  const [sourceFrom, setSourceFrom] = useState(defaultSource.from);
  const [sourceTo, setSourceTo] = useState(defaultSource.to);
  const [copying, setCopying] = useState(false);
  const [copyResult, setCopyResult] = useState<string | null>(null);

  async function handleCopy() {
    setCopying(true);
    setError(null);
    setCopyResult(null);
    const result = await copyRosterMonth({ year, month, sourceFrom, sourceTo });
    setCopying(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const r = result.data;
    setCopyResult(
      `Copied ${r.created} shift${r.created === 1 ? "" : "s"} from ${formatDate(r.sourceFrom)} – ${formatDate(r.sourceTo)}` +
        (r.skippedExisting > 0 ? `; ${r.skippedExisting} already-filled cell${r.skippedExisting === 1 ? "" : "s"} left as they were` : "") +
        (r.skippedNoCurrentCode > 0 ? `; ${r.skippedNoCurrentCode} skipped (shift code not in force on that date)` : "") +
        "."
    );
    setCopyOpen(false);
    router.refresh();
  }

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
    <div className="space-y-3">
      <div className="flex items-center gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => setCopyOpen((v) => !v)}
          disabled={copying}
          className="rounded-full bg-cream/10 hover:bg-cream/20 transition-colors px-4 py-2 text-sm disabled:opacity-60"
        >
          Copy previous month
        </button>
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
      {copyOpen && (
        <div className="flex items-end gap-3 flex-wrap bg-ink2/40 border border-cream/10 rounded-xl p-4">
          <div>
            <label className="eyebrow text-cream/60 block mb-1">Copy from</label>
            <input
              type="date"
              value={sourceFrom}
              onChange={(e) => setSourceFrom(e.target.value)}
              className="bg-transparent border-b border-cream/25 py-1 text-cream text-sm focus:outline-none focus:border-coral"
            />
          </div>
          <div>
            <label className="eyebrow text-cream/60 block mb-1">to</label>
            <input
              type="date"
              value={sourceTo}
              onChange={(e) => setSourceTo(e.target.value)}
              className="bg-transparent border-b border-cream/25 py-1 text-cream text-sm focus:outline-none focus:border-coral"
            />
          </div>
          <button
            type="button"
            onClick={handleCopy}
            disabled={copying || !sourceFrom || !sourceTo}
            className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-4 py-2 text-sm font-medium disabled:opacity-60"
          >
            {copying ? "Copying…" : "Copy into this month"}
          </button>
          <p className="w-full text-xs text-cream/40">
            Copied by weekday, in whole weeks, repeated to fill the month. Cells already filled are never overwritten.
          </p>
        </div>
      )}
      {copyResult && <p className="text-sm text-cream/60">{copyResult}</p>}
    </div>
  );
}
