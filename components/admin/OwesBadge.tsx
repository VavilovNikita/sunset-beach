import { settlementChip } from "@/lib/bookingStatusLabel";
import type { BookingStatus, SettlementStatus } from "@/lib/types";

// The money chip beside a booking's status, from the server's `settlement` (see lib/bookingStatusLabel.ts):
// "Owes ฿X" once the debt has fallen due (Booking.owes - a future booking that is merely unpaid shows nothing; it is
// money still to collect, not owed), "Credit ฿X" for an overpayment, "Settled" beside "Room paid". Gated on the
// amount, never a count of charges. Everything comes from the server as sent; nothing is worked out here. `owes` is
// left out only by a caller whose rows are due by definition (the night audit's unpaid balances).
export default function OwesBadge({
  balanceDue,
  owes = true,
  settlement,
  status,
  creditBalance,
}: {
  balanceDue: string | number | null | undefined;
  owes?: boolean | null;
  settlement?: SettlementStatus | null;
  status?: BookingStatus | null;
  creditBalance?: string | number | null;
}) {
  const chip = settlementChip({ settlement, status, balanceDue, creditBalance, owes });
  if (!chip) return null;
  const tone =
    chip.tone === "owes" ? "bg-amber-400/15 text-amber-400" : chip.tone === "credit" ? "bg-sea/15 text-sea" : "bg-green-500/15 text-green-400";
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-1 text-xs whitespace-nowrap ${tone}`}
      title={chip.tone === "owes" ? `${chip.text.replace("Owes ", "")} is still owed on this booking.` : undefined}
    >
      {chip.text}
    </span>
  );
}
