"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addDaysUTC, dateOnlyUTC, toDateKey } from "@/lib/bookings";
import { buildDayColumns, columnSpan, groupBookingsByUnit, mergeBlocksByUnit, assignLanes } from "@/lib/calendarLayout";
import { quoteBookingSchedule, applyBookingSchedule } from "@/lib/bookingScheduleClient";
import BookingCreateFromGridModal from "@/components/admin/BookingCreateFromGridModal";
import type { BookingCalendarResponse, BookingScheduleQuote, CalendarBooking, RoomUnit } from "@/lib/types";

const DAY_WIDTH = 88;
const ROW_HEIGHT = 40;
const LABEL_WIDTH = 208;

const STATUS_BAR_STYLES: Record<string, string> = {
  NEW: "bg-sea text-ink",
  CONFIRMED: "bg-coral text-ink",
  PAID: "bg-green-600 text-cream",
};

// All three mouse interactions (range-select, edge-resize, whole-bar move) are implemented on
// native Pointer Events, no drag library — pointer capture is set on whichever element the drag
// started from, and the drop target during a drag is looked up by hit-testing
// `document.elementFromPoint()` against `[data-cell]` markers (data-room-unit-id/data-date), not
// by computing coordinates against the grid's own layout. That's deliberate: every interaction
// here only ever needs to know "which room + which date is under the pointer", and reading that
// off the DOM survives any future change to cell width/row height/scroll offset, whereas
// coordinate math would silently break the moment that layout changes. A drag library's
// draggable/droppable model is built for reorderable lists, not for edge-resize + range-select
// on a custom date grid, so it wouldn't remove much of this logic anyway.
export default function BookingCalendarGrid({ data }: { data: BookingCalendarResponse }) {
  const router = useRouter();
  const gridRef = useRef<HTMLDivElement>(null);

  const days = useMemo(() => buildDayColumns(data.from, data.to), [data.from, data.to]);
  const gridFrom = days[0];
  const dayCount = days.length;
  const today = useMemo(() => dateOnlyUTC(new Date()), []);
  const todayKey = toDateKey(today);

  const blocksByUnit = useMemo(() => mergeBlocksByUnit(data.blocks), [data.blocks]);
  const bookingsByRoomId = useMemo(() => {
    const map = new Map<string, CalendarBooking[]>();
    for (const b of data.bookings) {
      const list = map.get(b.roomId) ?? [];
      list.push(b);
      map.set(b.roomId, list);
    }
    return map;
  }, [data.bookings]);

  // Every date a unit is occupied (booking or block) — used to clamp a range-select drag so it
  // can't be dragged across an already-occupied night, and to give each free cell a free/occupied
  // affordance without re-scanning bookings/blocks on every pointermove.
  const occupiedByUnit = useMemo(() => {
    const map = new Map<string, Set<string>>();
    const mark = (roomUnitId: string, from: Date, toExclusive: Date) => {
      const set = map.get(roomUnitId) ?? new Set<string>();
      for (let d = from; d.getTime() < toExclusive.getTime(); d = addDaysUTC(d, 1)) set.add(toDateKey(d));
      map.set(roomUnitId, set);
    };
    for (const b of data.bookings) {
      if (b.roomUnitId) mark(b.roomUnitId, dateOnlyUTC(b.checkIn), dateOnlyUTC(b.checkOut));
    }
    for (const segments of blocksByUnit.values()) {
      for (const seg of segments) mark(seg.roomUnitId, seg.fromDate, addDaysUTC(seg.toDate, 1));
    }
    return map;
  }, [data.bookings, blocksByUnit]);

  function isFree(roomUnitId: string, date: Date) {
    return !occupiedByUnit.get(roomUnitId)?.has(toDateKey(date));
  }

  // --- Drag state -----------------------------------------------------------------------

  type DragState =
    | { kind: "select"; roomId: string; roomUnitId: string; startDate: Date; currentDate: Date }
    | {
        kind: "resize";
        bookingId: string;
        roomUnitId: string;
        edge: "start" | "end";
        originalCheckIn: Date;
        originalCheckOut: Date;
        checkIn: Date;
        checkOut: Date;
      }
    | {
        kind: "move";
        bookingId: string;
        originalRoomUnitId: string;
        originalCheckIn: Date;
        originalCheckOut: Date;
        grabDayOffset: number;
        roomUnitId: string;
        checkIn: Date;
        checkOut: Date;
      };

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [createModal, setCreateModal] = useState<{ roomId: string; roomTypeName: string; roomUnitId: string; roomUnitLabel: string; checkIn: string; checkOut: string } | null>(null);
  const [scheduleConfirm, setScheduleConfirm] = useState<{
    bookingId: string;
    guestName: string;
    checkIn: string;
    checkOut: string;
    roomUnitId: string | null;
    status: "loading" | "ready" | "error";
    quote?: BookingScheduleQuote;
    error?: string;
  } | null>(null);

  function setTouchActionNone(active: boolean) {
    if (gridRef.current) gridRef.current.style.touchAction = active ? "none" : "";
  }

  // Escape cancels an in-progress drag — the only way to back out of one without a mouse, since
  // dragging itself has no keyboard equivalent (see BookingScheduleForm for the keyboard path to
  // the same date/room change).
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
  }, [dragState]);

  function cellUnderPointer(e: React.PointerEvent): { roomUnitId: string; date: Date } | null {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-cell]");
    if (!el || el.dataset.date === undefined || el.dataset.roomUnitId === undefined) return null;
    return { roomUnitId: el.dataset.roomUnitId, date: dateOnlyUTC(el.dataset.date) };
  }

  function clampSelectionEnd(roomUnitId: string, start: Date, hovered: Date) {
    const dir = hovered.getTime() >= start.getTime() ? 1 : -1;
    let cursor = start;
    let result = start;
    // Walk day-by-day from the start toward the hovered date, stopping at the last still-free
    // night — the final, authoritative availability check is still server-side at confirm time,
    // this is only about not letting the drag *look* like it spans an obviously occupied night.
    while (true) {
      const next = addDaysUTC(cursor, dir);
      if (dir > 0 ? next.getTime() > hovered.getTime() : next.getTime() < hovered.getTime()) break;
      if (!isFree(roomUnitId, next)) break;
      result = next;
      cursor = next;
    }
    return result;
  }

  function onCellPointerDown(e: React.PointerEvent<HTMLDivElement>, roomId: string, roomUnitId: string, date: Date) {
    if (roomUnitId === "" || !isFree(roomUnitId, date)) return; // no range-select on the unassigned row or an occupied night
    e.currentTarget.setPointerCapture(e.pointerId);
    setTouchActionNone(true);
    setDragState({ kind: "select", roomId, roomUnitId, startDate: date, currentDate: date });
  }

  function onBarPointerDown(e: React.PointerEvent<HTMLDivElement>, booking: CalendarBooking) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setTouchActionNone(true);
    const rect = e.currentTarget.getBoundingClientRect();
    const grabDayOffset = Math.floor((e.clientX - rect.left) / DAY_WIDTH);
    const checkIn = dateOnlyUTC(booking.checkIn);
    const checkOut = dateOnlyUTC(booking.checkOut);
    setDragState({
      kind: "move",
      bookingId: booking.id,
      originalRoomUnitId: booking.roomUnitId ?? "",
      originalCheckIn: checkIn,
      originalCheckOut: checkOut,
      grabDayOffset,
      roomUnitId: booking.roomUnitId ?? "",
      checkIn,
      checkOut,
    });
  }

  function onResizeHandlePointerDown(e: React.PointerEvent<HTMLDivElement>, booking: CalendarBooking, edge: "start" | "end") {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    setTouchActionNone(true);
    const checkIn = dateOnlyUTC(booking.checkIn);
    const checkOut = dateOnlyUTC(booking.checkOut);
    setDragState({
      kind: "resize",
      bookingId: booking.id,
      roomUnitId: booking.roomUnitId ?? "",
      edge,
      originalCheckIn: checkIn,
      originalCheckOut: checkOut,
      checkIn,
      checkOut,
    });
  }

  function onDragPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragState) return;
    const target = cellUnderPointer(e);
    if (!target) return;

    if (dragState.kind === "select") {
      if (target.roomUnitId !== dragState.roomUnitId) return; // stays within the row it started on
      setDragState({ ...dragState, currentDate: clampSelectionEnd(dragState.roomUnitId, dragState.startDate, target.date) });
    } else if (dragState.kind === "resize") {
      if (dragState.edge === "start") {
        const maxCheckIn = addDaysUTC(dragState.checkOut, -1);
        const checkIn = target.date.getTime() <= maxCheckIn.getTime() ? target.date : maxCheckIn;
        setDragState({ ...dragState, checkIn });
      } else {
        const minCheckOut = addDaysUTC(dragState.checkIn, 1);
        const candidate = addDaysUTC(target.date, 1); // hovered day is the last night → exclusive end is +1
        const checkOut = candidate.getTime() >= minCheckOut.getTime() ? candidate : minCheckOut;
        setDragState({ ...dragState, checkOut });
      }
    } else {
      const nights = Math.round((dragState.originalCheckOut.getTime() - dragState.originalCheckIn.getTime()) / 86_400_000);
      const checkIn = addDaysUTC(target.date, -dragState.grabDayOffset);
      const checkOut = addDaysUTC(checkIn, nights);
      setDragState({ ...dragState, roomUnitId: target.roomUnitId, checkIn, checkOut });
    }
  }

  function openScheduleConfirm(booking: CalendarBooking, checkIn: string, checkOut: string, roomUnitId: string | null) {
    setScheduleConfirm({ bookingId: booking.id, guestName: booking.guestName, checkIn, checkOut, roomUnitId, status: "loading" });
    quoteBookingSchedule(booking.id, { checkIn, checkOut, roomUnitId }).then((result) => {
      setScheduleConfirm((prev) => {
        if (!prev || prev.bookingId !== booking.id || prev.checkIn !== checkIn || prev.checkOut !== checkOut) return prev;
        return result.ok ? { ...prev, status: "ready", quote: result.quote } : { ...prev, status: "error", error: result.error };
      });
    });
  }

  function onDragPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!dragState) return;
    setTouchActionNone(false);
    const finished = dragState;
    setDragState(null);

    if (finished.kind === "select") {
      const startDate = finished.startDate.getTime() <= finished.currentDate.getTime() ? finished.startDate : finished.currentDate;
      const endInclusive = finished.startDate.getTime() <= finished.currentDate.getTime() ? finished.currentDate : finished.startDate;
      const room = data.roomTypes.find((rt) => rt.roomId === finished.roomId);
      const unit = room?.roomUnits.find((u) => u.id === finished.roomUnitId);
      if (!room || !unit) return;
      setCreateModal({
        roomId: finished.roomId,
        roomTypeName: room.roomName,
        roomUnitId: finished.roomUnitId,
        roomUnitLabel: unit.label,
        checkIn: toDateKey(startDate),
        checkOut: toDateKey(addDaysUTC(endInclusive, 1)),
      });
      return;
    }

    const booking = data.bookings.find((b) => b.id === finished.bookingId);
    if (!booking) return;

    const unchanged =
      toDateKey(finished.checkIn) === toDateKey(finished.originalCheckIn) &&
      toDateKey(finished.checkOut) === toDateKey(finished.originalCheckOut) &&
      (finished.kind !== "move" || finished.roomUnitId === finished.originalRoomUnitId);
    if (unchanged) return;

    const roomUnitId = finished.kind === "move" ? finished.roomUnitId : finished.roomUnitId;
    openScheduleConfirm(booking, toDateKey(finished.checkIn), toDateKey(finished.checkOut), roomUnitId || null);
  }

  function onDragPointerCancel() {
    setTouchActionNone(false);
    setDragState(null);
  }

  async function confirmScheduleChange() {
    if (!scheduleConfirm || scheduleConfirm.status !== "ready") return;
    setScheduleConfirm({ ...scheduleConfirm, status: "loading" });
    const result = await applyBookingSchedule(scheduleConfirm.bookingId, {
      checkIn: scheduleConfirm.checkIn,
      checkOut: scheduleConfirm.checkOut,
      roomUnitId: scheduleConfirm.roomUnitId,
    });
    if (!result.ok) {
      setScheduleConfirm((prev) => (prev ? { ...prev, status: "error", error: result.error } : prev));
      return;
    }
    setScheduleConfirm(null);
    router.refresh();
  }

  // --- Rendering --------------------------------------------------------------------------

  function effectiveBooking(booking: CalendarBooking) {
    if (dragState && dragState.kind !== "select" && dragState.bookingId === booking.id) {
      return {
        checkIn: toDateKey(dragState.checkIn),
        checkOut: toDateKey(dragState.checkOut),
        roomUnitId: (dragState.kind === "move" ? dragState.roomUnitId : booking.roomUnitId ?? "") || null,
        dragging: true,
      };
    }
    return { checkIn: booking.checkIn, checkOut: booking.checkOut, roomUnitId: booking.roomUnitId, dragging: false };
  }

  function renderDayHeader() {
    return (
      <div className="flex sticky top-0 z-30">
        <div className="sticky left-0 z-40 shrink-0 bg-ink2 border-b border-r border-cream/10" style={{ width: LABEL_WIDTH }} />
        {days.map((d) => {
          const key = toDateKey(d);
          const isToday = key === todayKey;
          return (
            <div
              key={key}
              className={`shrink-0 border-b border-r border-cream/10 text-center py-2 bg-ink2 ${isToday ? "bg-coral/15" : ""}`}
              style={{ width: DAY_WIDTH }}
            >
              <p className="text-[10px] uppercase tracking-wide text-cream/40">
                {d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}
              </p>
              <p className={`text-sm ${isToday ? "text-coral font-semibold" : "text-cream/80"}`}>{d.getUTCDate()}</p>
            </div>
          );
        })}
      </div>
    );
  }

  function availabilityCellClass(count: number) {
    if (count < 0) return "bg-coral text-cream font-semibold";
    if (count === 0) return "text-cream/30";
    return "text-sea";
  }

  function renderRoomTypeHeader(roomId: string, roomName: string, dailyAvailable: { date: string; availableCount: number }[]) {
    const byDate = new Map(dailyAvailable.map((d) => [d.date, d.availableCount]));
    return (
      <div className="flex border-b border-cream/10">
        <div
          className="sticky left-0 z-20 shrink-0 bg-ink2/95 px-3 py-2 flex items-center"
          style={{ width: LABEL_WIDTH }}
        >
          <p className="eyebrow text-sea text-xs truncate" title={roomName}>
            {roomName}
          </p>
        </div>
        {days.map((d) => {
          const key = toDateKey(d);
          const count = byDate.get(key) ?? 0;
          return (
            <div key={key} className="shrink-0 text-center text-xs py-2" style={{ width: DAY_WIDTH }}>
              <span className={availabilityCellClass(count)}>{count}</span>
            </div>
          );
        })}
      </div>
    );
  }

  function renderRow(roomId: string, roomUnitId: string, label: string, isActive: boolean, bookings: CalendarBooking[]) {
    const withEffective = bookings.map((b) => ({ booking: b, ...effectiveBooking(b) }));
    // Only lay out bookings actually in this row right now (a booking mid-move shows in its
    // drag-target row, not its original one) — see the caller, which already filters by
    // effective roomUnitId before calling renderRow.
    const { lanes, laneCount } = assignLanes(
      withEffective.map(({ booking, checkIn, checkOut }) => ({ ...booking, checkIn, checkOut }))
    );
    const rowHeight = ROW_HEIGHT * Math.max(laneCount, 1);
    const segments = blocksByUnit.get(roomUnitId) ?? [];

    return (
      <div key={roomUnitId || "unassigned"} className="flex border-b border-cream/5">
        <div
          className={`sticky left-0 z-10 shrink-0 flex items-center gap-1.5 px-3 text-sm bg-ink ${
            roomUnitId === "" ? "text-amber-400" : isActive ? "text-cream/80" : "text-cream/30"
          }`}
          style={{ width: LABEL_WIDTH, height: rowHeight }}
        >
          <span className="truncate" title={label}>
            {label}
          </span>
          {laneCount > 1 && (
            <span title="Overlapping bookings on this room — needs attention" className="text-coral shrink-0">
              ⚠
            </span>
          )}
        </div>
        <div className="relative shrink-0" style={{ width: dayCount * DAY_WIDTH, height: rowHeight }}>
          {days.map((d) => {
            const key = toDateKey(d);
            const covering = segments.filter((s) => s.fromDate.getTime() <= d.getTime() && d.getTime() <= s.toDate.getTime());
            const title = covering.length > 0 ? covering.flatMap((s) => s.reasons).join("; ") : undefined;
            const free = roomUnitId !== "" && isFree(roomUnitId, d);
            return (
              <div
                key={key}
                data-cell
                data-room-unit-id={roomUnitId}
                data-date={key}
                title={title}
                onPointerDown={(e) => onCellPointerDown(e, roomId, roomUnitId, d)}
                onPointerMove={onDragPointerMove}
                onPointerUp={onDragPointerUp}
                onPointerCancel={onDragPointerCancel}
                className={`absolute top-0 bottom-0 border-r border-cream/5 ${free ? "cursor-cell" : ""} ${
                  key === todayKey ? "bg-cream/5" : ""
                }`}
                style={{ left: dayIndex(d) * DAY_WIDTH, width: DAY_WIDTH }}
              />
            );
          })}

          {segments.map((seg, i) => {
            const { startCol, colSpan } = columnSpan(seg.fromDate, addDaysUTC(seg.toDate, 1), gridFrom, dayCount);
            if (colSpan <= 0) return null;
            return (
              <div
                key={i}
                className="absolute rounded-md pointer-events-none opacity-70"
                style={{
                  left: startCol * DAY_WIDTH + 2,
                  width: colSpan * DAY_WIDTH - 4,
                  top: 3,
                  height: ROW_HEIGHT - 6,
                  backgroundImage:
                    "repeating-linear-gradient(45deg, rgba(226,97,47,0.25), rgba(226,97,47,0.25) 6px, rgba(226,97,47,0.08) 6px, rgba(226,97,47,0.08) 12px)",
                  border: "1px dashed rgba(226,97,47,0.6)",
                }}
              />
            );
          })}

          {lanes.map(({ booking, lane }) => {
              const eff = withEffective.find((w) => w.booking.id === booking.id)!;
              const { startCol, colSpan } = columnSpan(dateOnlyUTC(eff.checkIn), dateOnlyUTC(eff.checkOut), gridFrom, dayCount);
              if (colSpan <= 0) return null;
              const dragging = eff.dragging;
              return (
                <div
                  key={booking.id}
                  className="absolute"
                  style={{
                    left: startCol * DAY_WIDTH + 2,
                    width: colSpan * DAY_WIDTH - 4,
                    top: lane * ROW_HEIGHT + 3,
                    height: ROW_HEIGHT - 6,
                    pointerEvents: dragging ? "none" : "auto",
                  }}
                >
                  <div
                    className={`absolute inset-0 rounded-md flex items-center overflow-hidden ${STATUS_BAR_STYLES[booking.status] ?? "bg-cream/20 text-cream"} ${
                      dragging ? "opacity-50 ring-2 ring-dashed ring-cream" : ""
                    }`}
                    style={{ cursor: dragging ? "grabbing" : "grab" }}
                    onPointerDown={(e) => onBarPointerDown(e, booking)}
                    onPointerMove={onDragPointerMove}
                    onPointerUp={onDragPointerUp}
                    onPointerCancel={onDragPointerCancel}
                    title={`${booking.guestName} · ${booking.status}`}
                  >
                    <span className="truncate px-2 text-xs pointer-events-none">{booking.guestName}</span>
                  </div>
                  <div
                    className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize"
                    onPointerDown={(e) => onResizeHandlePointerDown(e, booking, "start")}
                    onPointerMove={onDragPointerMove}
                    onPointerUp={onDragPointerUp}
                    onPointerCancel={onDragPointerCancel}
                  />
                  <div
                    className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize"
                    onPointerDown={(e) => onResizeHandlePointerDown(e, booking, "end")}
                    onPointerMove={onDragPointerMove}
                    onPointerUp={onDragPointerUp}
                    onPointerCancel={onDragPointerCancel}
                  />
                </div>
              );
            })}

          {dragState?.kind === "select" && dragState.roomUnitId === roomUnitId && (
            <SelectionGhost dragState={dragState} gridFrom={gridFrom} dayCount={dayCount} />
          )}
        </div>
      </div>
    );
  }

  function dayIndex(date: Date) {
    return Math.round((date.getTime() - gridFrom.getTime()) / 86_400_000);
  }

  // Bookings currently being moved render only in their drag-target row, not their original one.
  function bookingsForRow(roomId: string, roomUnitId: string) {
    return (bookingsByRoomId.get(roomId) ?? []).filter((b) => {
      if (dragState && dragState.kind === "move" && dragState.bookingId === b.id) {
        return dragState.roomUnitId === roomUnitId;
      }
      return (b.roomUnitId ?? "") === roomUnitId;
    });
  }

  return (
    <div>
      <div
        ref={gridRef}
        className="overflow-auto max-h-[75vh] border border-cream/10 rounded-xl relative select-none"
      >
        <div style={{ width: LABEL_WIDTH + dayCount * DAY_WIDTH }}>
          {renderDayHeader()}
          {data.roomTypes.map((rt) => (
            <div key={rt.roomId}>
              {renderRoomTypeHeader(rt.roomId, rt.roomName, rt.dailyAvailable)}
              {rt.roomUnits.map((unit: RoomUnit) => renderRow(rt.roomId, unit.id, unit.label, unit.isActive, bookingsForRow(rt.roomId, unit.id)))}
              {bookingsForRow(rt.roomId, "").length > 0 && renderRow(rt.roomId, "", "Unassigned", true, bookingsForRow(rt.roomId, ""))}
            </div>
          ))}
        </div>
      </div>

      {createModal && (
        <BookingCreateFromGridModal
          roomId={createModal.roomId}
          roomTypeName={createModal.roomTypeName}
          roomUnitId={createModal.roomUnitId}
          roomUnitLabel={createModal.roomUnitLabel}
          checkIn={createModal.checkIn}
          checkOut={createModal.checkOut}
          onClose={() => setCreateModal(null)}
          onCreated={() => {
            setCreateModal(null);
            router.refresh();
          }}
        />
      )}

      {scheduleConfirm && (
        <div className="fixed inset-0 z-50 bg-ink/80 flex items-center justify-center p-4" onClick={() => setScheduleConfirm(null)}>
          <div className="bg-ink2 border border-cream/15 rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow text-sea mb-1">Confirm change</p>
            <p className="text-cream mb-1">{scheduleConfirm.guestName}</p>
            <p className="text-sm text-cream/60 mb-4">
              {scheduleConfirm.checkIn} → {scheduleConfirm.checkOut}
              {scheduleConfirm.roomUnitId === null ? " · unassigned" : ""}
            </p>

            {scheduleConfirm.status === "loading" && <p className="text-sm text-cream/50">Pricing…</p>}

            {scheduleConfirm.status === "ready" && scheduleConfirm.quote && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-cream/60">
                    {scheduleConfirm.quote.nights} night{scheduleConfirm.quote.nights === 1 ? "" : "s"}
                  </span>
                  <span className="font-display italic text-3xl text-coral">
                    ฿{Number(scheduleConfirm.quote.totalPrice).toLocaleString("en-US")}
                  </span>
                </div>
                {!scheduleConfirm.quote.available && <p className="text-sm text-coral">{scheduleConfirm.quote.reason}</p>}
                <div className="flex gap-3 flex-wrap">
                  <button
                    type="button"
                    disabled={!scheduleConfirm.quote.available}
                    onClick={confirmScheduleChange}
                    className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-60"
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    onClick={() => setScheduleConfirm(null)}
                    className="text-sm text-cream/60 hover:text-cream transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {scheduleConfirm.status === "error" && (
              <div className="space-y-3">
                <p className="text-sm text-coral">{scheduleConfirm.error}</p>
                <button
                  type="button"
                  onClick={() => setScheduleConfirm(null)}
                  className="text-sm text-cream/60 hover:text-cream transition-colors"
                >
                  Close
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SelectionGhost({
  dragState,
  gridFrom,
  dayCount,
}: {
  dragState: { startDate: Date; currentDate: Date };
  gridFrom: Date;
  dayCount: number;
}) {
  const start = dragState.startDate.getTime() <= dragState.currentDate.getTime() ? dragState.startDate : dragState.currentDate;
  const endExclusive = addDaysUTC(
    dragState.startDate.getTime() <= dragState.currentDate.getTime() ? dragState.currentDate : dragState.startDate,
    1
  );
  const { startCol, colSpan } = columnSpan(start, endExclusive, gridFrom, dayCount);
  if (colSpan <= 0) return null;
  return (
    <div
      className="absolute rounded-md pointer-events-none bg-sea/30 border-2 border-sea"
      style={{ left: startCol * DAY_WIDTH + 2, width: colSpan * DAY_WIDTH - 4, top: 3, height: ROW_HEIGHT - 6 }}
    />
  );
}
