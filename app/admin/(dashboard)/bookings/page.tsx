import Link from "next/link";
import { backendJson } from "@/lib/backendServer";
import { ADMIN_API_URL } from "@/lib/backend";
import { requireRoleAtLeast, hasRoleAtLeast } from "@/lib/rbac";
import { hotelDateKey } from "@/lib/hotelDate";
import {
  BOOKING_LIST_PAGE_SIZE,
  bookingListHref,
  bookingSearchApiPath,
  pageSpan,
  parseBookingListParams,
  sortedBy,
} from "@/lib/bookingList";
import BookingsTable from "@/components/admin/BookingsTable";
import type { BookingPage, BookingSortField, BookingStatus } from "@/lib/types";
import type { Folio } from "@/lib/posTypes";

const STATUSES: BookingStatus[] = ["NEW", "CONFIRMED", "PAID", "CANCELLED"];
const SORT_FIELDS: BookingSortField[] = ["GUEST_NAME", "ROOM", "CHECK_IN", "CHECK_OUT", "TOTAL_PRICE", "STATUS", "CREATED_AT"];

export default async function AdminBookingsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  // GET /bookings/search is CASHIER+ on the backend (front-desk work); a WAITER
  // navigating here directly (the sidebar itself no longer links to it —
  // see AdminSidebar's CASHIER_PLUS_LINKS) would otherwise crash the page
  // on the fetch below.
  const user = await requireRoleAtLeast("CASHIER", "/admin/pos");
  const params = parseBookingListParams(searchParams);

  // Searched, sorted and paged by the server - the list used to load every booking ever made and
  // show it oldest-first, with no way to find one but scrolling.
  const result = await backendJson<BookingPage>(bookingSearchApiPath(params), { auth: true });
  const bookings = result.items;

  // The "owes for POS charges" badge only ever applies to a PAID booking - fetch each PAID
  // row's already-existing folio (no new backend computation, just GET /bookings/{id}/folio,
  // same endpoint the calendar panel and booking detail page already call) in parallel,
  // server-side. Bounded by the page size now that the list is paged.
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

  const sortHrefs = Object.fromEntries(SORT_FIELDS.map((f) => [f, bookingListHref(sortedBy(params, f))])) as Record<BookingSortField, string>;
  const { first, last, pageCount } = pageSpan(params.page, BOOKING_LIST_PAGE_SIZE, result.totalCount);
  const filtered = Boolean(params.q || params.from || params.to || params.status);

  // GET /bookings/export is MANAGER+ (a bulk CSV of every guest's contact
  // details is a different risk profile than looking up one booking) —
  // stricter than this page's own CASHIER+ floor, so the link is hidden
  // rather than left for a CASHIER to click into a raw 403. It takes the date/status filters only
  // (no text search - it's a date-range report, not a lookup tool).
  const canExport = hasRoleAtLeast(user.role, "MANAGER");
  const exportQuery = new URLSearchParams();
  if (params.from) exportQuery.set("from", params.from);
  if (params.to) exportQuery.set("to", params.to);
  if (params.status) exportQuery.set("status", params.status);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="eyebrow text-sea mb-2">Reservations</p>
          <h1 className="font-display italic text-3xl">Bookings</h1>
        </div>
        {canExport && (
          <a
            href={`${ADMIN_API_URL}/bookings/export?${exportQuery.toString()}`}
            className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-5 py-2.5 text-sm font-medium"
          >
            Export CSV
          </a>
        )}
      </div>

      <form method="get" className="flex flex-wrap items-end gap-4 mb-6 bg-ink2/40 border border-cream/10 rounded-xl p-4">
        <div className="flex-1 min-w-[14rem]">
          <label className="eyebrow text-cream/60 block mb-1">Search</label>
          <input
            type="search"
            name="q"
            defaultValue={params.q}
            placeholder="Guest name, email, phone or reference"
            className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm placeholder:text-cream/30"
          />
        </div>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">From</label>
          <input type="date" name="from" defaultValue={params.from ?? ""} className="bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">To</label>
          <input type="date" name="to" defaultValue={params.to ?? ""} className="bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Status</label>
          <select name="status" defaultValue={params.status ?? ""} className="bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm">
            <option value="">All</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        {/* A new search keeps the chosen sort but starts again at page one. */}
        <input type="hidden" name="sort" value={params.sort} />
        <input type="hidden" name="dir" value={params.dir} />
        <button type="submit" className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2.5 text-sm font-medium">
          Search
        </button>
        {filtered && (
          <Link href={bookingListHref({ ...params, q: "", from: null, to: null, status: null, page: 0 })} className="text-sm text-cream/60 hover:text-cream self-center">
            Clear
          </Link>
        )}
      </form>

      <p className="text-xs text-cream/50 mb-3">
        {result.totalCount === 0
          ? "No bookings"
          : `${first}–${last} of ${result.totalCount} booking${result.totalCount === 1 ? "" : "s"}`}
      </p>

      <BookingsTable
        bookings={bookings}
        folios={folios}
        sort={params.sort}
        dir={params.dir}
        sortHrefs={sortHrefs}
        todayKey={hotelDateKey(new Date())}
        emptyMessage={filtered ? "No bookings match this search." : "No bookings yet."}
      />

      {pageCount > 1 && (
        <nav className="flex items-center justify-between mt-6 text-sm" aria-label="Pages">
          {params.page > 0 ? (
            <Link href={bookingListHref({ ...params, page: params.page - 1 })} className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-4 py-2">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-cream/50">
            Page {params.page + 1} of {pageCount}
          </span>
          {params.page + 1 < pageCount ? (
            <Link href={bookingListHref({ ...params, page: params.page + 1 })} className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-4 py-2">
              Next →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
