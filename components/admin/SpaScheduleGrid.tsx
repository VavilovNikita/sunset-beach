"use client";

import { useCloseOnBrowserBack } from "@/lib/useCloseOnBrowserBack";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addDaysUTC, dateOnlyUTC, toDateKey } from "@/lib/bookings";
import { buildSlotColumns, slotIndexOf, slotSpanOf } from "@/lib/spaGridLayout";
import { updateSpaAppointmentSchedule, swapSpaAppointmentTable } from "@/lib/spaClient";
import { useTapOrDoubleClick } from "@/lib/useTapOrDoubleClick";
import { DEFAULT_COL_WIDTH_PX, MIN_COL_WIDTH_PX, MAX_COL_WIDTH_PX, fitColWidth, loadStoredSpaGridDensity, saveStoredSpaGridDensity } from "@/lib/spaGridDensity";
import SpaAppointmentCreateModal from "@/components/admin/SpaAppointmentCreateModal";
import SpaAppointmentPanel from "@/components/admin/SpaAppointmentPanel";
import type { MenuItem, SpaAppointment, SpaSchedule, SpaTherapist } from "@/lib/posTypes";
import type { Booking } from "@/lib/types";
import { formatDate } from "@/lib/formatDate";
import { hotelDateKey } from "@/lib/hotelDate";
import { isSpaOverdue, isSpaStartInPast, spaBlockMark, spaBlockTitle } from "@/lib/spaAppointmentDisplay";
import { resolveSpaDrop, spaDragBlock, spaDropMessage, SPA_OCCUPYING_STATUSES, type SpaCell } from "@/lib/spaDrag";
import { useDragListeners } from "@/lib/useDragListeners";
import { pressMoved, type DragPoint, type DragPress } from "@/lib/dragPress";

const ROW_HEIGHT = 44;
const LABEL_WIDTH = 160;

const STATUS_STYLES: Record<SpaAppointment["status"], string> = {
  BOOKED: "bg-sea text-ink",
  COMPLETED: "bg-green-600 text-cream",
  // Shape, not a new colour (the palette is full): a dashed outline over hatching, plus the ✕/⊘
  // mark from spaBlockMark - so a cancellation can't pass for an ordinary appointment that has
  // simply happened.
  CANCELLED: "text-cream/50 border border-dashed border-cream/40",
  NO_SHOW: "text-coral/80 border border-dashed border-coral/60",
};

const STATUS_HATCH: Partial<Record<SpaAppointment["status"], string>> = {
  CANCELLED: "repeating-linear-gradient(-45deg, rgba(245,239,230,0.10) 0px 5px, rgba(245,239,230,0.02) 5px 10px)",
  NO_SHOW: "repeating-linear-gradient(-45deg, rgba(226,97,47,0.18) 0px 5px, rgba(226,97,47,0.04) 5px 10px)",
};

export default function SpaScheduleGrid({
  schedule,
  menuItems,
  bookings,
  therapists,
  date,
  readOnly = false,
  currentUserId,
}: {
  schedule: SpaSchedule;
  menuItems: MenuItem[];
  bookings: Booking[];
  therapists: SpaTherapist[];
  date: string;
  // A therapist below CASHIER reads the schedule: free slots book nothing, appointments can't be
  // picked up, and the details panel offers no action. The server refuses every one of those too.
  readOnly?: boolean;
  // The signed-in user, so a therapist's own appointments are outlined.
  currentUserId?: string;
}) {
  const router = useRouter();
  const gridRef = useRef<HTMLDivElement>(null);
  const columns = buildSlotColumns(schedule.openingTime, schedule.closingTime, schedule.slotMinutes);
  // Used by the move-confirm dialog below, same reason BookingCalendarGrid keeps its own
  // roomUnitLabelById - a table id alone doesn't tell a receptionist which physical table a
  // drag actually landed on.
  const tableLabelById = new Map(schedule.tables.map((t) => [t.id, t.label]));
  // Density is client state, not URL-owned, same reasoning as the booking calendar's own: it
  // never changes what's fetched, only how the same schedule renders - hydrated from
  // localStorage once on mount (SSR has no localStorage, so first paint always uses the default).
  const [colWidth, setColWidth] = useState(DEFAULT_COL_WIDTH_PX);
  // Until the person moves the slider the columns are sized to fit the screen (fitColWidth); once they do, their
  // choice is stored and wins.
  const [userChoseDensity, setUserChoseDensity] = useState(false);
  useEffect(() => {
    const stored = loadStoredSpaGridDensity();
    if (stored !== null) {
      setColWidth(stored);
      setUserChoseDensity(true);
    }
  }, []);
  function changeColWidth(next: number) {
    setUserChoseDensity(true);
    setColWidth(next);
    saveStoredSpaGridDensity(next);
  }
  const columnCount = columns.length;
  useEffect(() => {
    if (userChoseDensity) return;
    const box = gridRef.current;
    if (!box) return;
    const apply = () => setColWidth(fitColWidth(box.clientWidth, LABEL_WIDTH, columnCount));
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(box);
    return () => observer.disconnect();
  }, [userChoseDensity, columnCount, schedule.tables.length]);
  const [createTarget, setCreateTarget] = useState<{ tableId: string; tableLabel: string; startTime: string } | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  // Same shared gesture the booking calendar uses (lib/useTapOrDoubleClick.ts) - reused here, not
  // reimplemented, now that a drag competes with a click the same way it does on the calendar.
  const { note: notePointerType, bind: bindTapOrDoubleClick } = useTapOrDoubleClick();

  // Drag-to-reschedule state - pointer capture is set on the appointment button itself at
  // pointerdown, so subsequent move/up events for this pointerId are routed there regardless of
  // what's visually underneath; cellUnderPointer finds the hovered slot, the same DOM-attribute
  // hit-testing convention BookingCalendarGrid uses for its own drags, and lib/spaDrag.ts says what
  // that slot means. Only a BOOKED appointment can be picked up - matches the backend's own
  // lifecycle rule (SpaAppointmentService#updateSchedule).
  const [dragState, setDragState] = useState<{
    appointmentId: string;
    durationMinutes: number;
    originalTableId: string;
    originalStartTime: string;
    tableId: string;
    startTime: string;
    // The booked appointment under the pointer that a release now would swap tables with - highlighted. The preview
    // keeps the dragged appointment's own time and shows it on that table: a swap exchanges tables only.
    swapTargetId: string | null;
  } | null>(null);
  // Nothing moves on drop - same rule BookingCalendarGrid's own scheduleConfirm follows. The bar
  // snaps back to wherever it actually is the instant the pointer is released (dragState is
  // cleared first, below, before this is set - see effectiveAppointments, which no longer has
  // anything to read once dragState is gone) and only moves for real once confirmMove resolves.
  // Cancelling this dialog is then just "don't call the API" - there's nothing to roll back
  // because nothing was ever applied.
  const [moveConfirm, setMoveConfirm] = useState<{
    appointmentId: string;
    guestName: string;
    treatmentNames: string;
    therapistUserId: string;
    fromTableLabel: string;
    fromStartTime: string;
    toTableId: string;
    toTableLabel: string;
    toStartTime: string;
    status: "confirm" | "loading";
  } | null>(null);
  const [swapConfirm, setSwapConfirm] = useState<{
    appointmentId: string;
    guestName: string;
    tableLabel: string;
    otherAppointmentId: string;
    otherGuestName: string;
    otherTableLabel: string;
    status: "confirm" | "loading";
  } | null>(null);

  // Why the last drag changed nothing, or the server's refusal of a confirmed one - next to the grid.
  const [gridMessage, setGridMessage] = useState<string | null>(null);
  const pressRef = useRef<DragPress | null>(null);
  // A press on an appointment that cannot move: dragging it says why instead of doing nothing.
  const [blockedPress, setBlockedPress] = useState<string | null>(null);

  function setTouchActionNone(active: boolean) {
    if (gridRef.current) gridRef.current.style.touchAction = active ? "none" : "";
  }

  // Escape cancels an in-progress drag - the only way to back out of one without a mouse, same
  // as BookingCalendarGrid's own keyboard handler (dragging itself has no keyboard equivalent).
  useEffect(() => {
    if (!dragState) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setTouchActionNone(false);
        setDragState(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragState]);

  // The slot under the pointer. A bar lies over the cells it occupies, so over a bar the cell is looked for beneath
  // it; anything else on top (the sticky table column or time header) is not a slot, whatever lies under it.
  function cellUnderPointer(e: DragPoint): SpaCell | null {
    const top = document.elementFromPoint(e.clientX, e.clientY);
    let el = top?.closest<HTMLElement>("[data-spa-cell]") ?? null;
    if (!el && top?.closest("[data-appt-id]")) {
      el = document.elementsFromPoint(e.clientX, e.clientY).find((n): n is HTMLElement => n instanceof HTMLElement && n.hasAttribute("data-spa-cell")) ?? null;
    }
    if (!el || el.dataset.tableId === undefined || el.dataset.startTime === undefined) return null;
    return { tableId: el.dataset.tableId, startTime: el.dataset.startTime };
  }

  // What a release here would do, judged against the schedule as it was loaded (never the dragged preview).
  function dropAt(e: DragPoint, appointment: SpaAppointment) {
    return resolveSpaDrop(cellUnderPointer(e), appointment, schedule.appointments, schedule, startsInPast);
  }

  function onAppointmentPointerDown(e: React.PointerEvent<HTMLButtonElement>, a: SpaAppointment) {
    notePointerType(e);
    if (readOnly) return;
    // The sentence from the last drop stays while this press lasts: taking it away now moved the whole grid up under
    // the pointer, and a release aimed at one table landed on the table below.
    pressRef.current = { pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY };
    const blocked = spaDragBlock(a, noSlotLeft());
    if (blocked) {
      // A finger moving across it is scrolling the grid, not dragging the appointment.
      if (e.pointerType !== "touch") setBlockedPress(blocked);
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    setTouchActionNone(true);
    setDragState({
      appointmentId: a.id,
      durationMinutes: a.durationMinutes,
      originalTableId: a.tableId,
      originalStartTime: a.startTime,
      tableId: a.tableId,
      startTime: a.startTime,
      swapTargetId: null,
    });
  }

  function onDragPointerMove(e: DragPoint) {
    if (!dragState) return;
    const appointment = schedule.appointments.find((a) => a.id === dragState.appointmentId);
    if (!appointment) return;
    const drop = dropAt(e, appointment);
    const original = { tableId: dragState.originalTableId, startTime: dragState.originalStartTime };
    if (drop.kind === "swap") {
      setDragState({ ...dragState, swapTargetId: drop.other.id, tableId: drop.other.tableId, startTime: original.startTime });
    } else if (drop.kind === "move") {
      setDragState({ ...dragState, swapTargetId: null, ...drop.cell });
    } else if (drop.kind === "stay") {
      setDragState({ ...dragState, swapTargetId: null, ...original });
    } else {
      // Over nothing it could go to: the bar stays where it was last drawn.
      setDragState({ ...dragState, swapTargetId: null });
    }
  }

  function onDragPointerUp(e: DragPoint, moved: boolean) {
    if (!dragState) return;
    setTouchActionNone(false);
    const finished = dragState;
    setDragState(null);

    const appointment = schedule.appointments.find((a) => a.id === finished.appointmentId);
    // A press that never moved is a click on the appointment, answered by its own handlers.
    if (!appointment || !moved) return;
    setGridMessage(null);

    // Judged from the release point alone, not from the preview: dragState keeps the last place the bar could go, and
    // committing that on a drop over nothing would move the appointment without anyone having aimed there.
    const drop = dropAt(e, appointment);
    if (drop.kind === "stay") return;
    if (drop.kind === "miss") {
      setGridMessage(spaDropMessage(drop.miss, appointment.guestName));
      return;
    }
    if (drop.kind === "swap") {
      setSwapConfirm({
        appointmentId: appointment.id,
        guestName: appointment.guestName,
        tableLabel: appointment.tableLabel,
        otherAppointmentId: drop.other.id,
        otherGuestName: drop.other.guestName,
        otherTableLabel: drop.other.tableLabel,
        status: "confirm",
      });
      return;
    }
    setMoveConfirm({
      appointmentId: finished.appointmentId,
      guestName: appointment.guestName,
      treatmentNames: appointment.treatments.map((t) => t.treatmentName).join(", "),
      therapistUserId: appointment.therapistUserId,
      fromTableLabel: tableLabelById.get(finished.originalTableId) ?? finished.originalTableId,
      fromStartTime: finished.originalStartTime,
      toTableId: drop.cell.tableId,
      toTableLabel: tableLabelById.get(drop.cell.tableId) ?? drop.cell.tableId,
      toStartTime: drop.cell.startTime,
      status: "confirm",
    });
  }

  function onDragAbort(moved: boolean) {
    if (!dragState) return;
    setTouchActionNone(false);
    setDragState(null);
    const appointment = schedule.appointments.find((a) => a.id === dragState.appointmentId);
    if (moved && appointment) setGridMessage(spaDropMessage({ kind: "interrupted" }, appointment.guestName));
  }

  useDragListeners(dragState !== null, pressRef, { onMove: onDragPointerMove, onUp: onDragPointerUp, onAbort: onDragAbort });
  useDragListeners(blockedPress !== null, pressRef, {
    onMove: (e) => {
      if (blockedPress && pressRef.current && pressMoved(pressRef.current, e)) {
        setGridMessage(blockedPress);
        setBlockedPress(null);
      }
    },
    onUp: () => setBlockedPress(null),
    onAbort: () => setBlockedPress(null),
  });

  async function confirmMove() {
    if (!moveConfirm) return;
    setMoveConfirm({ ...moveConfirm, status: "loading" });
    const result = await updateSpaAppointmentSchedule(moveConfirm.appointmentId, {
      tableId: moveConfirm.toTableId,
      therapistUserId: moveConfirm.therapistUserId,
      date: schedule.date,
      startTime: moveConfirm.toStartTime,
    });
    setMoveConfirm(null);
    // Refused: the appointment is where it was (nothing was drawn as moved), and the server's reason is by the grid.
    if (!result.ok) setGridMessage(`Not moved: ${result.error}`);
    router.refresh();
  }

  async function confirmTableSwap() {
    if (!swapConfirm) return;
    setSwapConfirm({ ...swapConfirm, status: "loading" });
    const result = await swapSpaAppointmentTable(swapConfirm.appointmentId, { otherAppointmentId: swapConfirm.otherAppointmentId });
    setSwapConfirm(null);
    if (!result.ok) setGridMessage(`Tables not swapped: ${result.error}`);
    router.refresh();
  }

  // The moving appointment's own row/column follows dragState only while a drag is actually
  // live - dragState is cleared before moveConfirm is ever set (see onDragPointerUp), so the bar
  // renders back at its real position the instant the pointer is released, and stays there,
  // dialog open on top, until confirmMove resolves. A plain array map, not a second appointments
  // list, so every other read (occupiedCols, the bar itself) stays in sync with exactly one
  // appointment's position at a time.
  //
  // The read-only view (a therapist below CASHIER) does not list cancelled appointments: they are
  // not that person's work, and a hatched "cancelled" bar between real treatments reads as clutter.
  // Whoever manages the grid keeps seeing them (a receptionist needs to see that a cancellation happened).
  const effectiveAppointments = schedule.appointments.filter((a) => !(readOnly && a.status === "CANCELLED")).map((a) => {
    if (dragState && dragState.appointmentId === a.id) return { ...a, tableId: dragState.tableId, startTime: dragState.startTime };
    return a;
  });

  const appointmentsByTable = new Map<string, SpaAppointment[]>();
  for (const a of effectiveAppointments) {
    const list = appointmentsByTable.get(a.tableId) ?? [];
    list.push(a);
    appointmentsByTable.set(a.tableId, list);
  }

  // The day lives in the URL (?date=), so a reload or a shared link stays on it.
  function goToDate(next: string) {
    router.push(`/admin/spa?date=${next}`);
  }
  // The hotel's date, not UTC's or the browser's - same rule as the booking calendar's Today.
  const todayKey = hotelDateKey(new Date());
  // A treatment never starts in the past (the server refuses it); the slot under way still can.
  const slotGrid = { openingTime: schedule.openingTime, slotMinutes: schedule.slotMinutes };
  const startsInPast = (startTime: string) => isSpaStartInPast(date, startTime, new Date(), slotGrid);
  const noSlotLeft = () => columns.every(startsInPast);

  const selectedAppointment = schedule.appointments.find((a) => a.id === selectedAppointmentId) ?? null;
  const treatments = menuItems.filter((m) => m.department === "SPA" && m.durationMinutes != null);

  // Back closes an open confirmation instead of leaving the schedule.
  useCloseOnBrowserBack(moveConfirm !== null, () => {
    if (moveConfirm?.status !== "loading") setMoveConfirm(null);
  });
  useCloseOnBrowserBack(swapConfirm !== null, () => setSwapConfirm(null));

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button
          type="button"
          onClick={() => goToDate(toDateKey(addDaysUTC(dateOnlyUTC(date), -1)))}
          className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-3 py-1.5 text-sm"
        >
          ← Prev day
        </button>
        <span className="text-sm text-cream/70 font-medium">{formatDate(date)}</span>
        <button
          type="button"
          onClick={() => goToDate(toDateKey(addDaysUTC(dateOnlyUTC(date), 1)))}
          className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-3 py-1.5 text-sm"
        >
          Next day →
        </button>
        <button
          type="button"
          onClick={() => goToDate(todayKey)}
          disabled={date === todayKey}
          className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-3 py-1.5 text-sm disabled:opacity-40"
        >
          Today
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && goToDate(e.target.value)}
          aria-label="Go to date"
          className="bg-ink2 border border-cream/20 rounded-lg px-3 py-1.5 text-sm"
        />
        <div className="flex items-center gap-2 ml-auto">
          <span className="eyebrow text-cream/40">Density</span>
          <input
            type="range"
            min={MIN_COL_WIDTH_PX}
            max={MAX_COL_WIDTH_PX}
            step={1}
            value={colWidth}
            onChange={(e) => changeColWidth(Number(e.target.value))}
            className="w-32 accent-coral"
            aria-label="Spa grid column density"
          />
        </div>
      </div>

      {schedule.tables.length === 0 ? (
        <p className="text-sm text-cream/40 bg-ink2/40 border border-cream/10 rounded-xl px-4 py-3">
          No active tables in the SPA zone yet.
        </p>
      ) : (
        <>
        {effectiveAppointments.length === 0 && (
          <p className="mb-3 text-sm text-cream/50 bg-ink2/40 border border-cream/10 rounded-xl px-4 py-3">No appointments on this day.</p>
        )}
        {gridMessage && (
          <p role="status" className="mb-3 text-sm text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded-lg px-4 py-2">
            {gridMessage}
          </p>
        )}
        <div ref={gridRef} className="overflow-auto border border-cream/10 rounded-xl">
          <div style={{ width: LABEL_WIDTH + columns.length * colWidth }}>
            <div className="flex sticky top-0 z-20 bg-ink2 border-b border-cream/10">
              <div className="sticky left-0 z-30 bg-ink2 shrink-0" style={{ width: LABEL_WIDTH }} />
              {columns.map((c) => (
                <div
                  key={c}
                  className="shrink-0 text-center text-[10px] text-cream/40 py-1.5 border-r border-cream/5"
                  style={{ width: colWidth }}
                >
                  {c}
                </div>
              ))}
            </div>

            {schedule.tables.map((table) => {
              const appts = appointmentsByTable.get(table.id) ?? [];
              const occupiedCols = new Set<number>();
              for (const a of appts) {
                // A cancelled or no-show appointment still renders (see SpaSchedule's own backend description)
                // but never occupies a cell.
                if (!SPA_OCCUPYING_STATUSES.has(a.status)) continue;
                const start = slotIndexOf(a.startTime, schedule.openingTime, schedule.slotMinutes);
                const span = slotSpanOf(a.durationMinutes, schedule.slotMinutes);
                for (let i = start; i < start + span; i++) occupiedCols.add(i);
              }

              return (
                <div key={table.id} className="flex border-b border-cream/5 relative" style={{ height: ROW_HEIGHT }}>
                  <div
                    className="sticky left-0 z-10 bg-ink shrink-0 flex items-center px-3 text-sm text-cream/80 truncate"
                    style={{ width: LABEL_WIDTH }}
                    title={table.label}
                  >
                    {table.label}
                  </div>
                  <div className="relative shrink-0" style={{ width: columns.length * colWidth, height: ROW_HEIGHT }}>
                    {columns.map((c, i) => (
                      <button
                        key={c}
                        type="button"
                        data-spa-cell
                        data-table-id={table.id}
                        data-start-time={c}
                        disabled={readOnly || occupiedCols.has(i) || startsInPast(c)}
                        onClick={readOnly ? undefined : () => setCreateTarget({ tableId: table.id, tableLabel: table.label, startTime: c })}
                        className={`absolute top-0 bottom-0 border-r border-cream/5 ${
                          readOnly || occupiedCols.has(i) || startsInPast(c) ? "" : "hover:bg-cream/5 cursor-cell"
                        }`}
                        style={{ left: i * colWidth, width: colWidth }}
                        title={startsInPast(c) ? "Already passed" : undefined}
                        aria-label={readOnly ? `${table.label} at ${c}` : `Book ${table.label} at ${c}`}
                      />
                    ))}

                    {appts.map((a) => {
                      const start = slotIndexOf(a.startTime, schedule.openingTime, schedule.slotMinutes);
                      const span = slotSpanOf(a.durationMinutes, schedule.slotMinutes);
                      const dragging = dragState?.appointmentId === a.id;
                      const isSwapTarget = dragState?.swapTargetId === a.id;
                      const tapHandlers = bindTapOrDoubleClick(() => setSelectedAppointmentId(a.id));
                      const mark = spaBlockMark(a.status);
                      const overdue = isSpaOverdue(a, new Date());
                      return (
                        <button
                          key={a.id}
                          type="button"
                          data-appt-id={a.id}
                          onPointerDown={(e) => onAppointmentPointerDown(e, a)}
                          onClick={tapHandlers.onClick}
                          onDoubleClick={tapHandlers.onDoubleClick}
                          className={`absolute rounded-md flex items-center gap-1 px-2 text-xs truncate ${STATUS_STYLES[a.status]} ${
                            dragging ? "opacity-50 ring-2 ring-dashed ring-cream" : ""
                          } ${isSwapTarget ? "ring-2 ring-sea" : ""} ${
                            // The therapist's own appointment: a cream outline (a shape - the palette is full).
                            currentUserId && a.therapistUserId === currentUserId ? "outline outline-2 outline-offset-1 outline-cream font-semibold" : ""
                          } ${
                            // touch-none is static, not left to onAppointmentPointerDown's
                            // setTouchActionNone: a browser fixes a touch gesture's touch-action
                            // when the finger lands, so setting it inside pointerdown is too late -
                            // the first move pans and fires pointercancel. Same as PropertyMapView.
                            !readOnly && spaDragBlock(a, noSlotLeft()) === null ? "cursor-grab active:cursor-grabbing touch-none" : ""
                          }`}
                          // pointerEvents: "none" while dragging - same as BookingCalendarGrid's own
                          // dragged bar. Pointer capture (set in onAppointmentPointerDown) still
                          // routes this element's own move/up events to it regardless; what this
                          // actually changes is elementFromPoint, which cellUnderPointer uses to
                          // find the slot *underneath* the cursor. Left pointer-events-auto (as a
                          // static class, always on) before this fix, the dragged bar itself was
                          // always what elementFromPoint found - it was hovering right where the
                          // cursor was, since it visually follows the drag - so the hit-test never
                          // reached the [data-spa-cell] button beneath it, cellUnderPointer returned
                          // null, and onDragPointerMove's early return left dragState exactly where
                          // it last was: frozen under the cursor, jumping only when the cursor moved
                          // fast enough to briefly clear the bar's own rect.
                          style={{
                            left: start * colWidth + 2,
                            width: span * colWidth - 4,
                            top: 3,
                            height: ROW_HEIGHT - 6,
                            pointerEvents: dragging ? "none" : "auto",
                            backgroundImage: STATUS_HATCH[a.status],
                          }}
                          title={overdue ? `${spaBlockTitle(a)} · overdue - mark completed or no-show` : spaBlockTitle(a)}
                        >
                          {mark && (
                            <span className="shrink-0 font-semibold no-underline" aria-label={mark.label}>
                              {mark.icon}
                            </span>
                          )}
                          {/* The name keeps a minimum width; on a narrow block the room chip is
                              what gets squeezed (the full text is in the title either way). */}
                          <span className={`truncate min-w-[2.5rem] ${mark ? "line-through" : ""}`}>{a.guestName}</span>
                          {a.roomUnitLabel && (
                            <span className="min-w-0 truncate text-[10px] rounded px-1 bg-ink/25" title={`Room ${a.roomUnitLabel}`}>
                              {a.roomUnitLabel}
                            </span>
                          )}
                          {a.treatments.length > 1 && <span className="text-[10px] opacity-70">×{a.treatments.length}</span>}
                          {a.missingTreatmentNames.length > 0 && <span title="Not yet fully charged">⚠</span>}
                          {overdue && (
                            <span className="shrink-0 rounded px-1 text-[10px] bg-amber-400 text-ink" title="Time has passed - still marked Booked">
                              overdue
                            </span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </>
      )}

      {createTarget && (
        <SpaAppointmentCreateModal
          date={date}
          tableId={createTarget.tableId}
          tableLabel={createTarget.tableLabel}
          startTime={createTarget.startTime}
          bookings={bookings}
          therapists={therapists}
          treatments={treatments}
          dayAppointments={schedule.appointments}
          slotGrid={slotGrid}
          onClose={() => setCreateTarget(null)}
          onCreated={() => {
            setCreateTarget(null);
            router.refresh();
          }}
        />
      )}

      {selectedAppointment && (
        <SpaAppointmentPanel
          appointment={selectedAppointment}
          treatments={treatments}
          readOnly={readOnly}
          onClose={() => setSelectedAppointmentId(null)}
          onUpdated={() => {
            setSelectedAppointmentId(null);
            router.refresh();
          }}
        />
      )}

      {moveConfirm && (
        <div className="fixed inset-0 z-50 bg-ink/80 flex items-center justify-center p-4" onClick={() => moveConfirm.status !== "loading" && setMoveConfirm(null)}>
          <div className="bg-ink2 border border-cream/15 rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow text-sea mb-1">Confirm change</p>
            <p className="text-cream mb-1">{moveConfirm.guestName}</p>
            <p className="text-sm text-cream/60 mb-4">
              {moveConfirm.treatmentNames}
              <br />
              {moveConfirm.fromTableLabel} · {moveConfirm.fromStartTime}
              <span className="text-cream/40"> → </span>
              {moveConfirm.toTableLabel} · {moveConfirm.toStartTime}
            </p>


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

      {swapConfirm && (
        <div className="fixed inset-0 z-50 bg-ink/80 flex items-center justify-center p-4" onClick={() => setSwapConfirm(null)}>
          <div className="bg-ink2 border border-cream/15 rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow text-sea mb-1">Confirm table swap</p>
            <p className="text-sm text-cream/60 mb-4">This moves two guests at once - check both before confirming.</p>
            <div className="space-y-2 mb-4 text-sm">
              <p className="text-cream">
                {swapConfirm.guestName}
                <span className="text-cream/40"> · </span>
                {swapConfirm.tableLabel}
                <span className="text-cream/40"> → </span>
                {swapConfirm.otherTableLabel}
              </p>
              <p className="text-cream">
                {swapConfirm.otherGuestName}
                <span className="text-cream/40"> · </span>
                {swapConfirm.otherTableLabel}
                <span className="text-cream/40"> → </span>
                {swapConfirm.tableLabel}
              </p>
            </div>


            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                disabled={swapConfirm.status === "loading"}
                onClick={confirmTableSwap}
                className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-60"
              >
                {swapConfirm.status === "loading" ? "Swapping…" : "Confirm swap"}
              </button>
              <button
                type="button"
                onClick={() => setSwapConfirm(null)}
                className="text-sm text-cream/60 hover:text-cream transition-colors"
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
