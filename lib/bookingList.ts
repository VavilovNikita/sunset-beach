import { parseDateKey } from "@/lib/bookings";
import type { Booking, BookingSortField, BookingStatus, SortDirection } from "@/lib/types";

// The admin Bookings list (/admin/bookings): its URL state, column sorting, paging, and the
// "arrival date passed" flag. The server does the searching, sorting and paging
// (GET /bookings/search); this only reads and writes the query string. Pure, tested in
// bookingList.test.ts.

export const BOOKING_LIST_PAGE_SIZE = 50;

const STATUSES: BookingStatus[] = ["NEW", "CONFIRMED", "PAID", "CANCELLED"];
const SORT_FIELDS: BookingSortField[] = ["GUEST_NAME", "ROOM", "CHECK_IN", "CHECK_OUT", "TOTAL_PRICE", "STATUS", "CREATED_AT"];

export type BookingListParams = {
  q: string;
  from: string | null;
  to: string | null;
  status: BookingStatus | null;
  sort: BookingSortField;
  dir: SortDirection;
  page: number;
};

// Latest stays first by default: today's and upcoming arrivals near the top, years-old history at
// the end, instead of the old oldest-first order that buried everything current.
export const DEFAULT_BOOKING_LIST_PARAMS: BookingListParams = {
  q: "",
  from: null,
  to: null,
  status: null,
  sort: "CHECK_IN",
  dir: "DESC",
  page: 0,
};

function validDateKey(value: string | undefined): string | null {
  if (!value) return null;
  try {
    parseDateKey(value);
    return value;
  } catch {
    return null;
  }
}

// Anything malformed in a hand-edited URL falls back to its default rather than reaching the API
// as a 400.
export function parseBookingListParams(sp: Record<string, string | undefined>): BookingListParams {
  const page = Number(sp.page);
  return {
    q: (sp.q ?? "").trim(),
    from: validDateKey(sp.from),
    to: validDateKey(sp.to),
    status: STATUSES.includes(sp.status as BookingStatus) ? (sp.status as BookingStatus) : null,
    sort: SORT_FIELDS.includes(sp.sort as BookingSortField) ? (sp.sort as BookingSortField) : DEFAULT_BOOKING_LIST_PARAMS.sort,
    dir: sp.dir === "ASC" || sp.dir === "DESC" ? sp.dir : DEFAULT_BOOKING_LIST_PARAMS.dir,
    page: Number.isInteger(page) && page > 0 ? page : 0,
  };
}

// Only what differs from the defaults goes in the URL, so a plain /admin/bookings stays plain.
export function bookingListQuery(params: BookingListParams): string {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.status) qs.set("status", params.status);
  if (params.sort !== DEFAULT_BOOKING_LIST_PARAMS.sort || params.dir !== DEFAULT_BOOKING_LIST_PARAMS.dir) {
    qs.set("sort", params.sort);
    qs.set("dir", params.dir);
  }
  if (params.page > 0) qs.set("page", String(params.page));
  return qs.toString();
}

export function bookingListHref(params: BookingListParams): string {
  const query = bookingListQuery(params);
  return query ? `/admin/bookings?${query}` : "/admin/bookings";
}

// The API request for this page of the list.
export function bookingSearchApiPath(params: BookingListParams): string {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.from) qs.set("from", params.from);
  if (params.to) qs.set("to", params.to);
  if (params.status) qs.set("status", params.status);
  qs.set("sort", params.sort);
  qs.set("direction", params.dir);
  qs.set("page", String(params.page));
  qs.set("pageSize", String(BOOKING_LIST_PAGE_SIZE));
  return `/bookings/search?${qs.toString()}`;
}

// Clicking a column header: the same column flips direction; a new column starts with the
// direction people expect from it (names A→Z, dates/amounts newest/largest first). Always back to
// the first page - page 4 of a different order is a meaningless place to land.
export function sortedBy(params: BookingListParams, column: BookingSortField): BookingListParams {
  if (params.sort === column) return { ...params, dir: params.dir === "ASC" ? "DESC" : "ASC", page: 0 };
  const textual = column === "GUEST_NAME" || column === "ROOM" || column === "STATUS";
  return { ...params, sort: column, dir: textual ? "ASC" : "DESC", page: 0 };
}

export function pageSpan(page: number, pageSize: number, totalCount: number): { first: number; last: number; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(totalCount / pageSize));
  if (totalCount === 0) return { first: 0, last: 0, pageCount };
  const first = page * pageSize + 1;
  return { first, last: Math.min(totalCount, first + pageSize - 1), pageCount };
}

// A live booking (not cancelled) whose guest never checked in and whose arrival date is already
// behind us - a probable no-show nobody has dealt with. Deliberately only a flag: the status stays
// what staff set (the backend never changes it on its own for a staff booking), but a weeks-old
// "NEW" no longer looks like an ordinary upcoming stay. The way out is the booking's own
// check-in / no-show actions. todayKey is the hotel's date (hotelDateKey, lib/hotelDate.ts).
export function isArrivalPassed(booking: Pick<Booking, "status" | "occupancyStatus" | "checkIn">, todayKey: string): boolean {
  return booking.status !== "CANCELLED" && booking.occupancyStatus === "EXPECTED" && booking.checkIn < todayKey;
}
