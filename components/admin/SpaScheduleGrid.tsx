"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addDaysUTC, dateOnlyUTC, toDateKey } from "@/lib/bookings";
import { buildSlotColumns, slotIndexOf, slotSpanOf } from "@/lib/spaGridLayout";
import { updateSpaAppointmentSchedule } from "@/lib/spaClient";
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
  } | null>(null);
  // Applied to rendering immediately on drop, before the request resolves - a loser (409 table/
  // therapist conflict, or any other failure) simply reverts: pendingMove is cleared and moveError
  // shows what happened, no confirmation modal either way (unlike the calendar's swap, nothing
  // here needs to be named/confirmed up front - it's one appointment, one guest, already being
  // looked at).
  const [pendingMove, setPendingMove] = useState<{ appointmentId: string; tableId: string; startTime: string } | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

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
    });
  }

  function onDragPointerMove(e: React.PointerEvent) {
    if (!dragState) return;
    const target = cellUnderPointer(e);
    if (!target) return;
    setDragState({ ...dragState, tableId: target.tableId, startTime: target.startTime });
  }

  async function onDragPointerUp(e: React.PointerEvent) {
    if (!dragState) return;
    setTouchActionNone(false);
    const finished = dragState;
    setDragState(null);

    // Recomputed fresh from the release point, not read off dragState - dragState only updates
    // while the pointer sits over a valid cell (see onDragPointerMove's own early return), so once
    // the pointer leaves the grid it keeps whatever the last valid cell was. Committing that stale
    // value here would move the appointment on a drop over nothing, which isn't intent - Escape
    // already exists for "changed my mind mid-drag", a drop outside the grid is the pointer
    // equivalent and cancels the same way, unconditionally, even back onto the original cell.
    const target = cellUnderPointer(e);
    if (!target) return;
    if (target.tableId === finished.originalTableId && target.startTime === finished.originalStartTime) return;

    const appointment = schedule.appointments.find((a) => a.id === finished.appointmentId);
    if (!appointment) return;

    setMoveError(null);
    setPendingMove({ appointmentId: finished.appointmentId, tableId: target.tableId, startTime: target.startTime });
    const result = await updateSpaAppointmentSchedule(finished.appointmentId, {
      tableId: target.tableId,
      therapistUserId: appointment.therapistUserId,
      date: schedule.date,
      startTime: target.startTime,
    });
    if (!result.ok) {
      setPendingMove(null); // revert - the optimistic position was never real
      setMoveError(result.error);
      return;
    }
    setPendingMove(null);
    router.refresh();
  }

  function onDragPointerCancel() {
    setTouchActionNone(false);
    setDragState(null);
  }

  // The moving appointment's own row/column follows dragState while a drag is live, then
  // pendingMove once dropped (optimistic, until the request resolves) - a plain array map, not a
  // second appointments list, so every other read (occupiedCols, the bar itself) stays in sync
  // with exactly one appointment's position at a time.
  const effectiveAppointments = schedule.appointments.map((a) => {
    if (dragState && dragState.appointmentId === a.id) return { ...a, tableId: dragState.tableId, startTime: dragState.startTime };
    if (pendingMove && pendingMove.appointmentId === a.id) return { ...a, tableId: pendingMove.tableId, startTime: pendingMove.startTime };
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

      {moveError && (
        <div className="flex items-center justify-between gap-3 bg-coral/10 border border-coral/30 rounded-lg px-3 py-2 mb-3">
          <p className="text-sm text-coral">{moveError}</p>
          <button type="button" onClick={() => setMoveError(null)} className="text-coral/70 hover:text-coral text-sm shrink-0">
            Dismiss
          </button>
        </div>
      )}

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
                      const tapHandlers = bindTapOrDoubleClick(() => setSelectedAppointmentId(a.id));
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onPointerDown={(e) => onAppointmentPointerDown(e, a)}
                          onPointerMove={onDragPointerMove}
                          onPointerUp={onDragPointerUp}
                          onPointerCancel={onDragPointerCancel}
                          onClick={tapHandlers.onClick}
                          onDoubleClick={tapHandlers.onDoubleClick}
                          className={`absolute rounded-md flex items-center gap-1 px-2 text-xs truncate ${STATUS_STYLES[a.status]} ${
                            dragging ? "opacity-50 ring-2 ring-dashed ring-cream" : ""
                          } ${a.status === "BOOKED" ? "cursor-grab active:cursor-grabbing" : ""}`}
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
    </div>
  );
}
