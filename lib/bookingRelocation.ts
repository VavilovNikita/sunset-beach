// What the room-move dialog shows and sends, and what dropping a calendar bar on another room
// means. Pure: no React, no fetch, and no money arithmetic - every amount shown is a string the
// server computed (RelocationQuote); the only thing done with one here is formatting it.
import type { OccupancyStatus, RelocationQuote, RelocationRateMode } from "@/lib/types";

export type RateChoice = {
  mode: RelocationRateMode;
  /** Whole booking's total under this rate, from the server. */
  total: string;
  /** Signed difference to the current total, from the server. */
  difference: string;
  /** False when the signed-in user may not apply it (a CASHIER and "keep original rate"). */
  allowed: boolean;
};

/**
 * The rates to offer for a quote. Within one room type the price cannot change, so there is
 * nothing to choose (empty). Across types: the new rate (anyone) and the original rate (the quote
 * says whether this user may apply it).
 */
export function rateChoices(quote: RelocationQuote): RateChoice[] {
  if (quote.sameRoomType || quote.newRateTotalPrice == null || quote.newRatePriceDifference == null) return [];
  return [
    { mode: "NEW_RATE", total: quote.newRateTotalPrice, difference: quote.newRatePriceDifference, allowed: true },
    { mode: "KEEP_RATE", total: quote.keepRateTotalPrice, difference: quote.keepRatePriceDifference, allowed: quote.mayKeepRate },
  ];
}

/**
 * The `rateMode` to send for what the user picked: none within one room type (the server keeps the
 * price), never a mode the user is not allowed to apply, and the new rate when nothing was picked.
 */
export function rateModeToSend(quote: RelocationQuote, picked: RelocationRateMode | null): RelocationRateMode | undefined {
  if (quote.sameRoomType) return undefined;
  if (picked === "KEEP_RATE" && quote.mayKeepRate) return "KEEP_RATE";
  return "NEW_RATE";
}

/** The total and difference shown for the mode that would be applied. */
export function figuresFor(quote: RelocationQuote, mode: RelocationRateMode | undefined): { total: string; difference: string } {
  if (mode === "NEW_RATE" && quote.newRateTotalPrice != null && quote.newRatePriceDifference != null) {
    return { total: quote.newRateTotalPrice, difference: quote.newRatePriceDifference };
  }
  return { total: quote.keepRateTotalPrice, difference: quote.keepRatePriceDifference };
}

export type DifferenceText = { text: string; tone: "up" | "down" | "none" };

/** "+฿1,200" / "−฿500" / "No change" from the server's signed decimal string. Formatting only. */
export function describeDifference(difference: string): DifferenceText {
  const negative = difference.startsWith("-");
  const magnitude = negative ? difference.slice(1) : difference;
  if (/^0*(\.0*)?$/.test(magnitude)) return { text: "No change", tone: "none" };
  const shown = Number(magnitude).toLocaleString("en-US", { maximumFractionDigits: 2 });
  return negative ? { text: `−฿${shown}`, tone: "down" } : { text: `+฿${shown}`, tone: "up" };
}

/**
 * A guest who is in the house and moves from today (or earlier) must be given a room: "no room
 * assigned" would lose where they sleep (a cashier once sent an in-house guest to "Deluxe Suite (no
 * room assigned)"). The server refuses it too (400 on roomUnitId); this is the form saying so first.
 */
export function relocationNeedsUnit(occupancy: OccupancyStatus, effectiveDate: string, todayKey: string): boolean {
  return occupancy === "CHECKED_IN" && effectiveDate <= todayKey;
}

// --- A bar dropped on another room's row ------------------------------------------------------

export type RoomDropIntent =
  | { kind: "relocate"; effectiveDate: string } // open the room-move dialog from this night
  | { kind: "schedule" } // the ordinary quote-then-confirm schedule change (same type, nobody in the room)
  | { kind: "segment-unit" } // a segment of an already-relocated stay, same type, nobody in the room
  | { kind: "none" }; // nothing sensible to do (the segment is entirely in the past)

/**
 * What it means to drop a bar - without changing its dates - on a different room's row.
 *
 * - Another room TYPE: always the room-move dialog (the schedule change cannot cross types, and the
 *   rate has to be chosen), from today if the bar's stay is under way, else from its first night.
 * - The same type but the guest is in the house: the room-move dialog from today, so the nights
 *   already slept stay in the old room and the old room is marked for cleaning; a guest arriving
 *   today starts on the first night.
 * - Otherwise nobody is in the room, so a plain room change as before.
 *
 * `barCheckIn`/`barCheckOut` are the dragged bar's own (segment) dates.
 */
export function roomDropIntent(args: {
  todayKey: string;
  occupancyStatus: OccupancyStatus;
  barRoomId: string;
  targetRoomId: string;
  segmentCount: number;
  barCheckIn: string;
  barCheckOut: string;
}): RoomDropIntent {
  const { todayKey, occupancyStatus, barRoomId, targetRoomId, segmentCount, barCheckIn, barCheckOut } = args;
  const underWay = barCheckIn <= todayKey && todayKey < barCheckOut;
  const upcoming = todayKey < barCheckIn;
  const startOf = underWay ? todayKey : barCheckIn;
  if (barRoomId !== targetRoomId) {
    return underWay || upcoming ? { kind: "relocate", effectiveDate: startOf } : { kind: "none" };
  }
  if (occupancyStatus === "CHECKED_IN" && underWay) return { kind: "relocate", effectiveDate: todayKey };
  return segmentCount > 1 ? { kind: "segment-unit" } : { kind: "schedule" };
}
