import Link from "next/link";

const STATUS_STYLES: Record<string, string> = {
  NEW: "bg-sea/15 text-sea",
  CONFIRMED: "bg-coral/15 text-coral",
  PAID: "bg-green-500/15 text-green-400",
  CANCELLED: "bg-cream/10 text-cream/40",
};

type Row = {
  id: string;
  room: { name: string };
  guestName: string;
  guestEmail: string;
  checkIn: Date;
  checkOut: Date;
  totalPrice: unknown;
  status: string;
  createdAt: Date;
};

export default function BookingsTable({ bookings }: { bookings: Row[] }) {
  if (bookings.length === 0) {
    return <p className="text-cream/50 text-sm">No bookings match these filters.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-cream/40 eyebrow border-b border-cream/10">
            <th className="py-2 pr-4">Guest</th>
            <th className="py-2 pr-4">Room</th>
            <th className="py-2 pr-4">Check-in</th>
            <th className="py-2 pr-4">Check-out</th>
            <th className="py-2 pr-4">Total</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4">Booked</th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => (
            <tr key={b.id} className="border-b border-cream/5 hover:bg-cream/5">
              <td className="py-3 pr-4">
                <Link href={`/admin/bookings/${b.id}`} className="text-cream hover:text-coral transition-colors">
                  {b.guestName}
                </Link>
                <p className="text-xs text-cream/40">{b.guestEmail}</p>
              </td>
              <td className="py-3 pr-4 text-cream/70">{b.room.name}</td>
              <td className="py-3 pr-4 text-cream/70">{b.checkIn.toISOString().slice(0, 10)}</td>
              <td className="py-3 pr-4 text-cream/70">{b.checkOut.toISOString().slice(0, 10)}</td>
              <td className="py-3 pr-4 text-cream/70">฿{Number(b.totalPrice).toLocaleString("en-US")}</td>
              <td className="py-3 pr-4">
                <span className={`rounded-full px-2.5 py-1 text-xs ${STATUS_STYLES[b.status] ?? ""}`}>{b.status}</span>
              </td>
              <td className="py-3 pr-4 text-cream/40 text-xs">{b.createdAt.toISOString().slice(0, 10)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
