// A PAID booking's status means the room/stay itself has been settled - it says nothing about
// unpaid POS charges (bar, restaurant, room service) run up on the same folio, which is routine
// at a resort that takes prepayment. Without this, PAID reads as "guest owes nothing," which is
// wrong whenever there's an open room charge. This badge is the persistent version of that fact,
// for anywhere staff see the status badge/select but not the folio itself (BookingsTable,
// BookingCardPanel) - the booking detail page already shows the full folio right next to status,
// so it doesn't need this separately.
//
// Gated on roomChargesTotal (amount owed, net of any recorded FolioPayment settlement), not
// roomChargeCount - the count is a raw historical tally of every ROOM_CHARGE payment this stay
// ever generated and never goes back down once a guest settles up, so gating on it would leave
// this badge stuck on forever. See lib/folioPaymentClient.ts for how a charge gets settled.
export default function RoomChargeDebtBadge({ roomChargesTotal }: { roomChargesTotal: string | number }) {
  if (Number(roomChargesTotal) <= 0) return null;

  const amount = `฿${Number(roomChargesTotal).toLocaleString("en-US")}`;

  return (
    <span
      className="inline-block rounded-full px-2.5 py-1 text-xs bg-amber-400/15 text-amber-400 whitespace-nowrap"
      title={`Room is paid, but ${amount} in POS room charges hasn't been collected yet.`}
    >
      Owes {amount}
    </span>
  );
}
