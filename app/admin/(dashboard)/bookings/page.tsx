import { backendJson } from "@/lib/backendServer";
import { PUBLIC_BACKEND_URL } from "@/lib/backend";
import BookingsTable from "@/components/admin/BookingsTable";
import type { Booking, BookingStatus } from "@/lib/types";

const STATUSES: BookingStatus[] = ["NEW", "CONFIRMED", "PAID", "CANCELLED"];

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; status?: string };
}) {
  const { from, to, status } = searchParams;

  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  if (status) query.set("status", status);

  const bookings = await backendJson<Booking[]>(`/bookings?${query.toString()}`, { auth: true });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="eyebrow text-sea mb-2">Reservations</p>
          <h1 className="font-display italic text-3xl">Bookings</h1>
        </div>
        <a
          href={`${PUBLIC_BACKEND_URL}/bookings/export?${query.toString()}`}
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
