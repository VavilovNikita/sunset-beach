import type { ShiftSummary } from "@/lib/posTypes";

// expectedCash/discrepancy are never returned by the API - the backend computes the same
// arithmetic (openingFloat + cash payments, counted - expected) three separate times
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
  const expectedCash = Number(shift.openingCashFloat ?? 0) + Number(shift.totals.cash);
  const counted = shift.closingCashCounted != null ? Number(shift.closingCashCounted) : countedInput ? Number(countedInput) : null;
  const discrepancy = counted !== null ? counted - expectedCash : null;
  return { expectedCash, counted, discrepancy };
}
