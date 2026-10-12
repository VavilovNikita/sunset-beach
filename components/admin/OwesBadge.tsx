// "Owes ฿X" - shown for ANY booking whose server-computed balance (Booking.balanceDue, the folio's
// single balance) is above zero, whatever its status: a checked-out guest who left without paying,
// a NEW booking whose dates have passed, a CANCELLED one that still carries POS charges. A PAID
// status says the room is settled, not that nothing is owed, and a status badge alone used to hide
// all of these. Gated on the amount, never a count of charges (a count never goes back down).
// `balanceDue` comes from the server as sent; nothing is worked out here.
export default function OwesBadge({ balanceDue }: { balanceDue: string | number | null | undefined }) {
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
