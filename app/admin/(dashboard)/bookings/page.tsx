import type { BookingStatus, Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { parseDateKey } from "@/lib/bookings";
import BookingsTable from "@/components/admin/BookingsTable";

const STATUSES: BookingStatus[] = ["NEW", "CONFIRMED", "PAID", "CANCELLED"];

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; status?: string };
}) {
  const { from, to, status } = searchParams;

  const where: Prisma.BookingWhereInput = {};
  if (status) where.status = status as BookingStatus;
  if (from) where.checkOut = { gt: parseDateKey(from) };
  if (to) where.checkIn = { lt: parseDateKey(to) };

  const bookings = await prisma.booking.findMany({
    where,
    include: { room: true },
    orderBy: { checkIn: "asc" },
  });

  const exportParams = new URLSearchParams();
  if (from) exportParams.set("from", from);
  if (to) exportParams.set("to", to);
  if (status) exportParams.set("status", status);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="eyebrow text-sea mb-2">Reservations</p>
          <h1 className="font-display italic text-3xl">Bookings</h1>
        </div>
        <a
          href={`/api/bookings/export?${exportParams.toString()}`}
          className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-5 py-2.5 text-sm font-medium"
        >
          Export CSV
        </a>
      </div>

      <form method="get" className="flex flex-wrap items-end gap-4 mb-8 bg-ink2/40 border border-cream/10 rounded-xl p-4">
        <div>
          <label className="eyebrow text-cream/60 block mb-1">From</label>
          <input
            type="date"
            name="from"
            defaultValue={from}
            className="bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">To</label>
          <input
            type="date"
            name="to"
            defaultValue={to}
            className="bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Status</label>
          <select
            name="status"
            defaultValue={status ?? ""}
            className="bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2.5 text-sm font-medium"
        >
          Filter
        </button>
      </form>

      <BookingsTable bookings={bookings} />
    </div>
  );
}
