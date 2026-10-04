import type { ShiftSummary } from "@/lib/posTypes";
import { formatTimestamp } from "@/lib/formatDate";

// expectedCash/discrepancy are never returned by the API - the backend computes the same
// arithmetic (openingFloat + POS cash + folio cash taken at reception, counted - expected) several times
// (SHIFT_CLOSED audit summary, the printed Z-report, the CSV export - see ShiftService) but
// never puts it on the Shift/ShiftSummary response itself, so the one thing shift close is
// actually FOR (does the drawer match) was only ever visible after the fact, in the audit log.
// Every input this needs (openingCashFloat, totals.cash) is already on ShiftSummary, so this is
// computed here rather than waiting on a backend field - kept in lockstep with
// ShiftService#describeShiftClose/buildZReportPayload if either changes.
//
// Shared logic, not shared rendering: components/admin/pos/ShiftPanel.tsx and
// components/pos/PosShiftPanel.tsx each keep their own DiscrepancyBlock/StatCard-vs-StatTile
// layout (that split is deliberate - see the admin/pos split note in both files), but the
// arithmetic itself computes money and was, until now, duplicated and untested in both places -
// exactly the combination this project's own testing rule exists to catch ("anything in lib/
// that computes a number... should be tested, because a wrong result there is invisible on
// screen"). Extracted here once, tested once, imported by both.
export type ReconciledCash = { expectedCash: number; counted: number | null; discrepancy: number | null };

export function reconcileCash(shift: ShiftSummary, countedInput: string): ReconciledCash {
  const expectedCash = Number(shift.openingCashFloat ?? 0) + Number(shift.totals.cash) + Number(shift.totals.folioCash ?? 0);
  const counted = shift.closingCashCounted != null ? Number(shift.closingCashCounted) : countedInput ? Number(countedInput) : null;
  const discrepancy = counted !== null ? counted - expectedCash : null;
  return { expectedCash, counted, discrepancy };
}

// The "who opened this drawer, when, with how much" facts shown at the top of an open or closed
// shift on every shift screen (admin panel, phone panel, shift report). Display only - the float
// is the server's own figure, never re-derived.
export type ShiftOpeningFacts = { openedBy: string; openedAt: string; openingFloat: string };

export function shiftOpeningFacts(shift: Pick<ShiftSummary, "openedByEmail" | "openedAt" | "openingCashFloat">): ShiftOpeningFacts {
  return {
    openedBy: shift.openedByEmail || "Unknown staff member",
    openedAt: formatTimestamp(shift.openedAt),
    openingFloat: shift.openingCashFloat != null ? `฿${Number(shift.openingCashFloat).toLocaleString("en-US")}` : "Not entered",
  };
}

// A cash shift is one session at the till - opened with a float, closed by counting the drawer at
// the end of the day. Still open after a day means nobody counted it (a shift open since 2 Sep was
// found by accident), so every shift screen and both POS boards flag it. Same 24h as a forgotten
// order (lib/posOrders.ts#LONG_OPEN_HOURS).
export const LONG_OPEN_SHIFT_HOURS = 24;

export function isLongOpenShift(shift: { status: "OPEN" | "CLOSED"; openedAt: string }, now: Date): boolean {
  if (shift.status !== "OPEN") return false;
  const openedAt = new Date(shift.openedAt).getTime();
  if (Number.isNaN(openedAt)) return false;
  return now.getTime() - openedAt >= LONG_OPEN_SHIFT_HOURS * 3600_000;
}
