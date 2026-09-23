"use client";

import { useState } from "react";
import { previewRosterGridImport, commitRosterGridImport } from "@/lib/rosterClient";
import { STAFF_AREA_LABELS } from "@/lib/rosterGrid";
import { NameMappingRow, type EmployeeOption } from "@/components/admin/RosterImportManager";
import type {
  RosterGridImportDiffRow,
  RosterGridImportPreview,
  RosterGridImportResult,
  RosterGridImportRetiredCode,
  RosterGridImportRetiredCodeResolution,
  RosterGridImportUnknownCode,
  RosterGridImportUnknownCodeResolution,
  ShiftCodeKind,
  StaffArea,
} from "@/lib/types";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December",
];

const TODAY = new Date().toISOString().slice(0, 10);
const STAFF_AREAS: StaffArea[] = ["ADMIN", "FRONT_OFFICE", "MAINTENANCE", "HOUSEKEEPING", "RESTAURANT", "KITCHEN"];
const SHARED_LABEL = "Shared (every area)";
const SHIFT_CODE_KINDS: ShiftCodeKind[] = ["MORNING", "SPLIT", "EVENING", "OPEN_SCHEDULE", "ABSENCE"];
const SHIFT_CODE_KIND_LABELS: Record<ShiftCodeKind, string> = {
  MORNING: "Morning",
  SPLIT: "Split",
  EVENING: "Evening",
  OPEN_SCHEDULE: "Open schedule",
  ABSENCE: "Absence",
};

function cellKey(employeeUserId: string, date: string) {
  return `${employeeUserId}|${date}`;
}

function unknownKey(staffArea: StaffArea | null, rawCode: string) {
  return `${staffArea ?? ""}|${rawCode}`;
}

type CodeFormFields = {
  staffArea: StaffArea | null;
  code: string;
  kind: ShiftCodeKind;
  startTime1: string;
  endTime1: string;
  startTime2: string;
  endTime2: string;
  countsAsWorked: boolean;
  isPaid: boolean;
  displayColor: string;
};

// Shared field layout for both "recreate a retired code" and "define a hand-typed one from
// scratch" - same fields ShiftCodeManager's own create form takes, condensed into one card since
// several of these can be pending at once. `confirmLabel` is the only thing that differs.
function CodeDefinitionCard({
  title,
  subtitle,
  initial,
  confirmLabel,
  confirmed,
  onConfirm,
}: {
  title: string;
  subtitle?: string;
  initial: CodeFormFields;
  confirmLabel: string;
  confirmed: boolean;
  onConfirm: (fields: CodeFormFields) => void;
}) {
  const [fields, setFields] = useState(initial);

  return (
    <li className="py-3 border-b border-cream/10">
      <div className="flex items-center justify-between gap-3 text-sm mb-2">
        <span className="font-medium">{title}</span>
        {subtitle && <span className="text-xs text-cream/40">{subtitle}</span>}
      </div>
      {confirmed ? (
        <p className="text-xs text-sea">Will be created on confirm.</p>
      ) : (
        <div className="space-y-2">
          <div className="grid sm:grid-cols-4 gap-2 items-end">
            <div>
              <label className="eyebrow text-cream/60 block mb-1 text-[10px]">Area</label>
              <select
                value={fields.staffArea ?? ""}
                onChange={(e) => setFields({ ...fields, staffArea: e.target.value ? (e.target.value as StaffArea) : null })}
                className="w-full bg-ink2 border-b border-cream/25 py-1 text-cream text-xs focus:outline-none focus:border-coral"
              >
                <option value="">{SHARED_LABEL}</option>
                {STAFF_AREAS.map((a) => (
                  <option key={a} value={a}>
                    {STAFF_AREA_LABELS[a]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="eyebrow text-cream/60 block mb-1 text-[10px]">Code</label>
              <input
                type="text"
                value={fields.code}
                onChange={(e) => setFields({ ...fields, code: e.target.value })}
                className="w-full bg-transparent border-b border-cream/25 py-1 text-cream text-xs focus:outline-none focus:border-coral"
              />
            </div>
            <div>
              <label className="eyebrow text-cream/60 block mb-1 text-[10px]">Kind</label>
              <select
                value={fields.kind}
                onChange={(e) => setFields({ ...fields, kind: e.target.value as ShiftCodeKind })}
                className="w-full bg-ink2 border-b border-cream/25 py-1 text-cream text-xs focus:outline-none focus:border-coral"
              >
                {SHIFT_CODE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {SHIFT_CODE_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="eyebrow text-cream/60 block mb-1 text-[10px]">Colour</label>
              <input
                type="color"
                value={fields.displayColor || "#153138"}
                onChange={(e) => setFields({ ...fields, displayColor: e.target.value })}
                className="h-7 w-full rounded border border-cream/20 bg-transparent p-0 cursor-pointer"
              />
            </div>
          </div>
          <div className="grid sm:grid-cols-4 gap-2 items-end">
            <div>
              <label className="eyebrow text-cream/60 block mb-1 text-[10px]">Start 1</label>
              <input
                type="time"
                value={fields.startTime1}
                onChange={(e) => setFields({ ...fields, startTime1: e.target.value })}
                className="w-full bg-transparent border-b border-cream/25 py-1 text-cream text-xs focus:outline-none focus:border-coral"
              />
            </div>
            <div>
              <label className="eyebrow text-cream/60 block mb-1 text-[10px]">End 1</label>
              <input
                type="time"
                value={fields.endTime1}
                onChange={(e) => setFields({ ...fields, endTime1: e.target.value })}
                className="w-full bg-transparent border-b border-cream/25 py-1 text-cream text-xs focus:outline-none focus:border-coral"
              />
            </div>
            <div>
              <label className="eyebrow text-cream/60 block mb-1 text-[10px]">Start 2</label>
              <input
                type="time"
                value={fields.startTime2}
                onChange={(e) => setFields({ ...fields, startTime2: e.target.value })}
                className="w-full bg-transparent border-b border-cream/25 py-1 text-cream text-xs focus:outline-none focus:border-coral"
              />
            </div>
            <div>
              <label className="eyebrow text-cream/60 block mb-1 text-[10px]">End 2</label>
              <input
                type="time"
                value={fields.endTime2}
                onChange={(e) => setFields({ ...fields, endTime2: e.target.value })}
                className="w-full bg-transparent border-b border-cream/25 py-1 text-cream text-xs focus:outline-none focus:border-coral"
              />
            </div>
          </div>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-1.5 text-xs text-cream/70">
              <input
                type="checkbox"
                checked={fields.countsAsWorked}
                onChange={(e) => setFields({ ...fields, countsAsWorked: e.target.checked })}
                className="accent-coral"
              />
              Counts as worked
            </label>
            <label className="flex items-center gap-1.5 text-xs text-cream/70">
              <input type="checkbox" checked={fields.isPaid} onChange={(e) => setFields({ ...fields, isPaid: e.target.checked })} className="accent-coral" />
              Paid
            </label>
            <button
              type="button"
              onClick={() => onConfirm(fields)}
              disabled={!fields.code.trim()}
              className="ml-auto text-xs text-sea hover:text-coral transition-colors disabled:opacity-50"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

function DiffRowLine({ row, excluded, onToggleExclude }: { row: RosterGridImportDiffRow; excluded: boolean; onToggleExclude: () => void }) {
  return (
    <li className="flex items-center justify-between gap-3 py-1.5 border-b border-cream/10 text-sm">
      <span className="text-cream/80">
        {row.employeeName} <span className="text-cream/40">on {row.date}</span>
      </span>
      <span className="flex items-center gap-2 text-xs">
        {row.changeType === "CHANGE" && (
          <span className="text-cream/60">
            {row.previousCode ?? "—"} → {row.newCode ?? "—"}
          </span>
        )}
        {row.changeType === "ADD" && <span className="text-sea">+ {row.newCode}</span>}
        {row.changeType === "REMOVE" && <span className="text-coral">− {row.previousCode}</span>}
        {row.lockedConflict && <span className="text-amber-400">locked - will be skipped</span>}
        {!row.lockedConflict && row.staleSinceExport && (
          <label className="flex items-center gap-1 text-amber-400 cursor-pointer">
            <input type="checkbox" checked={excluded} onChange={onToggleExclude} className="accent-coral" />
            stale since export{excluded ? " - excluded" : ""}
          </label>
        )}
        {(row.pendingRetiredCodeId || row.pendingUnknownCode) && <span className="text-cream/40">needs a code resolved above</span>}
      </span>
    </li>
  );
}

export default function RosterGridImportManager({ initialEmployees }: { initialEmployees: EmployeeOption[] }) {
  const now = new Date();
  const [file, setFile] = useState<File | null>(null);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [preview, setPreview] = useState<RosterGridImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [employees, setEmployees] = useState(initialEmployees);

  const [retiredDrafts, setRetiredDrafts] = useState<Record<string, RosterGridImportRetiredCodeResolution>>({});
  const [unknownDrafts, setUnknownDrafts] = useState<Record<string, RosterGridImportUnknownCodeResolution>>({});
  const [excludedCells, setExcludedCells] = useState<Set<string>>(new Set());

  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<RosterGridImportResult | null>(null);

  async function refreshPreview(currentFile: File) {
    setLoading(true);
    setError(null);
    const result = await previewRosterGridImport(currentFile, year, month);
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPreview(result.data);
    setRetiredDrafts({});
    setUnknownDrafts({});
    setExcludedCells(new Set());
  }

  async function handlePreviewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!file) return;
    setCommitResult(null);
    setCommitError(null);
    await refreshPreview(file);
  }

  async function handleNameResolved() {
    if (!file) return;
    await refreshPreview(file);
  }

  function toggleExclude(employeeUserId: string, date: string) {
    const key = cellKey(employeeUserId, date);
    setExcludedCells((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function confirmRetired(entry: RosterGridImportRetiredCode, fields: CodeFormFields) {
    setRetiredDrafts((prev) => ({
      ...prev,
      [entry.shiftCodeId]: {
        shiftCodeId: entry.shiftCodeId,
        staffArea: fields.staffArea,
        code: fields.code.trim(),
        kind: fields.kind,
        startTime1: fields.startTime1 || null,
        endTime1: fields.endTime1 || null,
        startTime2: fields.startTime2 || null,
        endTime2: fields.endTime2 || null,
        countsAsWorked: fields.countsAsWorked,
        isPaid: fields.isPaid,
        effectiveFrom: TODAY,
        displayColor: fields.displayColor || null,
      },
    }));
  }

  function confirmUnknown(entry: RosterGridImportUnknownCode, fields: CodeFormFields) {
    setUnknownDrafts((prev) => ({
      ...prev,
      [unknownKey(entry.staffArea, entry.rawCode)]: {
        rawCode: entry.rawCode,
        staffArea: fields.staffArea,
        code: fields.code.trim(),
        kind: fields.kind,
        startTime1: fields.startTime1 || null,
        endTime1: fields.endTime1 || null,
        startTime2: fields.startTime2 || null,
        endTime2: fields.endTime2 || null,
        countsAsWorked: fields.countsAsWorked,
        isPaid: fields.isPaid,
        effectiveFrom: TODAY,
        displayColor: fields.displayColor || null,
      },
    }));
  }

  const readyToCommit =
    !!preview &&
    preview.unmatchedEmployees.length === 0 &&
    preview.retiredCodes.every((rc) => retiredDrafts[rc.shiftCodeId]) &&
    preview.unknownCodes.every((uc) => unknownDrafts[unknownKey(uc.staffArea, uc.rawCode)]);

  async function handleCommit() {
    if (!preview || !readyToCommit) return;
    setCommitting(true);
    setCommitError(null);
    const result = await commitRosterGridImport({
      importId: preview.importId,
      retiredCodeResolutions: Object.values(retiredDrafts),
      unknownCodeResolutions: Object.values(unknownDrafts),
      excludeCells: Array.from(excludedCells).map((key) => {
        const [employeeUserId, date] = key.split("|");
        return { employeeUserId, date };
      }),
    });
    setCommitting(false);
    if (!result.ok) {
      setCommitError(result.error);
      return;
    }
    setCommitResult(result.data);
    setPreview(null);
    setFile(null);
  }

  const addRows = preview?.diffRows.filter((r) => r.changeType === "ADD") ?? [];
  const removeRows = preview?.diffRows.filter((r) => r.changeType === "REMOVE") ?? [];
  const changeRows = preview?.diffRows.filter((r) => r.changeType === "CHANGE") ?? [];

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
            Re-imported {MONTH_NAMES[commitResult.month - 1]} {commitResult.year}
          </p>
          <p className="text-cream/70">
            {commitResult.created} added, {commitResult.changed} changed, {commitResult.removed} removed
            {commitResult.skippedLocked > 0 && `, ${commitResult.skippedLocked} skipped (locked)`}
            {commitResult.skippedExcluded > 0 && `, ${commitResult.skippedExcluded} skipped (excluded)`}
            {commitResult.createdShiftCodes > 0 && `, ${commitResult.createdShiftCodes} shift code(s) created`}.
          </p>
        </div>
      )}

      {preview && (
        <div className="space-y-6">
          <div className="bg-ink2/40 border border-cream/10 rounded-xl p-4 text-sm text-cream/70">
            Exported {new Date(preview.exportedAt).toLocaleString()} · {preview.addCount} to add, {preview.changeCount} to change,{" "}
            {preview.removeCount} to remove, {preview.unchangedCount} unchanged
            {preview.staleCount > 0 && ` · ${preview.staleCount} flagged stale since export`}
            {preview.lockedConflictCount > 0 && ` · ${preview.lockedConflictCount} locked (will be skipped)`}
          </div>

          {preview.unmatchedEmployees.length > 0 && (
            <div className="bg-ink2/40 border border-coral/40 rounded-xl p-4">
              <p className="eyebrow text-coral mb-2">Unmatched employees ({preview.unmatchedEmployees.length})</p>
              <ul>
                {preview.unmatchedEmployees.map((n) => (
                  <NameMappingRow
                    key={n.rawName}
                    entry={n}
                    employees={employees}
                    onResolved={handleNameResolved}
                    onEmployeeCreated={(id, name) => setEmployees((prev) => [...prev, { id, name }])}
                  />
                ))}
              </ul>
            </div>
          )}

          {preview.retiredCodes.length > 0 && (
            <div className="bg-ink2/40 border border-amber-400/40 rounded-xl p-4">
              <p className="eyebrow text-amber-400 mb-2">Retired codes to recreate ({preview.retiredCodes.length})</p>
              <ul>
                {preview.retiredCodes.map((rc) => (
                  <CodeDefinitionCard
                    key={rc.shiftCodeId}
                    title={`"${rc.code}" (${rc.occurrences} cell${rc.occurrences === 1 ? "" : "s"})`}
                    subtitle="no longer active - shown here with its own original definition"
                    confirmLabel="Recreate with these hours"
                    confirmed={!!retiredDrafts[rc.shiftCodeId]}
                    initial={{
                      staffArea: rc.staffArea,
                      code: rc.code,
                      kind: rc.kind,
                      startTime1: rc.startTime1 ?? "",
                      endTime1: rc.endTime1 ?? "",
                      startTime2: rc.startTime2 ?? "",
                      endTime2: rc.endTime2 ?? "",
                      countsAsWorked: rc.countsAsWorked,
                      isPaid: rc.isPaid,
                      displayColor: rc.displayColor ?? "",
                    }}
                    onConfirm={(fields) => confirmRetired(rc, fields)}
                  />
                ))}
              </ul>
            </div>
          )}

          {preview.unknownCodes.length > 0 && (
            <div className="bg-ink2/40 border border-amber-400/40 rounded-xl p-4">
              <p className="eyebrow text-amber-400 mb-2">Hand-typed codes to define ({preview.unknownCodes.length})</p>
              <ul>
                {preview.unknownCodes.map((uc) => (
                  <CodeDefinitionCard
                    key={unknownKey(uc.staffArea, uc.rawCode)}
                    title={`"${uc.rawCode}" (${uc.occurrences} cell${uc.occurrences === 1 ? "" : "s"})`}
                    subtitle="typed in by hand since export - no metadata to prefill from"
                    confirmLabel="Define this code"
                    confirmed={!!unknownDrafts[unknownKey(uc.staffArea, uc.rawCode)]}
                    initial={{
                      staffArea: uc.staffArea,
                      code: uc.rawCode,
                      kind: "MORNING",
                      startTime1: "",
                      endTime1: "",
                      startTime2: "",
                      endTime2: "",
                      countsAsWorked: true,
                      isPaid: true,
                      displayColor: "",
                    }}
                    onConfirm={(fields) => confirmUnknown(uc, fields)}
                  />
                ))}
              </ul>
            </div>
          )}

          {addRows.length > 0 && (
            <div className="bg-ink2/40 border border-cream/10 rounded-xl p-4">
              <p className="eyebrow text-sea mb-2">To add ({addRows.length})</p>
              <ul>
                {addRows.map((r) => (
                  <DiffRowLine
                    key={cellKey(r.employeeUserId, r.date)}
                    row={r}
                    excluded={excludedCells.has(cellKey(r.employeeUserId, r.date))}
                    onToggleExclude={() => toggleExclude(r.employeeUserId, r.date)}
                  />
                ))}
              </ul>
            </div>
          )}
          {changeRows.length > 0 && (
            <div className="bg-ink2/40 border border-cream/10 rounded-xl p-4">
              <p className="eyebrow text-cream/60 mb-2">To change ({changeRows.length})</p>
              <ul>
                {changeRows.map((r) => (
                  <DiffRowLine
                    key={cellKey(r.employeeUserId, r.date)}
                    row={r}
                    excluded={excludedCells.has(cellKey(r.employeeUserId, r.date))}
                    onToggleExclude={() => toggleExclude(r.employeeUserId, r.date)}
                  />
                ))}
              </ul>
            </div>
          )}
          {removeRows.length > 0 && (
            <div className="bg-ink2/40 border border-coral/40 rounded-xl p-4">
              <p className="eyebrow text-coral mb-2">To remove ({removeRows.length})</p>
              <ul>
                {removeRows.map((r) => (
                  <DiffRowLine
                    key={cellKey(r.employeeUserId, r.date)}
                    row={r}
                    excluded={excludedCells.has(cellKey(r.employeeUserId, r.date))}
                    onToggleExclude={() => toggleExclude(r.employeeUserId, r.date)}
                  />
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center justify-between bg-ink2/40 border border-cream/10 rounded-xl p-4">
            <p className="text-sm text-cream/70">{!readyToCommit && "Resolve everything above first."}</p>
            <button
              type="button"
              onClick={handleCommit}
              disabled={!readyToCommit || committing}
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
