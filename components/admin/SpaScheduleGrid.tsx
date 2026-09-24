"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addDaysUTC, dateOnlyUTC, toDateKey } from "@/lib/bookings";
import { buildSlotColumns, slotIndexOf, slotSpanOf } from "@/lib/spaGridLayout";
import { updateSpaAppointmentSchedule, swapSpaAppointmentTable } from "@/lib/spaClient";
import { useTapOrDoubleClick } from "@/lib/useTapOrDoubleClick";
import { DEFAULT_COL_WIDTH_PX, MIN_COL_WIDTH_PX, MAX_COL_WIDTH_PX, loadStoredSpaGridDensity, saveStoredSpaGridDensity } from "@/lib/spaGridDensity";
import SpaAppointmentCreateModal from "@/components/admin/SpaAppointmentCreateModal";
import SpaAppointmentPanel from "@/components/admin/SpaAppointmentPanel";
import type { MenuItem, SpaAppointment, SpaSchedule, SpaTherapist } from "@/lib/posTypes";
import type { Booking } from "@/lib/types";

const ROW_HEIGHT = 44;
const LABEL_WIDTH = 160;

// BOOKED/COMPLETED are the two "something is actually happening here" states and block the
// slot's click target below; CANCELLED/NO_SHOW still render (a receptionist working the grid
// needs to see a cancellation happened, not have it vanish) but never occupy a cell - see
// SpaSchedule's own backend description ("a cancelled/no-show slot still needs to render, just
// not as occupied").
const OCCUPYING_STATUSES = new Set<SpaAppointment["status"]>(["BOOKED", "COMPLETED"]);

const STATUS_STYLES: Record<SpaAppointment["status"], string> = {
  BOOKED: "bg-sea text-ink",
  COMPLETED: "bg-green-600 text-cream",
  CANCELLED: "bg-cream/10 text-cream/40 line-through",
  NO_SHOW: "bg-coral/15 text-coral/70 line-through",
};

export default function SpaScheduleGrid({
  schedule,
  menuItems,
  bookings,
  therapists,
  date,
}: {
  schedule: SpaSchedule;
  menuItems: MenuItem[];
  bookings: Booking[];
  therapists: SpaTherapist[];
  date: string;
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
  useEffect(() => {
    const stored = loadStoredSpaGridDensity();
    if (stored !== null) setColWidth(stored);
  }, []);
  function changeColWidth(next: number) {
    setColWidth(next);
    saveStoredSpaGridDensity(next);
  }
  const [createTarget, setCreateTarget] = useState<{ tableId: string; tableLabel: string; startTime: string } | null>(null);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null);
  // Same shared gesture the booking calendar uses (lib/useTapOrDoubleClick.ts) - reused here, not
  // reimplemented, now that a drag competes with a click the same way it does on the calendar.
  const { note: notePointerType, bind: bindTapOrDoubleClick } = useTapOrDoubleClick();

  // Drag-to-reschedule state - pointer capture is set on the appointment button itself at
  // pointerdown, so subsequent move/up events for this pointerId are routed there regardless of
  // what's visually underneath; document.elementFromPoint (in onDragPointerMove) is what actually
  // finds the hovered slot, the same DOM-attribute hit-testing convention BookingCalendarGrid uses
  // for its own drags. Only a BOOKED appointment can be picked up - matches the backend's own
  // lifecycle rule (SpaAppointmentService#updateSchedule).
  const [dragState, setDragState] = useState<{
    appointmentId: string;
    durationMinutes: number;
    originalTableId: string;
    originalStartTime: string;
    tableId: string;
    startTime: string;
    // Set while hovering directly over a different, swap-eligible (BOOKED) appointment's own
    // bar - the drag-onto-another-appointment gesture, same shape as BookingCalendarGrid's own
    // swapTarget. Table only: startTime is deliberately never copied from the target here (see
    // onDragPointerMove's own comment) - the dragged appointment keeps its own time throughout,
    // only tableId previews the target's row.
    swapTarget: { appointmentId: string; tableId: string; guestName: string } | null;
    // Sticky for the life of this drag - same rule BookingCalendarGrid settled on for exactly
    // this ambiguity: once a drag has hovered a valid swap target, it has committed to being a
    // swap attempt, and a miss on release cancels the whole gesture rather than silently
    // downgrading to an ordinary reschedule of the dragged appointment alone. A drag that never
    // touched another appointment was never a swap attempt, so it keeps the existing move
    // behaviour (falls back to its last validly-hovered cell, or cancels if it never had one) -
    // see onDragPointerUp's own comment.
    hasHoveredSwapTarget: boolean;
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
    status: "confirm" | "loading" | "error";
    error?: string;
  } | null>(null);
  const [swapConfirm, setSwapConfirm] = useState<{
    appointmentId: string;
    guestName: string;
    tableLabel: string;
    otherAppointmentId: string;
    otherGuestName: string;
    otherTableLabel: string;
    status: "confirm" | "loading" | "error";
    error?: string;
  } | null>(null);

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

  function cellUnderPointer(e: React.PointerEvent): { tableId: string; startTime: string } | null {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-spa-cell]");
    if (!el || el.dataset.tableId === undefined || el.dataset.startTime === undefined) return null;
    return { tableId: el.dataset.tableId, startTime: el.dataset.startTime };
  }

  // Hit-tests for another appointment's own bar under the pointer - the swap gesture's own drop
  // target, same DOM-attribute convention cellUnderPointer uses (survives layout changes, unlike
  // coordinate math). Excludes the appointment being dragged and anything not BOOKED - swapping
  // with a cancelled/completed/no-show slot isn't a swap, matching the backend's own rule.
  function appointmentUnderPointer(e: React.PointerEvent, excludeAppointmentId: string): { appointmentId: string; tableId: string; guestName: string } | null {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-appt-id]");
    if (!el) return null;
    const { apptId, apptTableId, apptGuestName, apptStatus } = el.dataset;
    if (!apptId || !apptTableId || !apptGuestName || apptStatus !== "BOOKED") return null;
    if (apptId === excludeAppointmentId) return null;
    return { appointmentId: apptId, tableId: apptTableId, guestName: apptGuestName };
  }

  function onAppointmentPointerDown(e: React.PointerEvent<HTMLButtonElement>, a: SpaAppointment) {
    notePointerType(e);
    if (a.status !== "BOOKED") return;
    e.currentTarget.setPointerCapture(e.pointerId);
    setTouchActionNone(true);
    setDragState({
      appointmentId: a.id,
      durationMinutes: a.durationMinutes,
      originalTableId: a.tableId,
      originalStartTime: a.startTime,
      tableId: a.tableId,
      startTime: a.startTime,
      swapTarget: null,
      hasHoveredSwapTarget: false,
    });
  }

  function onDragPointerMove(e: React.PointerEvent) {
    if (!dragState) return;

    // Appointment-hover (a swap candidate) takes priority over whatever cell happens to sit
    // underneath the hovered bar - same priority BookingCalendarGrid gives its own bar-hover.
    const hoveredAppointment = appointmentUnderPointer(e, dragState.appointmentId);
    if (hoveredAppointment) {
      setDragState({ ...dragState, swapTarget: hoveredAppointment, hasHoveredSwapTarget: true, tableId: hoveredAppointment.tableId });
      return;
    }

    const target = cellUnderPointer(e);
    if (!target) return;
    setDragState({ ...dragState, swapTarget: null, tableId: target.tableId, startTime: target.startTime });
  }

  async function onDragPointerUp(e: React.PointerEvent) {
    if (!dragState) return;
    setTouchActionNone(false);
    const finished = dragState;
    setDragState(null);

    const appointment = schedule.appointments.find((a) => a.id === finished.appointmentId);
    if (!appointment) return;

    // Recomputed fresh from the release point, not from finished.swapTarget - same "don't trust
    // the last thing pointermove happened to see" principle as the plain-move recompute below.
    // The rule this drag was classified by is hasHoveredSwapTarget, not whatever's directly
    // under the pointer right now: once a drag has hovered a valid swap target at any point, it
    // has committed to being a swap attempt for the rest of the gesture, and releasing anywhere
    // that isn't a valid appointment - a table row gap, an occupied cell, empty space off the
    // grid - cancels the whole gesture rather than silently downgrading to an ordinary
    // reschedule of the dragged appointment alone. A drag that never touched another appointment
    // was never a swap attempt, so it falls through to the ordinary move logic below on a miss,
    // exactly as before.
    if (finished.hasHoveredSwapTarget) {
      const swapTarget = appointmentUnderPointer(e, finished.appointmentId);
      if (!swapTarget) return; // aimed at another appointment, missed on release - cancel, don't fall back to a move
      const otherAppointment = schedule.appointments.find((a) => a.id === swapTarget.appointmentId);
      if (!otherAppointment) return;
      setSwapConfirm({
        appointmentId: appointment.id,
        guestName: appointment.guestName,
        tableLabel: appointment.tableLabel,
        otherAppointmentId: otherAppointment.id,
        otherGuestName: otherAppointment.guestName,
        otherTableLabel: otherAppointment.tableLabel,
        status: "confirm",
      });
      return;
    }

    // Recomputed fresh from the release point, not read off dragState - dragState only updates
    // while the pointer sits over a valid cell (see onDragPointerMove's own early return), so once
    // the pointer leaves the grid it keeps whatever the last valid cell was. Committing that stale
    // value here would move the appointment on a drop over nothing, which isn't intent - Escape
    // already exists for "changed my mind mid-drag", a drop outside the grid is the pointer
    // equivalent and cancels the same way, unconditionally, even back onto the original cell.
    const target = cellUnderPointer(e);
    if (!target) return;
    if (target.tableId === finished.originalTableId && target.startTime === finished.originalStartTime) return;

    setMoveConfirm({
      appointmentId: finished.appointmentId,
      guestName: appointment.guestName,
      treatmentNames: appointment.treatments.map((t) => t.treatmentName).join(", "),
      therapistUserId: appointment.therapistUserId,
      fromTableLabel: tableLabelById.get(finished.originalTableId) ?? finished.originalTableId,
      fromStartTime: finished.originalStartTime,
      toTableId: target.tableId,
      toTableLabel: tableLabelById.get(target.tableId) ?? target.tableId,
      toStartTime: target.startTime,
      status: "confirm",
    });
  }

  function onDragPointerCancel() {
    setTouchActionNone(false);
    setDragState(null);
  }

  async function confirmMove() {
    if (!moveConfirm) return;
    setMoveConfirm({ ...moveConfirm, status: "loading" });
    const result = await updateSpaAppointmentSchedule(moveConfirm.appointmentId, {
      tableId: moveConfirm.toTableId,
      therapistUserId: moveConfirm.therapistUserId,
      date: schedule.date,
      startTime: moveConfirm.toStartTime,
    });
    if (!result.ok) {
      setMoveConfirm((prev) => (prev ? { ...prev, status: "error", error: result.error } : prev));
      return;
    }
    setMoveConfirm(null);
    router.refresh();
  }

  async function confirmTableSwap() {
    if (!swapConfirm) return;
    setSwapConfirm({ ...swapConfirm, status: "loading" });
    const result = await swapSpaAppointmentTable(swapConfirm.appointmentId, { otherAppointmentId: swapConfirm.otherAppointmentId });
    if (!result.ok) {
      setSwapConfirm((prev) => (prev ? { ...prev, status: "error", error: result.error } : prev));
      return;
    }
    setSwapConfirm(null);
    router.refresh();
  }

  // The moving appointment's own row/column follows dragState only while a drag is actually
  // live - dragState is cleared before moveConfirm is ever set (see onDragPointerUp), so the bar
  // renders back at its real position the instant the pointer is released, and stays there,
  // dialog open on top, until confirmMove resolves. A plain array map, not a second appointments
  // list, so every other read (occupiedCols, the bar itself) stays in sync with exactly one
  // appointment's position at a time.
  const effectiveAppointments = schedule.appointments.map((a) => {
    if (dragState && dragState.appointmentId === a.id) return { ...a, tableId: dragState.tableId, startTime: dragState.startTime };
    return a;
  });

  const appointmentsByTable = new Map<string, SpaAppointment[]>();
  for (const a of effectiveAppointments) {
    const list = appointmentsByTable.get(a.tableId) ?? [];
    list.push(a);
    appointmentsByTable.set(a.tableId, list);
  }

  function goToDate(next: string) {
    router.push(`/admin/spa?date=${next}`);
  }

  const selectedAppointment = schedule.appointments.find((a) => a.id === selectedAppointmentId) ?? null;
  const treatments = menuItems.filter((m) => m.department === "SPA" && m.durationMinutes != null);

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
        <span className="text-sm text-cream/70 font-medium">{date}</span>
        <button
          type="button"
          onClick={() => goToDate(toDateKey(addDaysUTC(dateOnlyUTC(date), 1)))}
          className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-3 py-1.5 text-sm"
        >
          Next day →
        </button>
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
                if (!OCCUPYING_STATUSES.has(a.status)) continue;
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
                        disabled={occupiedCols.has(i)}
                        onClick={() => setCreateTarget({ tableId: table.id, tableLabel: table.label, startTime: c })}
                        className={`absolute top-0 bottom-0 border-r border-cream/5 ${
                          occupiedCols.has(i) ? "" : "hover:bg-cream/5 cursor-cell"
                        }`}
                        style={{ left: i * colWidth, width: colWidth }}
                        aria-label={`Book ${table.label} at ${c}`}
                      />
                    ))}

                    {appts.map((a) => {
                      const start = slotIndexOf(a.startTime, schedule.openingTime, schedule.slotMinutes);
                      const span = slotSpanOf(a.durationMinutes, schedule.slotMinutes);
                      const dragging = dragState?.appointmentId === a.id;
                      const isSwapTarget = dragState?.swapTarget?.appointmentId === a.id;
                      const tapHandlers = bindTapOrDoubleClick(() => setSelectedAppointmentId(a.id));
                      return (
                        <button
                          key={a.id}
                          type="button"
                          data-appt-id={a.id}
                          data-appt-table-id={a.tableId}
                          data-appt-guest-name={a.guestName}
                          data-appt-status={a.status}
                          onPointerDown={(e) => onAppointmentPointerDown(e, a)}
                          onPointerMove={onDragPointerMove}
                          onPointerUp={onDragPointerUp}
                          onPointerCancel={onDragPointerCancel}
                          onClick={tapHandlers.onClick}
                          onDoubleClick={tapHandlers.onDoubleClick}
                          className={`absolute rounded-md flex items-center gap-1 px-2 text-xs truncate ${STATUS_STYLES[a.status]} ${
                            dragging ? "opacity-50 ring-2 ring-dashed ring-cream" : ""
                          } ${isSwapTarget ? "ring-2 ring-sea" : ""} ${
                            // touch-none is static, not left to onAppointmentPointerDown's
                            // setTouchActionNone: a browser fixes a touch gesture's touch-action
                            // when the finger lands, so setting it inside pointerdown is too late -
                            // the first move pans and fires pointercancel. Same as PropertyMapView.
                            a.status === "BOOKED" ? "cursor-grab active:cursor-grabbing touch-none" : ""
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
                          }}
                          title={`${a.guestName} · ${a.treatments.map((t) => t.treatmentName).join(", ")} · ${a.status}`}
                        >
                          <span className="truncate">{a.guestName}</span>
                          {a.treatments.length > 1 && <span className="text-[10px] opacity-70">×{a.treatments.length}</span>}
                          {a.missingTreatmentNames.length > 0 && <span title="Not yet fully charged">⚠</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
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

            {swapConfirm.status === "error" && <p className="text-sm text-coral mb-3">{swapConfirm.error}</p>}

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
