// Pure layout math for the booking calendar grid (components/admin/BookingCalendarGrid.tsx).
// No React, no fetch — day-column geometry, block-overlap merging for display, and
// booking-lane assignment for overlapping bookings on the same physical room. Kept separate so
// it's testable/reasoned-about independent of pointer-event wiring.
//
// All date math goes through dateOnlyUTC/addDaysUTC (lib/bookings.ts) — never a manual string
// slice or `new Date(str)`. A naive parse has broken on this API's date fields before (see
// lib/bookings.ts's parseDateKey comment — that exact bug silently zeroed the dashboard's
// revenue/occupancy numbers), so route through the shared helper even where the field looks
// like a plain "YYYY-MM-DD" today.

import { addDaysUTC, dateOnlyUTC } from "@/lib/bookings";
import type { CalendarBooking, RoomUnitBlock } from "@/lib/types";

// The single rule that decides whether the grid trusts a mouse for anything date-precise on a
// given day-column: resizing/moving an existing booking, dragging a range across free cells, and
// range-select-vs-single-click on an empty cell all key off this one constant (see
// BookingCalendarGrid) - never off a named zoom level. A booking bar's edge-resize handles are a
// fixed 8px hit-region each (`w-2`) regardless of column width, and a bar is rendered at
// `dayWidth - 4` for a single night (its narrowest possible shape). At the threshold below, the
// two 8px handles plus that padding would leave a "grab the middle to move" zone smaller than
// ~24px - the target size WCAG 2.5.5 treats as the comfortable minimum for a precise pointer
// action, and also below what the resize handles themselves need to stay visually and
// functionally distinct from the middle. 44px (a single night's bar renders at 40px, leaving
// exactly 24px between the two 8px handles) is also comfortably wide for day-boundary hit-testing
// against ordinary mouse jitter (a few px) - not just "clickable" but a target a hand can return
// to reliably.
export const DRAG_THRESHOLD_PX = 44;

// A booking bar hides its guest-name label once its own rendered width can't fit even a couple of
// truncated characters plus the ellipsis - checked per bar (colSpan * dayWidth), not per zoom
// level, since a short 1-night stay and a 2-week stay can render at wildly different widths at
// the very same density.
export const LABEL_MIN_WIDTH_PX = 36;

function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

function clamp(n: number, min: number, max: number) {
  return Math.min(Math.max(n, min), max);
}

// One column per day in the half-open [from, to) range — same convention as a stay.
export function buildDayColumns(from: string, to: string): Date[] {
  const start = dateOnlyUTC(from);
  const end = dateOnlyUTC(to);
  const days: Date[] = [];
  for (let d = start; d.getTime() < end.getTime(); d = addDaysUTC(d, 1)) {
    days.push(d);
  }
  return days;
}

export function isSameUTCDate(a: Date, b: Date) {
  return a.getTime() === b.getTime();
}

// Column span [startCol, startCol + colSpan) for a half-open date range, clipped to the grid's
// visible bounds — a stay/block that starts before `gridFrom` or ends after the last visible
// column is drawn cut off at the edge instead of producing a negative width or overflowing the
// grid container.
export function columnSpan(rangeStart: Date, rangeEndExclusive: Date, gridFrom: Date, gridDayCount: number) {
  const startCol = clamp(daysBetween(gridFrom, rangeStart), 0, gridDayCount);
  const endCol = clamp(daysBetween(gridFrom, rangeEndExclusive), 0, gridDayCount);
  return { startCol, colSpan: Math.max(endCol - startCol, 0) };
}

export type MergedBlockSegment = {
  roomUnitId: string;
  /** Inclusive, same convention as RoomUnitBlock.fromDate/toDate. */
  fromDate: Date;
  toDate: Date;
  reasons: string[];
};

/**
 * RoomUnitBlock deliberately allows overlapping blocks on the same unit (nothing merges or
 * dedupes them at creation) - the calendar grid must not let one silently hide behind another.
 * Groups by roomUnitId, then merges overlapping/adjacent (touching, no gap) ranges into visual
 * segments, collecting every distinct reason that contributed to each merged segment so the
 * tooltip can show all of them rather than picking one arbitrarily.
 */
export function mergeBlocksByUnit(blocks: RoomUnitBlock[]): Map<string, MergedBlockSegment[]> {
  const byUnit = new Map<string, RoomUnitBlock[]>();
  for (const block of blocks) {
    const list = byUnit.get(block.roomUnitId) ?? [];
    list.push(block);
    byUnit.set(block.roomUnitId, list);
  }

  const result = new Map<string, MergedBlockSegment[]>();
  for (const [roomUnitId, unitBlocks] of byUnit) {
    const sorted = [...unitBlocks].sort((a, b) => dateOnlyUTC(a.fromDate).getTime() - dateOnlyUTC(b.fromDate).getTime());
    const segments: MergedBlockSegment[] = [];
    for (const block of sorted) {
      const from = dateOnlyUTC(block.fromDate);
      const to = dateOnlyUTC(block.toDate);
      const last = segments[segments.length - 1];
      // Adjacent (starts the day after the previous segment ends) counts as mergeable too, so
      // staff see one continuous outage instead of a one-pixel gap between two blocks that are
      // effectively the same closure recorded in two rows.
      if (last && from.getTime() <= addDaysUTC(last.toDate, 1).getTime()) {
        if (to.getTime() > last.toDate.getTime()) last.toDate = to;
        if (!last.reasons.includes(block.reason)) last.reasons.push(block.reason);
      } else {
        segments.push({ roomUnitId, fromDate: from, toDate: to, reasons: [block.reason] });
      }
    }
    result.set(roomUnitId, segments);
  }
  return result;
}

export type BookingLane = { booking: CalendarBooking; lane: number };

/**
 * SERIALIZABLE transactions stop two overlapping bookings from being assigned the same unit
 * going forward, but historical data (or direct DB intervention) can still contain such a
 * conflict - and availableCount is deliberately not clamped at zero specifically because this
 * kind of desync is meant to stay visible, not be hidden. Greedy interval-graph coloring: sorts
 * by check-in, places each booking in the first lane whose last booking has already checked out
 * by this one's check-in, opening a new lane otherwise. Non-overlapping bookings on a real unit
 * always land in lane 0 - `laneCount > 1` is the signal a unit has a genuine double-booking that
 * needs staff attention, not a rendering choice.
 */
export function assignLanes(bookings: CalendarBooking[]): { lanes: BookingLane[]; laneCount: number } {
  const sorted = [...bookings].sort((a, b) => dateOnlyUTC(a.checkIn).getTime() - dateOnlyUTC(b.checkIn).getTime());
  const laneEnds: number[] = [];
  const lanes: BookingLane[] = [];
  for (const booking of sorted) {
    const start = dateOnlyUTC(booking.checkIn).getTime();
    const end = dateOnlyUTC(booking.checkOut).getTime(); // half-open - checkout day is free
    let lane = laneEnds.findIndex((laneEnd) => laneEnd <= start);
    if (lane === -1) {
      lane = laneEnds.length;
      laneEnds.push(end);
    } else {
      laneEnds[lane] = end;
    }
    lanes.push({ booking, lane });
  }
  return { lanes, laneCount: laneEnds.length };
}

// Groups a room type's bookings by physical unit for rendering one row per unit, plus a pinned
// "unassigned" bucket (key "") for bookings occupying the type but with no roomUnitId yet - see
// BookingCalendarResponse's doc comment for why this is a single list with a nullable field
// rather than a parallel array.
export function groupBookingsByUnit(bookings: CalendarBooking[]): Map<string, CalendarBooking[]> {
  const byUnit = new Map<string, CalendarBooking[]>();
  for (const booking of bookings) {
    const key = booking.roomUnitId ?? "";
    const list = byUnit.get(key) ?? [];
    list.push(booking);
    byUnit.set(key, list);
  }
  return byUnit;
}
