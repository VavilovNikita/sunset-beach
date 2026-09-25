"use client";

import { Fragment, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { dateOnlyUTC, toDateKey } from "@/lib/bookings";
import { useTapOrDoubleClick } from "@/lib/useTapOrDoubleClick";
import {
  chipAppearanceFor,
  classifyRosterDrop,
  isValidSwapTarget,
  STAFF_AREAS,
  STAFF_AREA_LABELS,
  type RosterDragSource,
  type RosterDropTarget,
} from "@/lib/rosterGrid";
import {
  createRosterEntry,
  deleteRosterEntry,
  moveRosterEntry,
  reassignRosterEntry,
  setRosterEntryLocked,
  swapRosterEntries,
  updateUserStaffArea,
} from "@/lib/rosterClient";
import type { RosterCoverageWarning, RosterEmployee, RosterEntry, RosterMonth, ShiftCode, StaffArea } from "@/lib/types";

const WEEKDAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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

function isWeekendDate(dateKey: string) {
  const day = new Date(`${dateKey}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

// Same hours a code carries everywhere else in this app (the create-modal's own list, the entry
// detail panel) - repeated here rather than factored out, matching how those two already repeat
// it rather than sharing a helper.
function describeShiftHours(shiftCode: ShiftCode) {
  if (!shiftCode.startTime1) return "Open schedule";
  return shiftCode.startTime2
    ? `${shiftCode.startTime1}–${shiftCode.endTime1}, ${shiftCode.startTime2}–${shiftCode.endTime2}`
    : `${shiftCode.startTime1}–${shiftCode.endTime1}`;
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

export default function RosterGrid({
  data,
  year,
  month,
  shiftCodes,
  isAdmin,
}: {
  data: RosterMonth;
  year: number;
  month: number;
  shiftCodes: ShiftCode[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const dates = datesOfMonth(year, month);
  const todayKey = toDateKey(dateOnlyUTC(new Date()));
  const entriesByKey = new Map(data.entries.map((e) => [`${e.employeeUserId}|${e.date}`, e]));

  // An employee with zero entries anywhere in the visible month doesn't earn a row by default -
  // someone from a past season, or an account (like an admin's own) that exists for another
  // reason, shouldn't cost a permanent scroll. Toggled back on to add a first shift for someone
  // who genuinely has none yet - see the checkbox below the grid header.
  const [showEmptyRows, setShowEmptyRows] = useState(false);
  const employeeIdsWithEntries = new Set(data.entries.map((e) => e.employeeUserId));

  const allGroups: { area: StaffArea | null; employees: RosterEmployee[] }[] = [
    ...STAFF_AREAS.map((area) => ({ area, employees: data.employees.filter((e) => e.staffArea === area) })),
    { area: null, employees: data.employees.filter((e) => e.staffArea === null) },
  ];
  const hiddenCount = allGroups.reduce(
    (sum, g) => sum + g.employees.filter((e) => !employeeIdsWithEntries.has(e.id)).length,
    0
  );
  const groups = allGroups
    .map((g) => ({ ...g, employees: showEmptyRows ? g.employees : g.employees.filter((e) => employeeIdsWithEntries.has(e.id)) }))
    .filter((g) => g.employees.length > 0);

  // Bulk-fixes staffArea for accounts an import created without one (see User.staffArea's own
  // description) - ADMIN only, since that field lives under /users/**, deliberately outside the
  // ordinary role hierarchy (see the backend CLAUDE.md's Authorization section), even though this
  // page itself is MANAGER+. Scoped to the "No area set" group - that's the only place this is
  // ever needed, and the only place `isAdmin` renders a checkbox or this bar at all.
  const [bulkSelected, setBulkSelected] = useState<Set<string>>(new Set());
  const [bulkArea, setBulkArea] = useState<StaffArea | "">("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  function toggleBulkSelected(employeeUserId: string) {
    setBulkSelected((prev) => {
      const next = new Set(prev);
      if (next.has(employeeUserId)) next.delete(employeeUserId);
      else next.add(employeeUserId);
      return next;
    });
  }

  async function handleBulkAssign() {
    if (!bulkArea || bulkSelected.size === 0) return;
    setBulkSaving(true);
    setBulkError(null);
    const ids = Array.from(bulkSelected);
    const results = await Promise.all(ids.map((id) => updateUserStaffArea(id, bulkArea)));
    setBulkSaving(false);
    const failed = results.filter((r) => !r.ok);
    if (failed.length > 0) {
      setBulkError(`${failed.length} of ${ids.length} failed - ${(failed[0] as { ok: false; error: string }).error}`);
      return;
    }
    setBulkSelected(new Set());
    setBulkArea("");
    router.refresh();
  }

  // Hotel-wide daily totals - what the manager actually reads, brought back under the grid
  // instead of living only on the Coverage tab (which only ever shows the configured minimums,
  // never a day's real numbers). "Off" is the absence of an entry, never a row of its own (see
  // RosterEntry's own convention) - never derived from a shift code's own flags. "Absent" counts
  // by the shift code's own kind (ABSENCE) - not by matching code text against the literal
  // string "PH", which used to break silently the moment a code was retyped (see ShiftCode.kind's
  // own comment). An unconfirmed code (kind null) simply doesn't count as absent yet - undercounting
  // until confirmed beats guessing. Guarded by employeeIds so a since-deactivated employee's old
  // entry (still in data.entries, no longer in data.employees) can't inflate "working"/"absent" or
  // produce a negative "off".
  const employeeIds = new Set(data.employees.map((e) => e.id));
  const workingByDate = new Map<string, number>();
  const absentByDate = new Map<string, number>();
  const presentByDate = new Map<string, number>();
  for (const e of data.entries) {
    if (!employeeIds.has(e.employeeUserId)) continue;
    presentByDate.set(e.date, (presentByDate.get(e.date) ?? 0) + 1);
    if (e.shiftCode.countsAsWorked) workingByDate.set(e.date, (workingByDate.get(e.date) ?? 0) + 1);
    if (e.shiftCode.kind === "ABSENCE") absentByDate.set(e.date, (absentByDate.get(e.date) ?? 0) + 1);
  }
  function coverageWarningsFor(date: string) {
    return data.coverageWarnings.filter((w) => w.date === date);
  }

  const { note: notePointerType, bind: bindTapOrDoubleClick } = useTapOrDoubleClick();
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<RosterEntry | null>(null);
  const [createTarget, setCreateTarget] = useState<{ employeeUserId: string; employeeName: string; date: string } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  // Same rule the booking calendar and spa grid settled on (see the frontend CLAUDE.md's own
  // drag-notes section): a drag has an ambiguous drop point and nothing here shows an optimistic
  // position, so nothing may apply until confirmed. One state per classification, same shape as
  // BookingCalendarGrid's scheduleConfirm/swapConfirm - the release only ever opens one of these,
  // never calls the API directly (see openDragConfirm, below).
  const [moveConfirm, setMoveConfirm] = useState<{
    entryId: string;
    employeeName: string;
    shiftCode: string;
    fromDate: string;
    toDate: string;
    status: "confirm" | "loading" | "error";
    error?: string;
  } | null>(null);
  // A reassign takes a shift off an employee who was never dragged or clicked - the dialog says
  // so explicitly (loses/gains), not just "from -> to", since "where it lands" alone would read
  // as routine and bury the one thing worth double-checking: whose day this used to be.
  const [reassignConfirm, setReassignConfirm] = useState<{
    entryId: string;
    fromEmployeeName: string;
    toEmployeeUserId: string;
    toEmployeeName: string;
    date: string;
    shiftCode: string;
    status: "confirm" | "loading" | "error";
    error?: string;
  } | null>(null);
  // Per RosterSwapInput's own backend description: (date, shiftCodeId) trades between the two
  // entries, employeeUserId stays put on each - "exchange two employees' days", not a table/
  // room swap. Both sides named, same two-line shape as the calendar/spa swap dialogs.
  const [swapConfirm, setSwapConfirm] = useState<{
    entryId: string;
    otherEntryId: string;
    employeeAName: string;
    dateA: string;
    shiftCodeA: string;
    employeeBName: string;
    dateB: string;
    shiftCodeB: string;
    status: "confirm" | "loading" | "error";
    error?: string;
  } | null>(null);

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

  // Classifies the drop and opens the matching confirm dialog - never calls the API itself. A
  // "cancel" classification (locked source/target, dropped back in place, a diagonal drop, or a
  // swap attempt that missed on release) stays silent, same as before this round: there was
  // never anything to confirm.
  function openDragConfirm(source: RosterDragSource, target: RosterDropTarget, hasHoveredSwapTarget: boolean) {
    const classification = classifyRosterDrop(source, target, hasHoveredSwapTarget);
    if (classification.kind === "cancel") return;

    const sourceEntry = entriesByKey.get(`${source.employeeUserId}|${source.date}`);
    if (!sourceEntry) return;

    if (classification.kind === "move") {
      setMoveConfirm({
        entryId: classification.entryId,
        employeeName: sourceEntry.employeeName,
        shiftCode: sourceEntry.shiftCode.code,
        fromDate: sourceEntry.date,
        toDate: classification.date,
        status: "confirm",
      });
      return;
    }

    if (classification.kind === "reassign") {
      const toEmployee = data.employees.find((emp) => emp.id === classification.employeeUserId);
      setReassignConfirm({
        entryId: classification.entryId,
        fromEmployeeName: sourceEntry.employeeName,
        toEmployeeUserId: classification.employeeUserId,
        toEmployeeName: toEmployee?.name ?? classification.employeeUserId,
        date: sourceEntry.date,
        shiftCode: sourceEntry.shiftCode.code,
        status: "confirm",
      });
      return;
    }

    const otherEntry = data.entries.find((e) => e.id === classification.otherEntryId);
    if (!otherEntry) return;
    setSwapConfirm({
      entryId: classification.entryId,
      otherEntryId: classification.otherEntryId,
      employeeAName: sourceEntry.employeeName,
      dateA: sourceEntry.date,
      shiftCodeA: sourceEntry.shiftCode.code,
      employeeBName: otherEntry.employeeName,
      dateB: otherEntry.date,
      shiftCodeB: otherEntry.shiftCode.code,
      status: "confirm",
    });
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
    openDragConfirm(finished.source, target, finished.hasHoveredSwapTarget);
  }

  function onDragPointerCancel() {
    setDragState(null);
  }

  async function confirmMove() {
    if (!moveConfirm) return;
    setMoveConfirm({ ...moveConfirm, status: "loading" });
    const result = await moveRosterEntry(moveConfirm.entryId, { date: moveConfirm.toDate });
    if (!result.ok) {
      setMoveConfirm((prev) => (prev ? { ...prev, status: "error", error: result.error } : prev));
      return;
    }
    setMoveConfirm(null);
    router.refresh();
  }

  async function confirmReassign() {
    if (!reassignConfirm) return;
    setReassignConfirm({ ...reassignConfirm, status: "loading" });
    const result = await reassignRosterEntry(reassignConfirm.entryId, { employeeUserId: reassignConfirm.toEmployeeUserId });
    if (!result.ok) {
      setReassignConfirm((prev) => (prev ? { ...prev, status: "error", error: result.error } : prev));
      return;
    }
    setReassignConfirm(null);
    router.refresh();
  }

  async function confirmSwap() {
    if (!swapConfirm) return;
    setSwapConfirm({ ...swapConfirm, status: "loading" });
    const result = await swapRosterEntries(swapConfirm.entryId, { otherEntryId: swapConfirm.otherEntryId });
    if (!result.ok) {
      setSwapConfirm((prev) => (prev ? { ...prev, status: "error", error: result.error } : prev));
      return;
    }
    setSwapConfirm(null);
    router.refresh();
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

      <label className="print:hidden flex items-center gap-2 text-xs text-cream/50 mb-3">
        <input
          type="checkbox"
          checked={showEmptyRows}
          onChange={(e) => setShowEmptyRows(e.target.checked)}
          className="accent-coral"
        />
        Show employees with no shifts this month ({hiddenCount})
      </label>

      <div className="overflow-x-auto print:overflow-visible border border-cream/10 print:border-0 rounded-xl print:rounded-none">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr>
              <th className="sticky left-0 bg-ink2 text-left px-3 py-2 eyebrow text-cream/40 min-w-[180px]">Employee</th>
              {dates.map((d) => {
                const isToday = d === todayKey;
                const isWeekend = isWeekendDate(d);
                return (
                  <th
                    key={d}
                    className={`px-1 py-2 text-center text-xs min-w-[44px] border-l ${
                      isToday ? "border-l-2 border-l-cream" : "border-cream/10"
                    } ${isWeekend ? "bg-ink3/40" : ""} ${isToday ? "text-cream" : "text-cream/40"}`}
                  >
                    <div className={isToday ? "font-semibold" : ""}>{Number(d.slice(8, 10))}</div>
                    <div className="eyebrow">{weekdayAbbrFor(d)}</div>
                  </th>
                );
              })}
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
                      const isToday = d === todayKey;
                      const isWeekend = isWeekendDate(d);
                      return (
                        <td
                          key={d}
                          className={`text-center text-[10px] py-1 border-l ${isToday ? "border-l-2 border-l-cream" : "border-cream/10"} ${
                            warning ? "bg-coral/20 text-coral" : isWeekend ? "bg-ink3/20 text-cream/20" : "text-cream/20"
                          }`}
                          title={warning ? `${warning.workingCount} working, minimum ${warning.minimumWorking}` : undefined}
                        >
                          {warning ? `${warning.workingCount}/${warning.minimumWorking}` : ""}
                        </td>
                      );
                    })}
                  </tr>
                )}
                {group.area === null && isAdmin && (
                  <tr key="bulk-assign-area" className="print:hidden">
                    <td colSpan={dates.length + 1} className="bg-ink2/30 px-3 py-2">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-cream/50">{bulkSelected.size} selected</span>
                        <select
                          value={bulkArea}
                          onChange={(e) => setBulkArea(e.target.value as StaffArea | "")}
                          className="bg-ink2 border-b border-cream/25 py-1 text-cream text-xs focus:outline-none focus:border-coral"
                        >
                          <option value="">Assign area…</option>
                          {STAFF_AREAS.map((a) => (
                            <option key={a} value={a}>
                              {STAFF_AREA_LABELS[a]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={handleBulkAssign}
                          disabled={!bulkArea || bulkSelected.size === 0 || bulkSaving}
                          className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-3 py-1 text-xs font-medium disabled:opacity-50"
                        >
                          {bulkSaving ? "…" : `Assign to ${bulkSelected.size}`}
                        </button>
                        {bulkError && <span className="text-coral">{bulkError}</span>}
                      </div>
                    </td>
                  </tr>
                )}
                {group.employees.map((emp) => (
                  <tr key={emp.id}>
                    <td className="sticky left-0 bg-ink px-3 py-2 truncate max-w-[180px]">
                      {group.area === null && isAdmin && (
                        <input
                          type="checkbox"
                          checked={bulkSelected.has(emp.id)}
                          onChange={() => toggleBulkSelected(emp.id)}
                          className="print:hidden mr-2 accent-coral"
                          aria-label={`Select ${emp.name} for bulk area assignment`}
                        />
                      )}
                      {emp.name}
                    </td>
                    {dates.map((d) => {
                      const isToday = d === todayKey;
                      const isWeekend = isWeekendDate(d);
                      const entry = entriesByKey.get(`${emp.id}|${d}`);
                      const isDragSource = dragState?.source.entryId === entry?.id;
                      const isDropTarget = dragState !== null && dragState.targetEmployeeUserId === emp.id && dragState.targetDate === d;
                      // entryUnderPointer already excludes the dragged entry's own id, so a
                      // present targetEntry here is always a genuine other entry - locked is the
                      // only way it can still be an invalid target.
                      const dropInvalid = isDropTarget && dragState!.targetEntry !== null && dragState!.targetEntry.locked;
                      const dropIsSwap = isDropTarget && dragState!.targetEntry !== null && !dropInvalid;

                      const borderClass = isToday ? "border-l-2 border-l-cream" : "border-cream/10";

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
                            className={`h-11 border-l ${borderClass} cursor-cell hover:bg-cream/5 ${
                              isDropTarget && !dropIsSwap ? "bg-sea/10 ring-1 ring-inset ring-sea" : isWeekend ? "bg-ink3/20" : ""
                            }`}
                          />
                        );
                      }

                      const tapHandlers = bindTapOrDoubleClick(() => setSelectedEntry(entry));
                      const appearance = chipAppearanceFor(entry.shiftCode);
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
                          title={`${entry.shiftCode.code} · ${describeShiftHours(entry.shiftCode)}${entry.note ? ` · ${entry.note}` : ""}`}
                          className={`h-11 border-l ${borderClass} text-center align-middle select-none ${isWeekend ? "bg-ink3/20" : ""} ${
                            // touch-none on every draggable chip, set statically (never inside
                            // onChipPointerDown): without it a finger drag pans the grid and fires
                            // pointercancel on the first move. Same as PropertyMapView's tiles.
                            entry.locked ? "cursor-not-allowed" : "cursor-grab active:cursor-grabbing touch-none"
                          } ${isDragSource ? "opacity-40" : ""} ${dropIsSwap ? "ring-2 ring-sea" : ""} ${dropInvalid ? "ring-2 ring-coral" : ""}`}
                        >
                          <span
                            className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs ${
                              appearance ? "" : "bg-ink2/60 border border-cream/10"
                            }`}
                            style={appearance ? { ...appearance.style, color: appearance.textColor } : undefined}
                          >
                            {appearance?.glyph && <span aria-hidden="true">{appearance.glyph}</span>}
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
          <tfoot>
            <tr>
              <td className="sticky left-0 bg-ink2 px-3 py-1.5 text-xs text-cream/50 border-t border-cream/10">Working</td>
              {dates.map((d) => {
                const isToday = d === todayKey;
                const warnings = coverageWarningsFor(d);
                return (
                  <td
                    key={d}
                    className={`text-center text-xs py-1.5 border-t border-l ${isToday ? "border-l-2 border-l-cream" : "border-cream/10"} ${
                      warnings.length > 0 ? "bg-coral/20 text-coral" : "text-cream/70"
                    }`}
                    title={
                      warnings.length > 0
                        ? warnings.map((w) => `${STAFF_AREA_LABELS[w.staffArea]}: ${w.workingCount}/${w.minimumWorking}`).join(", ")
                        : undefined
                    }
                  >
                    {workingByDate.get(d) ?? 0}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="sticky left-0 bg-ink2 px-3 py-1.5 text-xs text-cream/50">Off</td>
              {dates.map((d) => {
                const isToday = d === todayKey;
                return (
                  <td key={d} className={`text-center text-xs py-1.5 border-l ${isToday ? "border-l-2 border-l-cream" : "border-cream/10"} text-cream/70`}>
                    {employeeIds.size - (presentByDate.get(d) ?? 0)}
                  </td>
                );
              })}
            </tr>
            <tr>
              <td className="sticky left-0 bg-ink2 px-3 py-1.5 text-xs text-cream/50">Absent</td>
              {dates.map((d) => {
                const isToday = d === todayKey;
                return (
                  <td key={d} className={`text-center text-xs py-1.5 border-l ${isToday ? "border-l-2 border-l-cream" : "border-cream/10"} text-cream/70`}>
                    {absentByDate.get(d) ?? 0}
                  </td>
                );
              })}
            </tr>
          </tfoot>
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

      {moveConfirm && (
        <div className="fixed inset-0 z-50 bg-ink/80 flex items-center justify-center p-4" onClick={() => moveConfirm.status !== "loading" && setMoveConfirm(null)}>
          <div className="bg-ink2 border border-cream/15 rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow text-sea mb-1">Confirm move</p>
            <p className="text-cream mb-1">{moveConfirm.employeeName}</p>
            <p className="text-sm text-cream/60 mb-4">
              {moveConfirm.shiftCode}
              <br />
              {moveConfirm.fromDate}
              <span className="text-cream/40"> → </span>
              {moveConfirm.toDate}
            </p>

            {moveConfirm.status === "error" && <p className="text-sm text-coral mb-3">{moveConfirm.error}</p>}

            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                disabled={moveConfirm.status === "loading"}
                onClick={confirmMove}
                className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-60"
              >
                {moveConfirm.status === "loading" ? "Moving…" : "Confirm"}
              </button>
              <button
                type="button"
                disabled={moveConfirm.status === "loading"}
                onClick={() => setMoveConfirm(null)}
                className="text-sm text-cream/60 hover:text-cream transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {reassignConfirm && (
        <div className="fixed inset-0 z-50 bg-ink/80 flex items-center justify-center p-4" onClick={() => reassignConfirm.status !== "loading" && setReassignConfirm(null)}>
          <div className="bg-ink2 border border-cream/15 rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow text-sea mb-1">Confirm reassign</p>
            <p className="text-sm text-cream/60 mb-4">This takes a shift off one person and gives it to another - check both before confirming.</p>
            <div className="space-y-2 mb-4 text-sm">
              <p className="text-cream">
                {reassignConfirm.fromEmployeeName}
                <span className="text-cream/40"> loses </span>
                {reassignConfirm.shiftCode}
                <span className="text-cream/40"> · </span>
                {reassignConfirm.date}
              </p>
              <p className="text-cream">
                {reassignConfirm.toEmployeeName}
                <span className="text-cream/40"> gains it</span>
              </p>
            </div>

            {reassignConfirm.status === "error" && <p className="text-sm text-coral mb-3">{reassignConfirm.error}</p>}

            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                disabled={reassignConfirm.status === "loading"}
                onClick={confirmReassign}
                className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-60"
              >
                {reassignConfirm.status === "loading" ? "Reassigning…" : "Confirm"}
              </button>
              <button
                type="button"
                disabled={reassignConfirm.status === "loading"}
                onClick={() => setReassignConfirm(null)}
                className="text-sm text-cream/60 hover:text-cream transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {swapConfirm && (
        <div className="fixed inset-0 z-50 bg-ink/80 flex items-center justify-center p-4" onClick={() => swapConfirm.status !== "loading" && setSwapConfirm(null)}>
          <div className="bg-ink2 border border-cream/15 rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow text-sea mb-1">Confirm swap</p>
            <p className="text-sm text-cream/60 mb-4">This exchanges two people's days - check both before confirming.</p>
            <div className="space-y-2 mb-4 text-sm">
              <p className="text-cream">
                {swapConfirm.employeeAName}
                <span className="text-cream/40"> · </span>
                {swapConfirm.dateA} · {swapConfirm.shiftCodeA}
                <span className="text-cream/40"> → </span>
                {swapConfirm.dateB} · {swapConfirm.shiftCodeB}
              </p>
              <p className="text-cream">
                {swapConfirm.employeeBName}
                <span className="text-cream/40"> · </span>
                {swapConfirm.dateB} · {swapConfirm.shiftCodeB}
                <span className="text-cream/40"> → </span>
                {swapConfirm.dateA} · {swapConfirm.shiftCodeA}
              </p>
            </div>

            {swapConfirm.status === "error" && <p className="text-sm text-coral mb-3">{swapConfirm.error}</p>}

            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                disabled={swapConfirm.status === "loading"}
                onClick={confirmSwap}
                className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-60"
              >
                {swapConfirm.status === "loading" ? "Swapping…" : "Confirm swap"}
              </button>
              <button
                type="button"
                disabled={swapConfirm.status === "loading"}
                onClick={() => setSwapConfirm(null)}
                className="text-sm text-cream/60 hover:text-cream transition-colors disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
