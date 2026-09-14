"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useTapOrDoubleClick } from "@/lib/useTapOrDoubleClick";
import { classifyRosterDrop, isValidSwapTarget, STAFF_AREA_LABELS, type RosterDragSource, type RosterDropTarget } from "@/lib/rosterGrid";
import {
  createRosterEntry,
  deleteRosterEntry,
  moveRosterEntry,
  reassignRosterEntry,
  setRosterEntryLocked,
  swapRosterEntries,
} from "@/lib/rosterClient";
import type { RosterCoverageWarning, RosterEmployee, RosterEntry, RosterMonth, ShiftCode, StaffArea } from "@/lib/types";

const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const STAFF_AREAS: StaffArea[] = ["ADMIN", "FRONT_OFFICE", "MAINTENANCE", "HOUSEKEEPING", "RESTAURANT", "KITCHEN"];

function datesOfMonth(year: number, month: number): string[] {
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return Array.from({ length: daysInMonth }, (_, i) => {
    const d = i + 1;
    return `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  });
}

function weekdayAbbrFor(dateKey: string) {
  const d = new Date(`${dateKey}T00:00:00Z`);
  return WEEKDAY_ABBR[d.getUTCDay()];
}

type DragState = {
  source: RosterDragSource;
  hasHoveredSwapTarget: boolean;
  targetEmployeeUserId: string;
  targetDate: string;
  targetEntry: { id: string; locked: boolean } | null;
};

function cellUnderPointer(e: React.PointerEvent): { employeeUserId: string; date: string } | null {
  const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-cell]");
  if (!el || el.dataset.employeeUserId === undefined || el.dataset.date === undefined) return null;
  return { employeeUserId: el.dataset.employeeUserId, date: el.dataset.date };
}

// Same DOM-attribute hit-test convention as BookingCalendarGrid's barUnderPointer - survives any
// future layout change, unlike coordinate math. Occupied cells carry data-entry-id on the same
// element as data-cell (a roster cell IS its own entry chip, no separate floating bar layer),
// so closest("[data-entry-id]") naturally takes priority over closest("[data-cell]") only when
// the pointer is actually over an occupied cell.
function entryUnderPointer(e: React.PointerEvent, excludeEntryId: string): { entryId: string; employeeUserId: string; date: string; locked: boolean } | null {
  const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-entry-id]");
  if (!el || el.dataset.entryId === undefined || el.dataset.employeeUserId === undefined || el.dataset.date === undefined) return null;
  if (el.dataset.entryId === excludeEntryId) return null;
  return { entryId: el.dataset.entryId, employeeUserId: el.dataset.employeeUserId, date: el.dataset.date, locked: el.dataset.locked === "true" };
}

function coverageWarningFor(warnings: RosterCoverageWarning[], staffArea: StaffArea, date: string) {
  return warnings.find((w) => w.staffArea === staffArea && w.date === date) ?? null;
}

export default function RosterGrid({ data, year, month, shiftCodes }: { data: RosterMonth; year: number; month: number; shiftCodes: ShiftCode[] }) {
  const router = useRouter();
  const dates = datesOfMonth(year, month);
  const entriesByKey = new Map(data.entries.map((e) => [`${e.employeeUserId}|${e.date}`, e]));

  const groups: { area: StaffArea | null; employees: RosterEmployee[] }[] = [
    ...STAFF_AREAS.map((area) => ({ area, employees: data.employees.filter((e) => e.staffArea === area) })),
    { area: null, employees: data.employees.filter((e) => e.staffArea === null) },
  ].filter((g) => g.employees.length > 0);

  const { note: notePointerType, bind: bindTapOrDoubleClick } = useTapOrDoubleClick();
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<RosterEntry | null>(null);
  const [createTarget, setCreateTarget] = useState<{ employeeUserId: string; employeeName: string; date: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!dragState) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setDragState(null);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [dragState]);

  function onChipPointerDown(e: React.PointerEvent<HTMLDivElement>, entry: RosterEntry) {
    notePointerType(e);
    if (entry.locked) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setDragState({
      source: { entryId: entry.id, employeeUserId: entry.employeeUserId, date: entry.date },
      hasHoveredSwapTarget: false,
      targetEmployeeUserId: entry.employeeUserId,
      targetDate: entry.date,
      targetEntry: null,
    });
  }

  function onDragPointerMove(e: React.PointerEvent) {
    if (!dragState) return;
    const hovered = entryUnderPointer(e, dragState.source.entryId);
    if (hovered) {
      const asTarget: RosterDropTarget = {
        employeeUserId: hovered.employeeUserId,
        date: hovered.date,
        entry: { id: hovered.entryId, locked: hovered.locked },
      };
      const validSwap = isValidSwapTarget(dragState.source, asTarget);
      setDragState({
        ...dragState,
        hasHoveredSwapTarget: dragState.hasHoveredSwapTarget || validSwap,
        targetEmployeeUserId: hovered.employeeUserId,
        targetDate: hovered.date,
        targetEntry: { id: hovered.entryId, locked: hovered.locked },
      });
      return;
    }
    const cell = cellUnderPointer(e);
    if (!cell) return;
    setDragState({ ...dragState, targetEmployeeUserId: cell.employeeUserId, targetDate: cell.date, targetEntry: null });
  }

  async function applyClassification(source: RosterDragSource, target: RosterDropTarget, hasHoveredSwapTarget: boolean) {
    const classification = classifyRosterDrop(source, target, hasHoveredSwapTarget);
    if (classification.kind === "cancel") return;
    setActionError(null);

    if (classification.kind === "move") {
      const result = await moveRosterEntry(classification.entryId, { date: classification.date });
      if (!result.ok) setActionError(result.error);
    } else if (classification.kind === "reassign") {
      const result = await reassignRosterEntry(classification.entryId, { employeeUserId: classification.employeeUserId });
      if (!result.ok) setActionError(result.error);
    } else {
      const result = await swapRosterEntries(classification.entryId, { otherEntryId: classification.otherEntryId });
      if (!result.ok) setActionError(result.error);
    }
    router.refresh();
  }

  function onDragPointerUp(e: React.PointerEvent) {
    if (!dragState) return;
    const finished = dragState;
    setDragState(null);

    // Recomputed fresh from the release point, not from finished.targetEntry - the same "don't
    // trust the last thing pointermove happened to see" principle BookingCalendarGrid's own
    // onDragPointerUp documents.
    const hovered = entryUnderPointer(e, finished.source.entryId);
    const cell = cellUnderPointer(e);
    const target: RosterDropTarget | null = hovered
      ? { employeeUserId: hovered.employeeUserId, date: hovered.date, entry: { id: hovered.entryId, locked: hovered.locked } }
      : cell
        ? { employeeUserId: cell.employeeUserId, date: cell.date, entry: null }
        : null;
    if (!target) return;
    applyClassification(finished.source, target, finished.hasHoveredSwapTarget);
  }

  function onDragPointerCancel() {
    setDragState(null);
  }

  async function handleToggleLock(entry: RosterEntry) {
    const result = await setRosterEntryLocked(entry.id, !entry.locked);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    setSelectedEntry(result.data);
    router.refresh();
  }

  async function handleDelete(entry: RosterEntry) {
    const result = await deleteRosterEntry(entry.id);
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    setSelectedEntry(null);
    router.refresh();
  }

  async function handleCreate(shiftCodeId: string) {
    if (!createTarget) return;
    const result = await createRosterEntry({ employeeUserId: createTarget.employeeUserId, date: createTarget.date, shiftCodeId });
    if (!result.ok) {
      setActionError(result.error);
      return;
    }
    setCreateTarget(null);
    router.refresh();
  }

  return (
    <div>
      {actionError && (
        <p className="print:hidden text-sm text-coral bg-coral/10 border border-coral/30 rounded-xl px-4 py-3 mb-4">{actionError}</p>
      )}

      <div className="overflow-x-auto print:overflow-visible border border-cream/10 print:border-0 rounded-xl print:rounded-none">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 bg-ink2 text-left px-3 py-2 eyebrow text-cream/40 min-w-[180px]">Employee</th>
              {dates.map((d) => (
                <th key={d} className="px-1 py-2 text-center text-cream/40 text-xs min-w-[44px] border-l border-cream/5">
                  <div>{Number(d.slice(8, 10))}</div>
                  <div className="eyebrow">{weekdayAbbrFor(d)}</div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => (
              <Fragment key={group.area ?? "none"}>
                <tr key={`${group.area ?? "none"}-header`}>
                  <td colSpan={dates.length + 1} className="bg-ink2/60 px-3 py-1 eyebrow text-cream/50">
                    {group.area ? STAFF_AREA_LABELS[group.area] : "No area set"}
                  </td>
                </tr>
                {group.area && (
                  <tr key={`${group.area}-coverage`}>
                    <td className="sticky left-0 bg-ink px-3 py-1 text-xs text-cream/30">Coverage</td>
                    {dates.map((d) => {
                      const warning = coverageWarningFor(data.coverageWarnings, group.area as StaffArea, d);
                      return (
                        <td
                          key={d}
                          className={`text-center text-[10px] py-1 border-l border-cream/5 ${warning ? "bg-coral/20 text-coral" : "text-cream/20"}`}
                          title={warning ? `${warning.workingCount} working, minimum ${warning.minimumWorking}` : undefined}
                        >
                          {warning ? `${warning.workingCount}/${warning.minimumWorking}` : ""}
                        </td>
                      );
                    })}
                  </tr>
                )}
                {group.employees.map((emp) => (
                  <tr key={emp.id}>
                    <td className="sticky left-0 bg-ink px-3 py-2 truncate max-w-[180px]">{emp.name}</td>
                    {dates.map((d) => {
                      const entry = entriesByKey.get(`${emp.id}|${d}`);
                      const isDragSource = dragState?.source.entryId === entry?.id;
                      const isDropTarget = dragState !== null && dragState.targetEmployeeUserId === emp.id && dragState.targetDate === d;
                      // entryUnderPointer already excludes the dragged entry's own id, so a
                      // present targetEntry here is always a genuine other entry - locked is the
                      // only way it can still be an invalid target.
                      const dropInvalid = isDropTarget && dragState!.targetEntry !== null && dragState!.targetEntry.locked;
                      const dropIsSwap = isDropTarget && dragState!.targetEntry !== null && !dropInvalid;

                      if (!entry) {
                        return (
                          <td
                            key={d}
                            data-cell
                            data-employee-user-id={emp.id}
                            data-date={d}
                            onPointerMove={onDragPointerMove}
                            onPointerUp={onDragPointerUp}
                            onPointerCancel={onDragPointerCancel}
                            onClick={() => setCreateTarget({ employeeUserId: emp.id, employeeName: emp.name, date: d })}
                            className={`h-11 border-l border-cream/5 cursor-cell hover:bg-cream/5 ${
                              isDropTarget && !dropIsSwap ? "bg-sea/10 ring-1 ring-inset ring-sea" : ""
                            }`}
                          />
                        );
                      }

                      const tapHandlers = bindTapOrDoubleClick(() => setSelectedEntry(entry));
                      return (
                        <td
                          key={d}
                          data-cell
                          data-entry-id={entry.id}
                          data-employee-user-id={emp.id}
                          data-date={d}
                          data-locked={entry.locked}
                          onPointerDown={(e) => onChipPointerDown(e, entry)}
                          onPointerMove={onDragPointerMove}
                          onPointerUp={onDragPointerUp}
                          onPointerCancel={onDragPointerCancel}
                          onClick={tapHandlers.onClick}
                          onDoubleClick={tapHandlers.onDoubleClick}
                          title={`${entry.shiftCode.code}${entry.note ? ` · ${entry.note}` : ""}`}
                          className={`h-11 border-l border-cream/5 text-center align-middle select-none ${entry.locked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing"} ${
                            isDragSource ? "opacity-40" : ""
                          } ${dropIsSwap ? "ring-2 ring-sea" : ""} ${dropInvalid ? "ring-2 ring-coral" : ""}`}
                        >
                          <span className="inline-flex items-center gap-1 bg-ink2/60 border border-cream/10 rounded px-1.5 py-0.5 text-xs">
                            {entry.shiftCode.code}
                            {entry.locked && <span title="Locked">🔒</span>}
                            {entry.note && <span className="text-sea" title={entry.note}>●</span>}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {selectedEntry && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/60 p-4" onClick={() => setSelectedEntry(null)}>
          <div className="bg-ink2 border border-cream/10 rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow text-sea mb-1">{selectedEntry.date}</p>
            <h2 className="font-display italic text-2xl mb-2">{selectedEntry.employeeName}</h2>
            <p className="text-cream/70 text-sm mb-1">
              Shift: {selectedEntry.shiftCode.code}
              {selectedEntry.shiftCode.startTime1
                ? ` (${selectedEntry.shiftCode.startTime1}–${selectedEntry.shiftCode.endTime1}${
                    selectedEntry.shiftCode.startTime2 ? `, ${selectedEntry.shiftCode.startTime2}–${selectedEntry.shiftCode.endTime2}` : ""
                  })`
                : " (OP)"}
            </p>
            {selectedEntry.note && <p className="text-cream/50 text-sm mb-1">Note: {selectedEntry.note}</p>}
            <div className="flex gap-3 mt-4">
              <button
                type="button"
                onClick={() => handleToggleLock(selectedEntry)}
                className="rounded-full bg-cream/10 hover:bg-cream/20 transition-colors px-4 py-2 text-sm"
              >
                {selectedEntry.locked ? "Unlock" : "Lock"}
              </button>
              {!selectedEntry.locked && (
                <button
                  type="button"
                  onClick={() => handleDelete(selectedEntry)}
                  className="rounded-full bg-coral/20 hover:bg-coral/30 text-coral transition-colors px-4 py-2 text-sm"
                >
                  Remove
                </button>
              )}
              <button type="button" onClick={() => setSelectedEntry(null)} className="text-sm text-cream/50 hover:text-cream transition-colors ml-auto">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {createTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/60 p-4" onClick={() => setCreateTarget(null)}>
          <div className="bg-ink2 border border-cream/10 rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow text-sea mb-1">{createTarget.date}</p>
            <h2 className="font-display italic text-2xl mb-4">{createTarget.employeeName}</h2>
            <p className="eyebrow text-cream/60 mb-2">Assign a shift code</p>
            <div className="flex flex-col gap-1 max-h-64 overflow-y-auto">
              {shiftCodes
                .filter((c) => c.active)
                .map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => handleCreate(c.id)}
                    className="text-left px-3 py-2 rounded-lg hover:bg-cream/10 transition-colors text-sm"
                  >
                    {c.code} <span className="text-cream/40">· {c.staffArea ? STAFF_AREA_LABELS[c.staffArea] : "Shared"}</span>
                  </button>
                ))}
            </div>
            <button type="button" onClick={() => setCreateTarget(null)} className="text-sm text-cream/50 hover:text-cream transition-colors mt-4">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
