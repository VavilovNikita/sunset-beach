import { formatBaht } from "@/lib/money";
import type { CheckOutPreview } from "@/lib/types";

// An overstaying guest owes tonight's night until they are checked out, and is not charged it when they leave today -
// so the Today board's figure and the one they settle at the desk differ. Both are the server's; this only words them.
// Null when there is a single figure to show. Pure, tested in checkOutAmounts.test.ts.
export type CheckOutAmounts = { owedNow: string; afterCheckOut: string };

export function checkOutAmounts(
  preview: Pick<CheckOutPreview, "tonightNotCharged" | "balanceDueNow" | "outstandingBalance">
): CheckOutAmounts | null {
  if (!preview.tonightNotCharged) return null;
  return {
    owedNow: `Owed now ${formatBaht(preview.balanceDueNow)} (incl. tonight)`,
    afterCheckOut: `Balance after check-out ${formatBaht(preview.outstandingBalance)} — tonight's night is not charged when they leave today`,
  };
}
