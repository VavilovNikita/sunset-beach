"use client";

import { useEffect, useState } from "react";
import {
  previewRosterImport,
  createRosterImportNameMapping,
  createRosterImportColorMapping,
  commitRosterImport,
  listShiftCodes,
} from "@/lib/rosterClient";
import { STAFF_AREA_LABELS } from "@/lib/rosterGrid";
import type {
  RosterImportPreview,
  RosterImportNameEntry,
  RosterImportCodeEntry,
  RosterImportResult,
  ShiftCode,
  StaffArea,
} from "@/lib/types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December",
];

// Only the fields the "map to an existing account" picker actually shows - narrower than the
// full User shape, so a freshly-created-on-the-spot employee (which the backend returns as just
// {employeeUserId, employeeName}) can be added to this list without fabricating the rest of User.
type EmployeeOption = { id: string; name: string; email?: string | null };

function NameMappingRow({
  entry,
  employees,
  onResolved,
  onEmployeeCreated,
}: {
  entry: RosterImportNameEntry;
  employees: EmployeeOption[];
  onResolved: () => void;
  onEmployeeCreated: (id: string, name: string) => void;
}) {
  const [mode, setMode] = useState<"pick" | "create">("pick");
  const [selectedId, setSelectedId] = useState("");
  const [newName, setNewName] = useState(entry.rawName);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (entry.mapped) {
    return (
      <li className="flex items-center justify-between gap-3 py-2 border-b border-cream/10 text-sm">
        <span>
          {entry.rawName} <span className="text-cream/40">× {entry.occurrences}</span>
        </span>
        <span className="text-sea">→ {entry.employeeName}</span>
      </li>
    );
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const result =
      mode === "pick"
        ? await createRosterImportNameMapping({ rawName: entry.rawName, employeeUserId: selectedId })
        : await createRosterImportNameMapping({ rawName: entry.rawName, newEmployeeName: newName.trim() });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (mode === "create") {
      onEmployeeCreated(result.data.employeeUserId, result.data.employeeName);
    }
    onResolved();
  }

  return (
    <li className="py-2 border-b border-cream/10">
      <div className="flex items-center justify-between gap-3 text-sm mb-1.5">
        <span>
          {entry.rawName} <span className="text-cream/40">× {entry.occurrences}</span>
        </span>
        {entry.suggestedStaffArea && (
          <span className="text-xs text-cream/40">under {STAFF_AREA_LABELS[entry.suggestedStaffArea]}</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex text-xs rounded-lg border border-cream/20 overflow-hidden">
          <button
            type="button"
            onClick={() => setMode("pick")}
            className={`px-2.5 py-1 ${mode === "pick" ? "bg-coral" : "text-cream/60 hover:text-cream"}`}
          >
            Existing
          </button>
          <button
            type="button"
            onClick={() => setMode("create")}
            className={`px-2.5 py-1 ${mode === "create" ? "bg-coral" : "text-cream/60 hover:text-cream"}`}
          >
            New
          </button>
        </div>
        {mode === "pick" ? (
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="bg-ink2 border-b border-cream/25 py-1 text-cream text-xs focus:outline-none focus:border-coral flex-1 min-w-[8rem]"
          >
            <option value="">Select an account…</option>
            {employees.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
                {u.email ? ` (${u.email})` : ""}
              </option>
            ))}
          </select>
        ) : (
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="bg-transparent border-b border-cream/25 py-1 text-cream text-xs flex-1 min-w-[8rem] focus:outline-none focus:border-coral"
          />
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || (mode === "pick" ? !selectedId : !newName.trim())}
          className="text-xs text-sea hover:text-coral transition-colors disabled:opacity-50"
        >
          {saving ? "…" : mode === "pick" ? "Map" : "Create & map"}
        </button>
      </div>
      {error && <p className="text-xs text-coral mt-1">{error}</p>}
    </li>
  );
}

function ColorMappingRow({
  entry,
  shiftCodesByArea,
  onLoadCodes,
  onResolved,
}: {
  entry: RosterImportCodeEntry;
  shiftCodesByArea: Record<string, ShiftCode[] | undefined>;
  onLoadCodes: (area: StaffArea) => void;
  onResolved: () => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const area = entry.staffArea;
  const codes = area ? shiftCodesByArea[area] : undefined;
  const needsCodes = !entry.resolved && !!entry.fillColor && !!area && codes === undefined;

  useEffect(() => {
    if (needsCodes && area) {
      onLoadCodes(area);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsCodes, area]);

  if (entry.resolved || !entry.fillColor || !area) {
    return (
      <li className="flex items-center justify-between gap-3 py-2 border-b border-cream/10 text-sm">
        <span>
          {entry.rawCode}
          {entry.fillColor && <span className={`ml-1.5 text-xs ${entry.fillColor === "YELLOW" ? "text-amber-300" : "text-sea"}`}>({entry.fillColor.toLowerCase()})</span>}
          {area && <span className="text-cream/40"> · {STAFF_AREA_LABELS[area]}</span>} <span className="text-cream/40">× {entry.occurrences}</span>
        </span>
        <span className="text-cream/60">{entry.shiftCodeDescription ?? "resolved"}</span>
      </li>
    );
  }

  async function handleSave() {
    if (!area || !entry.fillColor) return;
    setSaving(true);
    setError(null);
    const result = await createRosterImportColorMapping({
      staffArea: area, rawCode: entry.rawCode, fillColor: entry.fillColor, shiftCodeId: selectedId,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onResolved();
  }

  return (
    <li className="py-2 border-b border-cream/10">
      <div className="flex items-center justify-between gap-3 text-sm mb-1.5">
        <span>
          {entry.rawCode}{" "}
          <span className={`text-xs ${entry.fillColor === "YELLOW" ? "text-amber-300" : "text-sea"}`}>({entry.fillColor.toLowerCase()})</span>{" "}
          <span className="text-cream/40">· {STAFF_AREA_LABELS[area]} · × {entry.occurrences}</span>
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          disabled={!codes}
          className="bg-ink2 border-b border-cream/25 py-1 text-cream text-xs focus:outline-none focus:border-coral flex-1 min-w-[10rem]"
        >
          <option value="">{codes ? "Which shift code is this?" : "Loading shift codes…"}</option>
          {codes?.map((c) => (
            <option key={c.id} value={c.id}>
              {c.code} ({c.startTime1 ? `${c.startTime1}-${c.endTime1}${c.startTime2 ? ` / ${c.startTime2}-${c.endTime2}` : ""}` : "no fixed hours"})
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving || !selectedId}
          className="text-xs text-sea hover:text-coral transition-colors disabled:opacity-50"
        >
          {saving ? "…" : "Map"}
        </button>
      </div>
      {error && <p className="text-xs text-coral mt-1">{error}</p>}
    </li>
  );
}

export default function RosterImportManager({ initialEmployees }: { initialEmployees: EmployeeOption[] }) {
  const now = new Date();
  const [file, setFile] = useState<File | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [preview, setPreview] = useState<RosterImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState(initialEmployees);
  const [shiftCodesByArea, setShiftCodesByArea] = useState<Record<string, ShiftCode[] | undefined>>({});
  const [loadingAreas, setLoadingAreas] = useState<Set<string>>(new Set());
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<RosterImportResult | null>(null);

  async function refreshPreview(currentFile: File) {
    setLoading(true);
    setError(null);
    const result = await previewRosterImport(currentFile, year, month);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPreview(result.data);
  }

  async function handlePreviewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setCommitResult(null);
    setCommitError(null);
    await refreshPreview(file);
  }

  async function handleResolved() {
    if (!file) return;
    await refreshPreview(file);
  }

  function handleLoadCodes(area: StaffArea) {
    if (loadingAreas.has(area) || shiftCodesByArea[area] !== undefined) return;
    setLoadingAreas((prev) => new Set(prev).add(area));
    listShiftCodes(area).then((result) => {
      setLoadingAreas((prev) => {
        const next = new Set(prev);
        next.delete(area);
        return next;
      });
      if (result.ok) {
        setShiftCodesByArea((prev) => ({ ...prev, [area]: result.data }));
      }
    });
  }

  async function handleCommit() {
    if (!preview) return;
    setCommitting(true);
    setCommitError(null);
    const result = await commitRosterImport(preview.importId);
    setCommitting(false);
    if (!result.ok) {
      setCommitError(result.error);
      return;
    }
    setCommitResult(result.data);
    setPreview(null);
    setFile(null);
  }

  return (
    <div className="max-w-3xl">
      <form onSubmit={handlePreviewSubmit} className="bg-ink2/40 border border-cream/10 rounded-xl p-4 space-y-3 mb-6">
        <div className="grid sm:grid-cols-3 gap-3 items-end">
          <div className="sm:col-span-1">
            <label className="eyebrow text-cream/60 block mb-1">Year</label>
            <input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
            />
          </div>
          <div>
            <label className="eyebrow text-cream/60 block mb-1">Month</label>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full bg-ink2 border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
            >
              {MONTH_NAMES.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="eyebrow text-cream/60 block mb-1">Workbook</label>
            <input
              type="file"
              accept=".xlsx"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
              className="w-full text-cream text-xs file:mr-2 file:rounded-full file:border-0 file:bg-coral file:px-3 file:py-1.5 file:text-xs file:text-ink file:cursor-pointer"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={!file || loading}
          className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-60"
        >
          {loading ? "Reading…" : "Read file"}
        </button>
        {error && <p className="text-sm text-coral">{error}</p>}
      </form>

      {commitResult && (
        <div className="bg-ink2/40 border border-sea/40 rounded-xl p-4 mb-6 text-sm">
          <p className="text-sea font-medium mb-1">
            Imported {MONTH_NAMES[commitResult.month - 1]} {commitResult.year}
          </p>
          <p className="text-cream/70">
            {commitResult.created} entr{commitResult.created === 1 ? "y" : "ies"} created
            {commitResult.skippedCollisions > 0 && `, ${commitResult.skippedCollisions} skipped (already scheduled)`}.
          </p>
        </div>
      )}

      {preview && (
        <div className="space-y-6">
          {preview.issues.length > 0 && (
            <div className="bg-ink2/40 border border-coral/40 rounded-xl p-4">
              <p className="eyebrow text-coral mb-2">Could not read ({preview.issues.length})</p>
              <ul className="space-y-1 text-sm">
                {preview.issues.map((issue, i) => (
                  <li key={i} className="text-cream/70">
                    {issue.cellRef && <span className="text-coral">{issue.cellRef}: </span>}
                    {issue.message}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="bg-ink2/40 border border-cream/10 rounded-xl p-4">
            <p className="eyebrow text-cream/60 mb-2">Names ({preview.names.length})</p>
            <ul>
              {preview.names.map((n) => (
                <NameMappingRow
                  key={n.rawName}
                  entry={n}
                  employees={employees}
                  onResolved={handleResolved}
                  onEmployeeCreated={(id, name) => setEmployees((prev) => [...prev, { id, name }])}
                />
              ))}
            </ul>
          </div>

          <div className="bg-ink2/40 border border-cream/10 rounded-xl p-4">
            <p className="eyebrow text-cream/60 mb-2">Codes ({preview.codes.length})</p>
            <ul>
              {preview.codes.map((c, i) => (
                <ColorMappingRow
                  key={`${c.rawCode}-${c.fillColor}-${c.staffArea}-${i}`}
                  entry={c}
                  shiftCodesByArea={shiftCodesByArea}
                  onLoadCodes={handleLoadCodes}
                  onResolved={handleResolved}
                />
              ))}
            </ul>
          </div>

          {preview.collisions.length > 0 && (
            <div className="bg-ink2/40 border border-amber-400/40 rounded-xl p-4">
              <p className="eyebrow text-amber-400 mb-2">Already scheduled - will be skipped ({preview.collisions.length})</p>
              <ul className="space-y-1 text-sm text-cream/70">
                {preview.collisions.map((c, i) => (
                  <li key={i}>
                    {c.employeeName} on {c.date}: keeps &ldquo;{c.existingShiftCodeDescription}&rdquo;, not &ldquo;{c.newShiftCodeDescription}&rdquo;
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between bg-ink2/40 border border-cream/10 rounded-xl p-4">
            <p className="text-sm text-cream/70">
              {preview.entriesToCreate} entr{preview.entriesToCreate === 1 ? "y" : "ies"} would be created
              {!preview.canCommit && " - resolve everything above first"}.
            </p>
            <button
              type="button"
              onClick={handleCommit}
              disabled={!preview.canCommit || committing}
              className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-40"
            >
              {committing ? "Importing…" : "Confirm import"}
            </button>
          </div>
          {commitError && <p className="text-sm text-coral">{commitError}</p>}
        </div>
      )}
    </div>
  );
}
