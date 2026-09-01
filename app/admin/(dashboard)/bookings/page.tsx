import { backendJson } from "@/lib/backendServer";
import { ADMIN_API_URL } from "@/lib/backend";
import { requireRoleAtLeast, hasRoleAtLeast } from "@/lib/rbac";
import BookingsTable from "@/components/admin/BookingsTable";
import type { Booking, BookingStatus } from "@/lib/types";
import type { Folio } from "@/lib/posTypes";

const STATUSES: BookingStatus[] = ["NEW", "CONFIRMED", "PAID", "CANCELLED"];

export default async function AdminBookingsPage({
  searchParams,
}: {
  searchParams: { from?: string; to?: string; status?: string };
}) {
  // GET /bookings is CASHIER+ on the backend (front-desk work); a WAITER
  // navigating here directly (the sidebar itself no longer links to it —
  // see AdminSidebar's CASHIER_PLUS_LINKS) would otherwise crash the page
  // on the fetch below.
  const user = await requireRoleAtLeast("CASHIER", "/admin/pos");
  const { from, to, status } = searchParams;

  const query = new URLSearchParams();
  if (from) query.set("from", from);
  if (to) query.set("to", to);
  if (status) query.set("status", status);

  const bookings = await backendJson<Booking[]>(`/bookings?${query.toString()}`, { auth: true });

  // The "owes for POS charges" badge only ever applies to a PAID booking - fetch each PAID
  // row's already-existing folio (no new backend computation, just GET /bookings/{id}/folio,
  // same endpoint the calendar panel and booking detail page already call) in parallel,
  // server-side, so this table doesn't need N client round trips or a new bulk endpoint. Scoped
  // to PAID rows specifically, not every booking on the page, to keep this bounded.
  const paidBookingIds = bookings.filter((b) => b.status === "PAID").map((b) => b.id);
  const folioEntries = await Promise.all(
    paidBookingIds.map(async (id) => {
      try {
        return [id, await backendJson<Folio>(`/bookings/${id}/folio`, { auth: true })] as const;
      } catch {
        return null;
      }
    })
  );
  const folios: Record<string, Folio> = Object.fromEntries(folioEntries.filter((e): e is [string, Folio] => e !== null));

  // GET /bookings/export is MANAGER+ (a bulk CSV of every guest's contact
  // details is a different risk profile than looking up one booking) —
  // stricter than this page's own CASHIER+ floor, so the link is hidden
  // rather than left for a CASHIER to click into a raw 403.
  const canExport = hasRoleAtLeast(user.role, "MANAGER");

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="eyebrow text-sea mb-2">Reservations</p>
          <h1 className="font-display italic text-3xl">Bookings</h1>
        </div>
        {canExport && (
          <a
            href={`${ADMIN_API_URL}/bookings/export?${query.toString()}`}
            className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-5 py-2.5 text-sm font-medium"
          >
            Export CSV
          </a>
        )}
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

      <BookingsTable bookings={bookings} folios={folios} />
    </div>
  );
}
