"use client";

import { bookingStatusLabel } from "@/lib/bookingStatusLabel";

import { useCloseOnBrowserBack } from "@/lib/useCloseOnBrowserBack";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addDaysUTC, dateOnlyUTC, parseDateKey, toDateKey } from "@/lib/bookings";
import { hotelDateKey } from "@/lib/hotelDate";
import {
  buildDayColumns,
  columnSpan,
  groupBookingsByUnit,
  mergeBlocksByUnit,
  layoutRow,
  resolveEdgeDragTarget,
  fitDayWidth,
  DRAG_THRESHOLD_PX,
  LABEL_MIN_WIDTH_PX,
} from "@/lib/calendarLayout";
import { quoteBookingSchedule, applyBookingSchedule } from "@/lib/bookingScheduleClient";
import { assignBookingSegmentRoomUnit, swapBookingSegmentRoomUnit } from "@/lib/bookingSegmentClient";
import PaidPriceNotice from "@/components/admin/PaidPriceNotice";
import { barAgreesWithCell, dropOutcomeMessage, findClash, findOccupant, grabDayOffset as grabOffsetDays, isSwapPartner } from "@/lib/calendarDrop";
import { useDragListeners } from "@/lib/useDragListeners";
import type { DragPoint, DragPress } from "@/lib/dragPress";
import { roomDropIntent } from "@/lib/bookingRelocation";
import { adminRequest } from "@/lib/adminFetch";
import { useBookingSiblingsCache } from "@/lib/useBookingSiblingsCache";
import { useTapOrDoubleClick } from "@/lib/useTapOrDoubleClick";
import { DEFAULT_DAY_WIDTH_PX, MIN_DAY_WIDTH_PX, MAX_DAY_WIDTH_PX, loadStoredDensity, saveStoredDensity } from "@/lib/calendarRange";
import BookingCreateFromGridModal from "@/components/admin/BookingCreateFromGridModal";
import BookingCardPanel from "@/components/admin/BookingCardPanel";
import { RelocationDialog, type RelocationPreset } from "@/components/admin/BookingRelocation";
import RoomUnitBlockPanel from "@/components/admin/RoomUnitBlockPanel";
import type { Booking, BookingCalendarResponse, BookingScheduleQuote, CalendarBooking, HousekeepingStatus, RoomUnit } from "@/lib/types";
import { formatDate, formatDateRange } from "@/lib/formatDate";
import { formatBaht } from "@/lib/money";

const ROW_HEIGHT = 40;
const LABEL_WIDTH = 208;
// A bar starts this far inside its first day column (and ends as far inside its last).
const BAR_INSET_PX = 2;

// CONFIRMED is deliberately not coral: it's the routine, expected state that fills most of this
// screen, and coral now means "needs intervention" (overbooked cell, overlapping-bookings
// warning, a manual RoomUnitBlock) - a bar in that same color would either read as an alarm that
// isn't one, or (worse) bury a real alarm in a sea of identically-colored normal bars, which is
// exactly what made a genuinely overbooked day invisible before this changed. slate is used
// instead of a themed token on purpose: sea already means "available", sand means "not cleaned",
// amber means "there's a debt" - a cool, unsaturated blue-grey doesn't compete with any of those
// or with coral's warm alert family.
const STATUS_BAR_STYLES: Record<string, string> = {
  NEW: "bg-sea text-ink",
  CONFIRMED: "bg-slate-600 text-cream",
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
export default function BookingCalendarGrid({
  data,
  canManage,
}: {
  data: BookingCalendarResponse;
  canManage: boolean;
}) {
  const router = useRouter();
  const gridRef = useRef<HTMLDivElement>(null);

  // Density is deliberately NOT owned by the URL, unlike the period (see the calendar page):
  // it never changes what's fetched, only how the same data is rendered, so it can live as plain
  // client state - hydrated from localStorage once on mount (SSR has no localStorage, so the
  // first paint always uses the default; see the effect below) rather than round-tripping through
  // a server render for something with zero effect on what data is needed.
  const [chosenDayWidth, setChosenDayWidth] = useState(DEFAULT_DAY_WIDTH_PX);
  useEffect(() => {
    const stored = loadStoredDensity();
    if (stored !== null) setChosenDayWidth(stored);
  }, []);
  function changeDayWidth(next: number) {
    setChosenDayWidth(next);
    saveStoredDensity(next);
  }
  // The grid's own visible width, followed as the window (or the sidebar beside it) changes size.
  const [gridWidth, setGridWidth] = useState(0);
  useEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const measure = () => setGridWidth(el.clientWidth);
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  // What a column really measures: the chosen density, or wider when the period doesn't fill the grid. Everything
  // below - layout, hit offsets and the drag rule - works on this figure, never on the slider's own.
  const dayWidth = fitDayWidth(gridWidth, LABEL_WIDTH, buildDayColumns(data.from, data.to).length, chosenDayWidth);
  // One rule, not two: whether the mouse can be trusted to land on an intended day at all -
  // dragging an existing booking's edge/whole bar, dragging a free-cell range to create one, and
  // (below) whether a single click on a free cell should open the create form immediately instead
  // all key off this same comparison. See DRAG_THRESHOLD_PX's own comment for why 44px.
  const allowDrag = dayWidth >= DRAG_THRESHOLD_PX;

  const [selectedBookingId, setSelectedBookingId] = useState<string | null>(null);
  // Identifies the clicked visual bar by unit + date range, not by a single block id - a merged
  // bar (mergeBlocksByUnit) can be backed by more than one RoomUnitBlock row, and the matching
  // raw rows are recomputed from data.blocks at render time below rather than captured here, so
  // the panel never shows a stale list if data refreshes while it's open.
  const [selectedBlockRange, setSelectedBlockRange] = useState<{ roomUnitId: string; label: string; fromDate: Date; toDate: Date } | null>(
    null
  );

  const days = useMemo(() => buildDayColumns(data.from, data.to), [data.from, data.to]);
  const gridFrom = days[0];
  const dayCount = days.length;
  // The hotel's date (Asia/Bangkok), not UTC's - same as the Today button and the period default.
  const today = useMemo(() => parseDateKey(hotelDateKey(new Date())), []);
  const todayKey = toDateKey(today);

  // "<unit label> (<room type>)" for a given roomUnitId, used by the
  // resize/move confirm dialog below — dates and price alone don't tell a
  // manager which physical room a drag actually landed a booking on, so a
  // misjudged drop onto the wrong row could be confirmed without anyone
  // noticing until a guest shows up to the wrong door.
  const roomUnitLabelById = useMemo(() => {
    const map = new Map<string, string>();
    for (const rt of data.roomTypes) {
      for (const unit of rt.roomUnits) map.set(unit.id, `${unit.label} (${rt.roomName})`);
    }
    return map;
  }, [data.roomTypes]);

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
      // A guest still checked in past checkOut holds the room through tonight (the backend's
      // OverstayRule) - those nights aren't free to drag a new stay across either.
      if (b.roomUnitId && b.overstayUntil) mark(b.roomUnitId, dateOnlyUTC(b.checkOut), dateOnlyUTC(b.overstayUntil));
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
        // The booking's real overall bounds, for the non-moving side of the PATCH body - see
        // resolveEdgeDragTarget's own comment for why this can differ from this bar's own local
        // checkIn/checkOut once a booking has more than one segment.
        overallCheckIn: Date;
        overallCheckOut: Date;
      }
    | {
        kind: "move";
        bookingId: string;
        // The specific segment being dragged - never just bookingId, which a relocated booking
        // shares across every one of its segments (see effectiveBooking/bookingsForRow's own
        // comments for why matching on bookingId alone would move every sibling bar at once).
        segmentId: string;
        segmentCount: number;
        // This segment's own room *type* id - the same-type-only check for both the room-only
        // move below and a swap-onto-another-bar compares against this.
        roomId: string;
        originalRoomUnitId: string;
        // The room type of the row the bar is over right now (starts as its own). A drop on another
        // type opens the room-move dialog instead of being refused - see handleRoomDrop.
        targetRoomId: string;
        originalCheckIn: Date;
        originalCheckOut: Date;
        // Sticky for the life of this drag - set true the first moment the pointer hovers a
        // valid swap target and never reset back to false afterward, even once the pointer
        // leaves that bar. This is what onDragPointerUp uses to decide swap-vs-move, not
        // whatever swapTarget happens to hold at the exact release pixel: a drag that ever
        // aimed at another bar has committed to being a swap attempt, and a miss on release
        // cancels the whole gesture rather than silently downgrading to moving the dragged
        // booking alone. A drag that never touched another bar was never a swap attempt, so a
        // miss for THAT drag can still fall back to wherever it was last validly hovering - see
        // onDragPointerUp's own comment for why that half is unchanged.
        hasHoveredSwapTarget: boolean;
        grabDayOffset: number;
        roomUnitId: string;
        checkIn: Date;
        checkOut: Date;
        // Set while hovering directly over a different, swap-eligible bar (both sides must
        // already have a physical room assigned - see swapSegmentRoomUnits's own backend rule).
        swapTarget: { bookingId: string; segmentId: string; roomId: string; roomUnitId: string; guestName: string } | null;
        // True when the hovered bar (a swap) is a different room type than this bar's own -
        // refused client-side before any request is sent, matching swapSegmentRoomUnits' own
        // "checked before any availability work" rule. A plain cell of another type is NOT invalid
        // any more: it opens the room-move dialog (see handleRoomDrop), so it never sets this.
        dropInvalid: boolean;
      };

  const [dragState, setDragState] = useState<DragState | null>(null);
  const [createModal, setCreateModal] = useState<{ roomId: string; roomTypeName: string; roomUnitId: string; roomUnitLabel: string; checkIn: string; checkOut: string } | null>(null);
  // Shared "tap or double-click opens the panel" gesture (lib/useTapOrDoubleClick.ts) - the exact
  // interaction the spa grid now reuses rather than a second hand-rolled version.
  const { note: notePointerType, bind: bindTapOrDoubleClick } = useTapOrDoubleClick();
  // Lazily backfills a relocated booking's full segment list once this grid's own visible window
  // can't confirm every sibling on its own - see resolveEdgeDragTarget's and this hook's own
  // comments for why a stale/missing entry is safe here (rendering-only, never a wrong write).
  const siblingsCache = useBookingSiblingsCache();
  useEffect(() => {
    const countsByBookingId = new Map<string, number>();
    for (const b of data.bookings) countsByBookingId.set(b.bookingId, (countsByBookingId.get(b.bookingId) ?? 0) + 1);
    for (const b of data.bookings) {
      if (b.segmentCount > 1 && (countsByBookingId.get(b.bookingId) ?? 0) < b.segmentCount) {
        siblingsCache.ensure(b.bookingId);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.bookings]);
  const [scheduleConfirm, setScheduleConfirm] = useState<{
    bookingId: string;
    guestName: string;
    checkIn: string;
    checkOut: string;
    roomUnitId: string | null;
    // What the booking has now, shown next to the new values so the desk sees what changes.
    from: { checkIn: string; checkOut: string; roomUnitId: string | null };
    status: "loading" | "ready" | "error";
    quote?: BookingScheduleQuote;
    error?: string;
  } | null>(null);
  // Swap needs a real confirmation naming both guests, not a warning after the fact - the gesture
  // moves two guests at once and only one was being looked at when the drag started.
  const [swapConfirm, setSwapConfirm] = useState<{
    draggedBookingId: string;
    draggedSegmentId: string;
    draggedGuestName: string;
    draggedRoomUnitId: string;
    targetBookingId: string;
    targetSegmentId: string;
    targetGuestName: string;
    targetRoomUnitId: string;
    status: "confirm" | "loading" | "error";
    error?: string;
  } | null>(null);
  const [segmentMoveError, setSegmentMoveError] = useState<string | null>(null);
  // Where the drag under way was pressed - its pointer, and the point a release is measured from.
  const pressRef = useRef<DragPress | null>(null);
  // The room-move dialog opened by a drop on another room type (or on a guest in the house).
  const [relocation, setRelocation] = useState<{ booking: Booking; preset: RelocationPreset } | null>(null);

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

  function cellUnderPointer(e: DragPoint): { roomUnitId: string; roomId: string; date: Date } | null {
    // The whole stack under the pointer, not only the topmost element: another booking's bar sits
    // over the cells of its nights, and a drop on a bar in the same room has to resolve to the
    // date underneath it (a date shift) instead of to nothing.
    let el: HTMLElement | null = null;
    for (const candidate of document.elementsFromPoint(e.clientX, e.clientY)) {
      el = candidate.closest<HTMLElement>("[data-cell]");
      if (el) break;
    }
    if (!el || el.dataset.date === undefined || el.dataset.roomUnitId === undefined || el.dataset.roomId === undefined) return null;
    return { roomUnitId: el.dataset.roomUnitId, roomId: el.dataset.roomId, date: dateOnlyUTC(el.dataset.date) };
  }

  // Hit-tests for another booking's own bar under the pointer - the swap gesture's own drop
  // target, found the same DOM-attribute way cellUnderPointer finds a cell (see that function's
  // own comment on why: it survives any future layout change, unlike coordinate math). Excludes
  // the bar currently being dragged and any bar with no room unit assigned yet - swapping with
  // nothing isn't a swap (see swapSegmentRoomUnits's own backend rule).
  function barUnderPointer(e: DragPoint, excludeSegmentId: string) {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest<HTMLElement>("[data-bar-segment-id]");
    const cellHere = cellUnderPointer(e);
    // A bar counts as the drop target only when it sits in the row of the cell under the pointer. A bar that merely
    // overlaps the pointer (a tall lane, a row that changed height when the dragged bar entered it) belongs to a row
    // the pointer is not in: releasing on a free night of another room is a move there, whatever bars were passed.
    if (el && barAgreesWithCell(el.dataset.barRoomUnitId, cellHere?.roomUnitId)) {
      const { barBookingId, barSegmentId, barRoomId, barRoomUnitId, barGuestName } = el.dataset;
      if (barBookingId && barSegmentId && barRoomId && barRoomUnitId !== undefined && barGuestName && barSegmentId !== excludeSegmentId && barRoomUnitId !== "") {
        return { bookingId: barBookingId, segmentId: barSegmentId, roomId: barRoomId, roomUnitId: barRoomUnitId, guestName: barGuestName };
      }
    }
    // No bar under the pointer: the booking holding the night under it, from the data. A booking dropped on one
    // with the same dates is laid out beside it (they overlap, so each takes a lane) and the pointer then lands on a
    // lane or a gap, never on that bar - the swap used to be missed exactly then (see findOccupant).
    const cell = cellHere;
    if (!cell) return null;
    const occupant = findOccupant(data.bookings, cell.roomUnitId, toDateKey(cell.date), excludeSegmentId);
    if (!occupant || occupant.roomUnitId === null) return null;
    return { bookingId: occupant.bookingId, segmentId: occupant.segmentId, roomId: occupant.roomId, roomUnitId: occupant.roomUnitId, guestName: occupant.guestName };
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
    if (!allowDrag) return; // too compressed for mouse-precise editing - onCellClick handles this case instead, see below
    if (roomUnitId === "" || !isFree(roomUnitId, date)) return; // no range-select on the unassigned row or an occupied night
    startPress(e);
    setDragState({ kind: "select", roomId, roomUnitId, startDate: date, currentDate: date });
  }

  // Below DRAG_THRESHOLD_PX a drag can't be trusted to land on the intended day (see its own
  // comment), so a free cell opens the create form on a plain click instead of a range-select
  // drag - checkIn/checkOut default to the single clicked day, editable in the form before saving.
  // Never fires when allowDrag is true: onCellPointerDown already starts a "select" drag in that
  // case, and a real pointer drag suppresses the browser's own click event on its own - but a
  // clean click (no drag) still reaches here even when allowDrag is true, so the guard is
  // explicit rather than relying on that suppression alone.
  function onCellClick(roomId: string, roomUnitId: string, date: Date) {
    if (allowDrag) return;
    openCreateModal(roomId, roomUnitId, date, addDaysUTC(date, 1));
  }

  function openCreateModal(roomId: string, roomUnitId: string, checkIn: Date, checkOutExclusive: Date) {
    if (roomUnitId === "" || !isFree(roomUnitId, checkIn)) return;
    const room = data.roomTypes.find((rt) => rt.roomId === roomId);
    const unit = room?.roomUnits.find((u) => u.id === roomUnitId);
    if (!room || !unit) return;
    setCreateModal({
      roomId,
      roomTypeName: room.roomName,
      roomUnitId,
      roomUnitLabel: unit.label,
      checkIn: toDateKey(checkIn),
      checkOut: toDateKey(checkOutExclusive),
    });
  }

  // Whole-bar move is offered whenever the density permits mouse-precise editing. A
  // never-relocated booking (segmentCount === 1) drags freely through PATCH .../schedule - both
  // date and room can change at once. A relocated booking's own segment bars (segmentCount > 1)
  // can also be picked up now, but only for a room-only move (dates pinned to that segment's own
  // bounds throughout the drag) via the segment-scoped PUT .../room-unit, or for the swap gesture
  // below when dropped directly onto another bar - see the "move" DragState variant's own
  // comments. Edge-drag on a relocated booking's own outer edge is unaffected (see
  // edgeDragTargetFor/resolveEdgeDragTarget); every bar stays clickable (onClick/onDoubleClick,
  // below - browsers suppress the click event after a real pointer drag on their own, so the two
  // never conflict) to open the card panel, where relocate/undo-relocation remain the tools for
  // anything that also changes dates on a multi-segment booking.
  function canMoveWholeBar(booking: CalendarBooking) {
    return allowDrag;
  }

  function edgeDragTargetFor(booking: CalendarBooking) {
    return resolveEdgeDragTarget(booking, data.bookings, siblingsCache.cache);
  }

  function onBarPointerDown(e: React.PointerEvent<HTMLDivElement>, booking: CalendarBooking) {
    notePointerType(e);
    if (!canMoveWholeBar(booking)) return;
    startPress(e);
    const rect = e.currentTarget.getBoundingClientRect();
    // From the stay's real first night, not the visible left edge: a bar that began before the grid is clipped.
    const grabDayOffset = grabOffsetDays(e.clientX, rect.left - BAR_INSET_PX, dayWidth, booking.checkIn, toDateKey(gridFrom));
    const checkIn = dateOnlyUTC(booking.checkIn);
    const checkOut = dateOnlyUTC(booking.checkOut);
    setDragState({
      kind: "move",
      bookingId: booking.bookingId,
      segmentId: booking.segmentId,
      segmentCount: booking.segmentCount,
      roomId: booking.roomId,
      originalRoomUnitId: booking.roomUnitId ?? "",
      targetRoomId: booking.roomId,
      originalCheckIn: checkIn,
      originalCheckOut: checkOut,
      grabDayOffset,
      roomUnitId: booking.roomUnitId ?? "",
      checkIn,
      checkOut,
      swapTarget: null,
      hasHoveredSwapTarget: false,
      dropInvalid: false,
    });
  }

  function onResizeHandlePointerDown(e: React.PointerEvent<HTMLDivElement>, booking: CalendarBooking, edge: "start" | "end") {
    if (!allowDrag) return;
    const target = edgeDragTargetFor(booking);
    if (edge === "start" ? !target.canDragStart : !target.canDragEnd) return;
    e.stopPropagation();
    startPress(e);
    const checkIn = dateOnlyUTC(booking.checkIn);
    const checkOut = dateOnlyUTC(booking.checkOut);
    setDragState({
      kind: "resize",
      bookingId: booking.bookingId,
      roomUnitId: booking.roomUnitId ?? "",
      edge,
      originalCheckIn: checkIn,
      originalCheckOut: checkOut,
      checkIn,
      checkOut,
      overallCheckIn: dateOnlyUTC(target.overallCheckIn),
      overallCheckOut: dateOnlyUTC(target.overallCheckOut),
    });
  }

  // The capture keeps the click and double-click of a press that turns out not to be a drag on the bar itself.
  function startPress(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    setTouchActionNone(true);
    pressRef.current = { pointerId: e.pointerId, clientX: e.clientX, clientY: e.clientY };
    setSegmentMoveError(null);
  }

  // The guest a move or a resize is about, for the sentence next to the grid.
  function draggedGuest(drag: DragState): string {
    if (drag.kind === "select") return "the selection";
    return data.bookings.find((b) => b.bookingId === drag.bookingId)?.guestName ?? "the booking";
  }

  function onDragPointerMove(e: DragPoint) {
    if (!dragState) return;

    if (dragState.kind === "move") {
      // Bar-hover (a swap candidate) is checked first - it takes priority over whatever cell
      // happens to sit underneath the hovered bar.
      const hoveredBar = barUnderPointer(e, dragState.segmentId);
      const swapTarget = isSwapPartner(hoveredBar, dragState.bookingId, dragState.originalRoomUnitId) ? hoveredBar : null;
      if (swapTarget) {
        setDragState({
          ...dragState,
          swapTarget,
          hasHoveredSwapTarget: true,
          targetRoomId: swapTarget.roomId,
          roomUnitId: swapTarget.roomUnitId,
          dropInvalid: swapTarget.roomId !== dragState.roomId,
        });
        return;
      }

      const target = cellUnderPointer(e);
      if (!target) return;

      if (dragState.segmentCount > 1) {
        // Room-only move: this segment's own dates never change during the drag, only which
        // unit it's hovering over - see the "move" DragState variant's own comment.
        setDragState({ ...dragState, swapTarget: null, roomUnitId: target.roomUnitId, targetRoomId: target.roomId, dropInvalid: false });
        return;
      }

      const nights = Math.round((dragState.originalCheckOut.getTime() - dragState.originalCheckIn.getTime()) / 86_400_000);
      const checkIn = addDaysUTC(target.date, -dragState.grabDayOffset);
      const checkOut = addDaysUTC(checkIn, nights);
      setDragState({ ...dragState, swapTarget: null, dropInvalid: false, roomUnitId: target.roomUnitId, targetRoomId: target.roomId, checkIn, checkOut });
      return;
    }

    const target = cellUnderPointer(e);
    if (!target) return;

    if (dragState.kind === "select") {
      if (target.roomUnitId !== dragState.roomUnitId) return; // stays within the row it started on
      setDragState({ ...dragState, currentDate: clampSelectionEnd(dragState.roomUnitId, dragState.startDate, target.date) });
    } else {
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
    }
  }

  function openScheduleConfirm(
    booking: CalendarBooking,
    checkIn: string,
    checkOut: string,
    roomUnitId: string | null,
    from: { checkIn: string; checkOut: string; roomUnitId: string | null }
  ) {
    // Known from the grid already: the drop lands on nights another booking holds in that room.
    // Said plainly here instead of a generic "no longer available" from the quote.
    const clash = findClash(data.bookings, booking.bookingId, roomUnitId, checkIn, checkOut);
    if (clash) {
      setScheduleConfirm({
        bookingId: booking.bookingId,
        guestName: booking.guestName,
        checkIn,
        checkOut,
        roomUnitId,
        from,
        status: "error",
        error: `${clash.guestName} has ${roomUnitLabelById.get(clash.roomUnitId ?? "") ?? "this room"} on ${formatDateRange(clash.checkIn, clash.checkOut)}, so ${booking.guestName} can't be moved there. Drop on free nights, or move that booking first.`,
      });
      return;
    }
    setScheduleConfirm({ bookingId: booking.bookingId, guestName: booking.guestName, checkIn, checkOut, roomUnitId, from, status: "loading" });
    quoteBookingSchedule(booking.bookingId, { checkIn, checkOut, roomUnitId }).then((result) => {
      setScheduleConfirm((prev) => {
        if (!prev || prev.bookingId !== booking.bookingId || prev.checkIn !== checkIn || prev.checkOut !== checkOut) return prev;
        return result.ok ? { ...prev, status: "ready", quote: result.quote } : { ...prev, status: "error", error: result.error };
      });
    });
  }

  function onDragPointerUp(e: DragPoint, moved: boolean) {
    if (!dragState) return;
    setTouchActionNone(false);
    let finished = dragState;
    setDragState(null);

    // Released on no night of any room (off the grid, off the browser window, on a header): nothing is changed, and
    // said so. A release that never moved is a click, answered by the click handlers.
    if (!cellUnderPointer(e) && !(finished.kind === "move" && barUnderPointer(e, finished.segmentId))) {
      const outside = finished.kind === "resize" ? "outside-resize" : finished.kind === "select" ? "outside-select" : "outside";
      if (moved) setSegmentMoveError(dropOutcomeMessage(outside, draggedGuest(finished)));
      return;
    }

    if (finished.kind === "select") {
      const startDate = finished.startDate.getTime() <= finished.currentDate.getTime() ? finished.startDate : finished.currentDate;
      const endInclusive = finished.startDate.getTime() <= finished.currentDate.getTime() ? finished.currentDate : finished.startDate;
      openCreateModal(finished.roomId, finished.roomUnitId, startDate, addDaysUTC(endInclusive, 1));
      return;
    }

    if (finished.kind === "move") {
      setSegmentMoveError(null);
      const draggedSegmentId = finished.segmentId;
      const booking = data.bookings.find((b) => b.segmentId === draggedSegmentId);
      if (!booking) {
        setSegmentMoveError(dropOutcomeMessage("gone", ""));
        return;
      }

      // Recomputed fresh from the release point, not from finished.swapTarget - the same
      // "don't trust the last thing pointermove happened to see" principle behind the spa
      // grid's own onDragPointerUp fix. The rule this drag was classified by is
      // hasHoveredSwapTarget, not whatever's directly under the pointer right now: once a drag
      // has hovered a valid swap target at any point, it has committed to being a swap attempt
      // for the rest of the gesture, and releasing anywhere that isn't a valid bar - a row gap,
      // a block, an ordinary cell, the resize-handle dead zone that caused the original report -
      // cancels the whole gesture rather than silently downgrading to an ordinary reschedule of
      // the dragged booking alone. A drag that never touched another bar was never a swap
      // attempt, so it keeps falling through to the ordinary move logic below on a miss,
      // exactly as before - dropping outside a valid cell there still commits to the last
      // validly-hovered position, which is a deliberate, separate decision (not this one).
      // Every drop ends in a dialog or a sentence next to the grid, never in nothing: a drag from one
      // room to another passes over the bars between them, which used to latch "swap attempt" and then
      // cancel the whole drop, silently, when it was released on a free night.
      if (finished.hasHoveredSwapTarget) {
        const hoveredBar = barUnderPointer(e, finished.segmentId);
        const swapTarget = isSwapPartner(hoveredBar, finished.bookingId, finished.originalRoomUnitId) ? hoveredBar : null;
        if (swapTarget) {
          if (swapTarget.roomId !== finished.roomId) {
            // Refused before any request: a swap across room types would reprice one of the guests.
            setSegmentMoveError(dropOutcomeMessage("swap-other-type", booking.guestName, swapTarget.guestName));
            return;
          }
          openSwapConfirm(booking, swapTarget);
          return;
        }
        // Released off the bar it aimed at, on a free night of a room: a plain move there.
        const releasedOn = cellUnderPointer(e);
        if (!releasedOn) return;
        if (finished.segmentCount > 1) {
          finished = { ...finished, roomUnitId: releasedOn.roomUnitId, targetRoomId: releasedOn.roomId };
        } else {
          const nights = Math.round((finished.originalCheckOut.getTime() - finished.originalCheckIn.getTime()) / 86_400_000);
          const releasedCheckIn = addDaysUTC(releasedOn.date, -finished.grabDayOffset);
          finished = {
            ...finished,
            roomUnitId: releasedOn.roomUnitId,
            targetRoomId: releasedOn.roomId,
            checkIn: releasedCheckIn,
            checkOut: addDaysUTC(releasedCheckIn, nights),
          };
        }
      }

      const datesUnchanged =
        finished.segmentCount > 1 ||
        (toDateKey(finished.checkIn) === toDateKey(finished.originalCheckIn) && toDateKey(finished.checkOut) === toDateKey(finished.originalCheckOut));
      if (datesUnchanged) {
        if (finished.roomUnitId === finished.originalRoomUnitId) return; // dropped back where it started
        // A room-only drop on a real room: what it means depends on who is in the room and which
        // room type it is (see handleRoomDrop). The "Unassigned" row has no room to move into.
        if (finished.roomUnitId !== "") {
          void handleRoomDrop(booking, finished.roomUnitId, finished.targetRoomId, finished.segmentCount);
          return;
        }
      }

      if (finished.segmentCount > 1) {
        applySegmentRoomUnit(booking, finished.roomUnitId || null);
        return;
      }

      const unchanged =
        toDateKey(finished.checkIn) === toDateKey(finished.originalCheckIn) &&
        toDateKey(finished.checkOut) === toDateKey(finished.originalCheckOut) &&
        finished.roomUnitId === finished.originalRoomUnitId;
      if (unchanged) return;
      openScheduleConfirm(booking, toDateKey(finished.checkIn), toDateKey(finished.checkOut), finished.roomUnitId || null, {
        checkIn: toDateKey(finished.originalCheckIn),
        checkOut: toDateKey(finished.originalCheckOut),
        roomUnitId: finished.originalRoomUnitId || null,
      });
      return;
    }

    // resize
    const booking = data.bookings.find((b) => b.bookingId === finished.bookingId);
    if (!booking) return;

    const unchanged =
      toDateKey(finished.checkIn) === toDateKey(finished.originalCheckIn) && toDateKey(finished.checkOut) === toDateKey(finished.originalCheckOut);
    if (unchanged) return;

    // A resize on a relocated booking only ever moves one outer edge of this bar's own segment;
    // the other side of the PATCH body must still be the booking's real overall bound (see
    // resolveEdgeDragTarget's own comment), not this segment's own local checkIn/checkOut, which
    // is only the same value when segmentCount === 1.
    const submitCheckIn = finished.edge === "end" ? finished.overallCheckIn : finished.checkIn;
    const submitCheckOut = finished.edge === "start" ? finished.overallCheckOut : finished.checkOut;
    openScheduleConfirm(booking, toDateKey(submitCheckIn), toDateKey(submitCheckOut), finished.roomUnitId || null, {
      checkIn: toDateKey(finished.edge === "end" ? finished.overallCheckIn : finished.originalCheckIn),
      checkOut: toDateKey(finished.edge === "start" ? finished.overallCheckOut : finished.originalCheckOut),
      roomUnitId: booking.roomUnitId,
    });
  }

  function onDragAbort(moved: boolean) {
    if (!dragState) return;
    setTouchActionNone(false);
    setDragState(null);
    if (moved) setSegmentMoveError(dropOutcomeMessage("interrupted", draggedGuest(dragState)));
  }

  useDragListeners(dragState !== null, pressRef, { onMove: onDragPointerMove, onUp: onDragPointerUp, onAbort: onDragAbort });

  // A bar dropped on another room's row without changing its dates. The calendar bar does not know
  // whether the guest is in the house, so the booking is read first (one GET), and lib/
  // bookingRelocation.ts#roomDropIntent decides: another room type, or a guest in the house, opens
  // the room-move dialog (date, rate and the server's new total, confirmed before anything is
  // written - a drag never changes a stay on its own); nobody in the room is the plain room change
  // it always was. Nothing is moved on release.
  async function handleRoomDrop(booking: CalendarBooking, roomUnitId: string, targetRoomId: string, segmentCount: number) {
    setSegmentMoveError(null);
    const loaded = await adminRequest<Booking>(`/bookings/${booking.bookingId}`, undefined, "Could not load this booking.");
    if (!loaded.ok) {
      setSegmentMoveError(loaded.error);
      return;
    }
    const intent = roomDropIntent({
      todayKey,
      occupancyStatus: loaded.data.occupancyStatus,
      barRoomId: booking.roomId,
      targetRoomId,
      segmentCount,
      barCheckIn: booking.checkIn,
      barCheckOut: booking.checkOut,
    });
    if (intent.kind === "relocate") {
      setRelocation({
        booking: loaded.data,
        preset: {
          effectiveDate: intent.effectiveDate,
          roomId: targetRoomId,
          roomUnitId,
          roomUnitLabel: roomUnitLabelById.get(roomUnitId) ?? "the selected room",
        },
      });
    } else if (intent.kind === "segment-unit") {
      void applySegmentRoomUnit(booking, roomUnitId);
    } else if (intent.kind === "schedule") {
      openScheduleConfirm(booking, booking.checkIn, booking.checkOut, roomUnitId, {
        checkIn: booking.checkIn,
        checkOut: booking.checkOut,
        roomUnitId: booking.roomUnitId,
      });
    } else {
      setSegmentMoveError(`${booking.guestName}'s nights in this room are all in the past, so they can't be moved to another room type.`);
    }
  }

  // Room-only move for a segment of a relocated booking (segmentCount > 1) - no price change
  // (same room type), no date change, so this applies directly the same way the plain PUT
  // .../room-unit assignment already does elsewhere, rather than routing through the quote/
  // confirm modal built for a change that can also move dates and money.
  async function applySegmentRoomUnit(booking: CalendarBooking, roomUnitId: string | null) {
    setSegmentMoveError(null);
    const result = await assignBookingSegmentRoomUnit(booking.bookingId, booking.segmentId, roomUnitId);
    if (!result.ok) {
      setSegmentMoveError(result.error);
      return;
    }
    router.refresh();
  }

  function unitLabelOrUnassigned(roomUnitId: string | null) {
    return roomUnitId === null ? "unassigned" : (roomUnitLabelById.get(roomUnitId) ?? roomUnitId);
  }

  function openSwapConfirm(
    booking: CalendarBooking,
    target: { bookingId: string; segmentId: string; roomId: string; roomUnitId: string; guestName: string }
  ) {
    if (booking.roomUnitId === target.roomUnitId) return; // same room: nothing to exchange
    setSwapConfirm({
      draggedBookingId: booking.bookingId,
      draggedSegmentId: booking.segmentId,
      draggedGuestName: booking.guestName,
      draggedRoomUnitId: booking.roomUnitId ?? "",
      targetBookingId: target.bookingId,
      targetSegmentId: target.segmentId,
      targetGuestName: target.guestName,
      targetRoomUnitId: target.roomUnitId,
      status: "confirm",
    });
  }

  async function confirmSwap() {
    if (!swapConfirm) return;
    setSwapConfirm({ ...swapConfirm, status: "loading" });
    const result = await swapBookingSegmentRoomUnit(swapConfirm.draggedBookingId, swapConfirm.draggedSegmentId, swapConfirm.targetSegmentId);
    if (!result.ok) {
      setSwapConfirm((prev) => (prev ? { ...prev, status: "error", error: result.error } : prev));
      return;
    }
    setSwapConfirm(null);
    router.refresh();
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
    // Matched by segmentId, not bookingId - a relocated booking shares bookingId across every
    // one of its segments, and only the one bar actually being dragged should render moved (see
    // the "move" DragState variant's own comment).
    if (dragState && dragState.kind === "move" && dragState.segmentId === booking.segmentId) {
      return {
        checkIn: toDateKey(dragState.checkIn),
        checkOut: toDateKey(dragState.checkOut),
        roomUnitId: dragState.roomUnitId || null,
        dragging: true,
        dropInvalid: dragState.dropInvalid,
        isSwapTarget: false,
      };
    }
    if (dragState && dragState.kind === "resize" && dragState.bookingId === booking.bookingId) {
      return {
        checkIn: toDateKey(dragState.checkIn),
        checkOut: toDateKey(dragState.checkOut),
        roomUnitId: booking.roomUnitId,
        dragging: true,
        dropInvalid: false,
        isSwapTarget: false,
      };
    }
    return {
      checkIn: booking.checkIn,
      checkOut: booking.checkOut,
      roomUnitId: booking.roomUnitId,
      dragging: false,
      dropInvalid: false,
      isSwapTarget: dragState?.kind === "move" && dragState.swapTarget?.segmentId === booking.segmentId,
    };
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
              // Today is about orientation in time, not status - a neutral underline, not a
              // fill, so it never reads as an alert color the way bg-coral/15 used to.
              className={`shrink-0 border-r border-cream/10 text-center py-2 bg-ink2 ${
                isToday ? "border-b-2 border-b-cream" : "border-b border-b-cream/10"
              }`}
              style={{ width: dayWidth }}
            >
              <p className="text-[10px] uppercase tracking-wide text-cream/40">
                {d.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" })}
              </p>
              <p className={`text-sm ${isToday ? "text-cream font-semibold" : "text-cream/80"}`}>{d.getUTCDate()}</p>
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
            <div key={key} className="shrink-0 text-center text-xs py-2" style={{ width: dayWidth }}>
              <span className={availabilityCellClass(count)}>{count}</span>
            </div>
          );
        })}
      </div>
    );
  }

  function renderRow(
    roomId: string,
    roomUnitId: string,
    label: string,
    isActive: boolean,
    housekeepingStatus: HousekeepingStatus | undefined,
    bookings: CalendarBooking[]
  ) {
    const withEffective = bookings.map((b) => ({ booking: b, ...effectiveBooking(b) }));
    // Drawn here: the bookings actually in this row right now (a booking mid-move shows in its
    // drag-target row, not its original one) — see the caller, which already filters by
    // effective roomUnitId before calling renderRow. Lanes and height: the row's own bookings as
    // saved, so no row moves while something is being dragged (layoutRow).
    const { lanes, laneCount } = layoutRow(bookingsAtRest(roomId, roomUnitId), bookings);
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
          {housekeepingStatus === "DIRTY" && (
            <span title="Room needs cleaning" className="text-sand shrink-0">
              ●
            </span>
          )}
          {laneCount > 1 && (
            <span title="Overlapping bookings on this room — needs attention" className="text-coral shrink-0">
              ⚠
            </span>
          )}
        </div>
        <div className="relative shrink-0" style={{ width: dayCount * dayWidth, height: rowHeight }}>
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
                data-room-id={roomId}
                data-date={key}
                title={title}
                onPointerDown={(e) => onCellPointerDown(e, roomId, roomUnitId, d)}
                onClick={() => onCellClick(roomId, roomUnitId, d)}
                className={`absolute top-0 bottom-0 border-r border-cream/5 ${free ? "cursor-cell" : ""} ${
                  key === todayKey ? "bg-cream/5" : ""
                }`}
                style={{ left: dayIndex(d) * dayWidth, width: dayWidth }}
              />
            );
          })}

          {segments.map((seg, i) => {
            const { startCol, colSpan } = columnSpan(seg.fromDate, addDaysUTC(seg.toDate, 1), gridFrom, dayCount);
            if (colSpan <= 0) return null;
            // Touch opens on a single tap; mouse needs a double-click - same shared gesture the
            // booking bars use above, not a second hand-rolled version (lib/useTapOrDoubleClick.ts).
            const tapHandlers = bindTapOrDoubleClick(() =>
              setSelectedBlockRange({ roomUnitId, label, fromDate: seg.fromDate, toDate: seg.toDate })
            );
            return (
              <div
                key={i}
                className="absolute rounded-md opacity-70 cursor-pointer"
                onPointerDown={notePointerType}
                onClick={tapHandlers.onClick}
                onDoubleClick={tapHandlers.onDoubleClick}
                style={{
                  left: startCol * dayWidth + 2,
                  width: colSpan * dayWidth - 4,
                  top: 3,
                  height: ROW_HEIGHT - 6,
                  backgroundImage:
                    "repeating-linear-gradient(45deg, rgba(226,97,47,0.25), rgba(226,97,47,0.25) 6px, rgba(226,97,47,0.08) 6px, rgba(226,97,47,0.08) 12px)",
                  border: "1px dashed rgba(226,97,47,0.6)",
                  // pointer-events: none while ANY drag is in progress, anywhere on the grid -
                  // same reasoning as the dragged bar's own pointer-events toggle (see that
                  // style's comment). This block sits on top of the ordinary [data-cell] div
                  // underneath it; being clickable at rest is the whole point of this round's
                  // double-click feature, but left clickable during a drag it would be exactly
                  // what a dragged bar itself used to be - the thing elementFromPoint finds
                  // instead of the cell or bar actually underneath, breaking cellUnderPointer/
                  // barUnderPointer's hit-test for anyone dragging across a blocked date.
                  pointerEvents: dragState ? "none" : "auto",
                }}
              />
            );
          })}

          {/* Overstay: a guest still checked in after checkOut, drawn as a hatched coral tail
              after their agreed bar - never as a longer bar, since checkOut is still the agreed
              date and dragging the bar must keep meaning "change the agreed stay". Coral because
              it needs intervention (check out, or extend the stay). Same pointer-events rule as
              the blocks above: transparent to any drag in progress. */}
          {bookings
            .filter((b) => b.overstayUntil)
            .map((b) => {
              const { startCol, colSpan } = columnSpan(dateOnlyUTC(b.checkOut), dateOnlyUTC(b.overstayUntil!), gridFrom, dayCount);
              if (colSpan <= 0) return null;
              const tapHandlers = bindTapOrDoubleClick(() => setSelectedBookingId(b.bookingId));
              const lane = lanes.find((l) => l.booking.segmentId === b.segmentId)?.lane ?? 0;
              return (
                <div
                  key={`overstay-${b.segmentId}`}
                  className="absolute rounded-md flex items-center overflow-hidden cursor-pointer text-cream"
                  onPointerDown={notePointerType}
                  onClick={tapHandlers.onClick}
                  onDoubleClick={tapHandlers.onDoubleClick}
                  title={`${b.guestName} · past check-out (${formatDate(b.checkOut)}) and still checked in`}
                  style={{
                    left: startCol * dayWidth + 2,
                    width: colSpan * dayWidth - 4,
                    top: lane * ROW_HEIGHT + 3,
                    height: ROW_HEIGHT - 6,
                    backgroundImage:
                      "repeating-linear-gradient(-45deg, rgba(226,97,47,0.55), rgba(226,97,47,0.55) 6px, rgba(226,97,47,0.2) 6px, rgba(226,97,47,0.2) 12px)",
                    border: "1px solid rgba(226,97,47,0.9)",
                    pointerEvents: dragState ? "none" : "auto",
                  }}
                >
                  {colSpan * dayWidth - 4 >= LABEL_MIN_WIDTH_PX && (
                    <span className="truncate px-2 text-xs pointer-events-none">{b.guestName} · overdue</span>
                  )}
                </div>
              );
            })}

          {lanes.map(({ booking, lane }) => {
              const eff = withEffective.find((w) => w.booking.segmentId === booking.segmentId)!;
              const { startCol, colSpan } = columnSpan(dateOnlyUTC(eff.checkIn), dateOnlyUTC(eff.checkOut), gridFrom, dayCount);
              if (colSpan <= 0) return null;
              const dragging = eff.dragging;
              // Per bar, not per density: a short stay and a long one can render at very
              // different widths at the very same dayWidth. See LABEL_MIN_WIDTH_PX.
              const showLabel = colSpan * dayWidth - 4 >= LABEL_MIN_WIDTH_PX;
              const edgeTarget = allowDrag ? edgeDragTargetFor(booking) : null;
              // Touch opens on a single tap; mouse needs a double-click so a single click can
              // still start a drag (whole-bar move or edge-resize) without also opening the
              // panel - see lib/useTapOrDoubleClick.ts's own comment.
              const tapHandlers = bindTapOrDoubleClick(() => setSelectedBookingId(booking.bookingId));
              return (
                <div
                  key={booking.segmentId}
                  // data-bar-* lives on this outer wrapper, not the inner bar div - barUnderPointer
                  // below finds it via closest(), which only ever walks up through ancestors. The
                  // resize handles rendered further down are this div's own children too (siblings
                  // of the inner bar, not descendants of it), so a drop landing on a handle's few
                  // pixels - not rare, every segmentCount===1 bar offers both handles whenever
                  // allowDrag is true - used to miss the bar entirely: closest() from the handle
                  // had nothing to find, so the drop silently fell through to an ordinary
                  // (unswapped) reschedule instead of the swap this same drop registered as when
                  // approached from the other bar's own, differently-shaped, dead zone. Direction-
                  // dependent in exactly the way that looked like an asymmetric exclusion check
                  // until traced to here - see this file's own history for the investigation.
                  data-bar-booking-id={booking.bookingId}
                  data-bar-segment-id={booking.segmentId}
                  data-bar-room-id={booking.roomId}
                  data-bar-room-unit-id={booking.roomUnitId ?? ""}
                  data-bar-guest-name={booking.guestName}
                  className="absolute"
                  style={{
                    left: startCol * dayWidth + 2,
                    width: colSpan * dayWidth - 4,
                    top: lane * ROW_HEIGHT + 3,
                    height: ROW_HEIGHT - 6,
                    // Above whatever it is passing over, which it no longer pushes into another lane.
                    zIndex: dragging ? 5 : undefined,
                    pointerEvents: dragging ? "none" : "auto",
                  }}
                >
                  <div
                    className={`absolute inset-0 rounded-md ${eff.checkIn < toDateKey(gridFrom) ? "rounded-l-none" : ""} flex items-center overflow-hidden ${STATUS_BAR_STYLES[booking.status] ?? "bg-cream/20 text-cream"} ${
                      dragging ? (eff.dropInvalid ? "opacity-50 ring-2 ring-coral" : "opacity-50 ring-2 ring-dashed ring-cream") : ""
                    } ${eff.isSwapTarget ? "ring-2 ring-sea" : ""} ${booking.segmentCount > 1 ? "ring-1 ring-inset ring-cream/40" : ""} ${
                      // Static, not set in onBarPointerDown: a browser fixes a touch gesture's
                      // touch-action when the finger lands, so setTouchActionNone() running inside
                      // pointerdown is already too late - the first move pans instead and fires
                      // pointercancel, killing the drag. Same as PropertyMapView's tiles. Only on
                      // what's actually draggable: the free cells stay pannable so the grid can
                      // still be scrolled by touch at all (which makes range-select a mouse-only
                      // gesture - a tap on a free cell still opens the create form).
                      canMoveWholeBar(booking) ? "touch-none" : ""
                    }`}
                    style={{ cursor: dragging ? "grabbing" : canMoveWholeBar(booking) ? "grab" : "pointer" }}
                    onPointerDown={(e) => onBarPointerDown(e, booking)}
                    onClick={tapHandlers.onClick}
                    onDoubleClick={tapHandlers.onDoubleClick}
                    title={`${booking.guestName} · ${bookingStatusLabel(booking.status)}${booking.segmentCount > 1 ? " · relocated" : ""}`}
                  >
                    {/* The stay began before the first day shown: a square left edge and a chevron, so it cannot pass for one arriving on that day. */}
                    {eff.checkIn < toDateKey(gridFrom) && (
                      <span aria-label="Began before the days shown" title="Began before the days shown" className="pl-1 text-xs leading-none opacity-80 pointer-events-none">
                        ‹
                      </span>
                    )}
                    {showLabel && <span className="truncate px-2 text-xs pointer-events-none">{booking.guestName}</span>}
                  </div>
                  {edgeTarget?.canDragStart && (
                    <div
                      className="absolute left-0 top-0 bottom-0 w-2 cursor-ew-resize touch-none"
                      onPointerDown={(e) => onResizeHandlePointerDown(e, booking, "start")}
                    />
                  )}
                  {edgeTarget?.canDragEnd && (
                    <div
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-ew-resize touch-none"
                      onPointerDown={(e) => onResizeHandlePointerDown(e, booking, "end")}
                    />
                  )}
                </div>
              );
            })}

          {dragState?.kind === "select" && dragState.roomUnitId === roomUnitId && (
            <SelectionGhost dragState={dragState} gridFrom={gridFrom} dayCount={dayCount} dayWidth={dayWidth} />
          )}
        </div>
      </div>
    );
  }

  function dayIndex(date: Date) {
    return Math.round((date.getTime() - gridFrom.getTime()) / 86_400_000);
  }

  // A row's own bookings as saved - what its lanes and height come from, drag or no drag.
  function bookingsAtRest(roomId: string, roomUnitId: string) {
    return (bookingsByRoomId.get(roomId) ?? []).filter((b) => (b.roomUnitId ?? "") === roomUnitId);
  }

  // Bookings currently being moved render only in their drag-target row, not their original one.
  function bookingsForRow(roomId: string, roomUnitId: string) {
    return (bookingsByRoomId.get(roomId) ?? []).filter((b) => {
      // segmentId, not bookingId - a relocated booking's other segments must stay put in their
      // own rows while only this one bar follows the drag (see effectiveBooking's own comment).
      if (dragState && dragState.kind === "move" && dragState.segmentId === b.segmentId) {
        return dragState.roomUnitId === roomUnitId;
      }
      return (b.roomUnitId ?? "") === roomUnitId;
    });
  }

  // Back closes an open confirmation instead of leaving the calendar.
  useCloseOnBrowserBack(scheduleConfirm !== null, () => setScheduleConfirm(null));
  useCloseOnBrowserBack(swapConfirm !== null, () => setSwapConfirm(null));

  return (
    <div>
      <div className="flex items-center justify-end gap-3 mb-3">
        {/* Independent of the period controls above the grid on purpose - see calendarRange.ts's
            comment on why period and density use two separate storage keys. A column always
            represents one day at any position on this slider; only its pixel width changes, so
            the label describes density, never a time unit ("day"/"week"/"month" would imply the
            column itself changes meaning, which it never does). */}
        <span className="eyebrow text-cream/40">Density</span>
        <span className="text-[10px] text-cream/30">Compact</span>
        <input
          type="range"
          min={MIN_DAY_WIDTH_PX}
          max={MAX_DAY_WIDTH_PX}
          step={1}
          value={chosenDayWidth}
          onChange={(e) => changeDayWidth(Number(e.target.value))}
          className="w-40 accent-coral"
          aria-label="Calendar column density"
        />
        <span className="text-[10px] text-cream/30">Spacious</span>
        <span className="text-xs text-cream/50 w-16 text-right" title={dayWidth > chosenDayWidth ? "Widened to fill the screen" : undefined}>
          {Math.floor(dayWidth)}px/day
        </span>
      </div>
      {!allowDrag && (
        // Visible on purpose: the column width is remembered in the browser, so a desk that once
        // squeezed the grid finds dragging "broken" days later. Says why and fixes it in one click.
        <div className="flex items-center justify-between gap-3 flex-wrap bg-sand/10 border border-sand/40 rounded-lg px-3 py-2 mb-2">
          <p className="text-sm text-cream/80">
            Dragging is off: the columns are too narrow ({Math.floor(dayWidth)}px a day, {DRAG_THRESHOLD_PX}px needed) to drop a booking on the right day. Click a bar to change
            its dates or room from the booking panel, or click an empty cell to open the new-booking form.
          </p>
          <button
            type="button"
            onClick={() => changeDayWidth(DEFAULT_DAY_WIDTH_PX)}
            className="rounded-full border border-cream/30 hover:border-cream/60 transition-colors px-4 py-1.5 text-xs font-medium shrink-0"
          >
            Make columns wider
          </button>
        </div>
      )}
      {segmentMoveError && (
        <div className="flex items-center justify-between gap-3 bg-coral/10 border border-coral/30 rounded-lg px-3 py-2 mb-2">
          <p className="text-sm text-coral">{segmentMoveError}</p>
          <button type="button" onClick={() => setSegmentMoveError(null)} className="text-coral/70 hover:text-coral text-sm shrink-0">
            Dismiss
          </button>
        </div>
      )}
      {/*
        No virtualization: measured (2026-08-30) against the dev DB's actual scale - 15 active
        room units across 6 room types - rendering a full year at the grid's most compact density
        (~5,500 grid cells, ~17.7k total DOM nodes): ~1.1s render, scroll max frame gap ~17.7ms
        (one 60fps frame, no jank). Plain overflow-auto is enough at that scale. This has NOT been measured at a
        larger room count - if the property's room-unit count grows substantially, re-measure
        before assuming this still holds; a bigger inventory could cross the point where
        virtualization (windowing rows/columns, keeping the sticky headers) becomes necessary.
      */}
      <div
        ref={gridRef}
        className="overflow-auto max-h-[75vh] border border-cream/10 rounded-xl relative select-none"
      >
        <div style={{ width: LABEL_WIDTH + dayCount * dayWidth }}>
          {renderDayHeader()}
          {data.roomTypes.map((rt) => (
            <div key={rt.roomId}>
              {renderRoomTypeHeader(rt.roomId, rt.roomName, rt.dailyAvailable)}
              {rt.roomUnits.map((unit: RoomUnit) =>
                renderRow(rt.roomId, unit.id, unit.label, unit.isActive, unit.housekeepingStatus, bookingsForRow(rt.roomId, unit.id))
              )}
              {/* Shown for the saved bookings, so the row doesn't vanish from under a drag that takes its last one away. */}
              {bookingsAtRest(rt.roomId, "").length > 0 &&
                renderRow(rt.roomId, "", "Unassigned", true, undefined, bookingsForRow(rt.roomId, ""))}
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
          canSetPrice={canManage}
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
            <p className="text-cream mb-2">{scheduleConfirm.guestName}</p>
            <dl className="text-sm mb-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
              <dt className="text-cream/40">Now</dt>
              <dd className="text-cream/60">
                {formatDateRange(scheduleConfirm.from.checkIn, scheduleConfirm.from.checkOut)}
                {" · "}
                {unitLabelOrUnassigned(scheduleConfirm.from.roomUnitId)}
              </dd>
              <dt className="text-cream/40">New</dt>
              <dd className="text-cream">
                {formatDateRange(scheduleConfirm.checkIn, scheduleConfirm.checkOut)}
                {" · "}
                {unitLabelOrUnassigned(scheduleConfirm.roomUnitId)}
              </dd>
            </dl>

            {scheduleConfirm.status === "loading" && <p className="text-sm text-cream/50">Pricing…</p>}

            {scheduleConfirm.status === "ready" && scheduleConfirm.quote && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-cream/60">
                    {scheduleConfirm.quote.nights} night{scheduleConfirm.quote.nights === 1 ? "" : "s"}
                  </span>
                  <span className="font-display italic text-3xl text-coral">
                    {formatBaht(scheduleConfirm.quote.totalPrice)}
                  </span>
                </div>
                {!scheduleConfirm.quote.available && <p className="text-sm text-coral">{scheduleConfirm.quote.reason}</p>}
                {scheduleConfirm.quote.available && (
                  <PaidPriceNotice reopensPaid={scheduleConfirm.quote.reopensPaid} paidWarning={scheduleConfirm.quote.paidWarning} />
                )}
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

      {swapConfirm && (
        <div className="fixed inset-0 z-50 bg-ink/80 flex items-center justify-center p-4" onClick={() => setSwapConfirm(null)}>
          <div className="bg-ink2 border border-cream/15 rounded-xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
            <p className="eyebrow text-sea mb-1">Confirm room swap</p>
            <p className="text-sm text-cream/60 mb-4">This moves two guests at once - check both before confirming.</p>
            <div className="space-y-2 mb-4 text-sm">
              <p className="text-cream">
                {swapConfirm.draggedGuestName}
                <span className="text-cream/40"> · </span>
                {roomUnitLabelById.get(swapConfirm.draggedRoomUnitId) ?? swapConfirm.draggedRoomUnitId}
                <span className="text-cream/40"> → </span>
                {roomUnitLabelById.get(swapConfirm.targetRoomUnitId) ?? swapConfirm.targetRoomUnitId}
              </p>
              <p className="text-cream">
                {swapConfirm.targetGuestName}
                <span className="text-cream/40"> · </span>
                {roomUnitLabelById.get(swapConfirm.targetRoomUnitId) ?? swapConfirm.targetRoomUnitId}
                <span className="text-cream/40"> → </span>
                {roomUnitLabelById.get(swapConfirm.draggedRoomUnitId) ?? swapConfirm.draggedRoomUnitId}
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
                onClick={() => setSwapConfirm(null)}
                className="text-sm text-cream/60 hover:text-cream transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {relocation && (
        <RelocationDialog
          booking={relocation.booking}
          canManage={canManage}
          preset={relocation.preset}
          onClose={() => setRelocation(null)}
          onSaved={() => router.refresh()}
        />
      )}

      {selectedBookingId && (
        <BookingCardPanel
          bookingId={selectedBookingId}
          canManage={canManage}
          onChanged={() => router.refresh()}
          onClose={() => {
            setSelectedBookingId(null);
            router.refresh();
          }}
        />
      )}

      {selectedBlockRange && (
        <RoomUnitBlockPanel
          roomUnitId={selectedBlockRange.roomUnitId}
          roomLabel={selectedBlockRange.label}
          // Every raw block on this unit whose range overlaps the clicked merged bar - exactly
          // the set mergeBlocksByUnit would have folded into that one bar (see its own comment:
          // merging is transitive over overlapping/adjacent ranges, so any block touching the
          // bar's span was part of the same merge).
          blocks={data.blocks.filter(
            (b) =>
              b.roomUnitId === selectedBlockRange.roomUnitId &&
              dateOnlyUTC(b.fromDate).getTime() <= selectedBlockRange.toDate.getTime() &&
              dateOnlyUTC(b.toDate).getTime() >= selectedBlockRange.fromDate.getTime()
          )}
          canManage={canManage}
          onClose={() => setSelectedBlockRange(null)}
          onSaved={() => {
            setSelectedBlockRange(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}

function SelectionGhost({
  dragState,
  gridFrom,
  dayCount,
  dayWidth,
}: {
  dragState: { startDate: Date; currentDate: Date };
  gridFrom: Date;
  dayCount: number;
  dayWidth: number;
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
      style={{ left: startCol * dayWidth + 2, width: colSpan * dayWidth - 4, top: 3, height: ROW_HEIGHT - 6 }}
    />
  );
}
