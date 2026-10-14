// "Owes ฿X" - shown when the server says the debt has already fallen due (Booking.owes) AND the
// balance (Booking.balanceDue, the folio's single balance) is above zero: a guest in the house or
// gone who has not paid, a CANCELLED booking that still carries charges, a stay whose dates are over.
// A future booking that is merely unpaid shows no badge - that money is still to be collected, not
// owed. Gated on the amount, never a count of charges (a count never goes back down).
// Both values come from the server as sent; nothing is worked out here. `owes` is left out only by
// a caller whose rows are due by definition (the night audit's unpaid balances).
export default function OwesBadge({ balanceDue, owes = true }: { balanceDue: string | number | null | undefined; owes?: boolean | null }) {
  if (owes === false) return null;
  if (!(Number(balanceDue) > 0)) return null;

  const amount = `฿${Number(balanceDue).toLocaleString("en-US")}`;

  return (
    <span
      className="inline-block rounded-full px-2.5 py-1 text-xs bg-amber-400/15 text-amber-400 whitespace-nowrap"
      title={`${amount} is still owed on this booking.`}
    >
      Owes {amount}
    </span>
  );
}
