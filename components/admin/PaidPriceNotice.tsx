// The server's sentence about what a price change does to a booking whose room is marked PAID
// (BookingScheduleQuote / RelocationQuote / RepriceQuote `paidWarning`): shown before the change is
// confirmed. "Room paid will be reopened: the guest will owe ฿X." is a warning; "The room stays paid ...
// credit" is information. The wording is the server's - this only places it.
export default function PaidPriceNotice({ reopensPaid, paidWarning }: { reopensPaid?: boolean; paidWarning?: string }) {
  if (!paidWarning) return null;
  return (
    <p
      role={reopensPaid ? "alert" : undefined}
      className={`text-xs rounded-lg border px-3 py-2 ${reopensPaid ? "border-coral/50 bg-coral/10 text-coral" : "border-cream/15 text-cream/70"}`}
    >
      {paidWarning}
    </p>
  );
}
