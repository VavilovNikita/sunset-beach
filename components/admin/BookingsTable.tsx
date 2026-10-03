"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import RoomChargeDebtBadge from "@/components/admin/RoomChargeDebtBadge";
import { isArrivalPassed } from "@/lib/bookingList";
import { roomTypeSummary, roomUnitSummary } from "@/lib/bookingRooms";
import { formatDate, formatTimestampDate } from "@/lib/formatDate";
import type { Booking, BookingSortField, SortDirection } from "@/lib/types";
import type { Folio } from "@/lib/posTypes";

const STATUS_STYLES: Record<string, string> = {
  NEW: "bg-sea/15 text-sea",
  CONFIRMED: "bg-coral/15 text-coral",
  PAID: "bg-green-500/15 text-green-400",
  CANCELLED: "bg-cream/10 text-cream/40",
};

const COLUMNS: { label: string; sort: BookingSortField | null }[] = [
  { label: "Guest", sort: "GUEST_NAME" },
  { label: "Room", sort: "ROOM" },
  { label: "Assigned", sort: null },
  { label: "Check-in", sort: "CHECK_IN" },
  { label: "Check-out", sort: "CHECK_OUT" },
  { label: "Total", sort: "TOTAL_PRICE" },
  { label: "Status", sort: "STATUS" },
  { label: "Booked", sort: "CREATED_AT" },
];

// One page of the Bookings list. Sorting is the server's (GET /bookings/search); a header is a
// plain link to the same list sorted by that column (sortHrefs, built by the page), so sorting
// survives a reload and a shared link. "Assigned" isn't sortable - a relocated booking has more
// than one room.
export default function BookingsTable({
  bookings,
  folios = {},
  sort,
  dir,
  sortHrefs,
  todayKey,
  emptyMessage,
}: {
  bookings: Booking[];
  folios?: Record<string, Folio>;
  sort: BookingSortField;
  dir: SortDirection;
  sortHrefs: Record<BookingSortField, string>;
  // The hotel's date, for the "arrival date passed" flag (lib/bookingList.ts#isArrivalPassed).
  todayKey: string;
  emptyMessage: string;
}) {
  const router = useRouter();

  // A link/button inside the row handles its own click (and must keep working with middle-click,
  // Cmd/Ctrl-click, and keyboard nav) - only a click that lands on plain row content opens the
  // booking. A non-empty selection means the user was dragging to select text, not clicking.
  function handleRowClick(e: React.MouseEvent<HTMLTableRowElement>, bookingId: string) {
    if (e.target instanceof Element && e.target.closest("a, button")) return;
    if ((window.getSelection()?.toString().length ?? 0) > 0) return;
    router.push(`/admin/bookings/${bookingId}`);
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-cream/40 eyebrow border-b border-cream/10">
            {COLUMNS.map((col) => (
              <th
                key={col.label}
                className="py-2 pr-4"
                aria-sort={col.sort && col.sort === sort ? (dir === "ASC" ? "ascending" : "descending") : undefined}
              >
                {col.sort ? (
                  <Link
                    href={sortHrefs[col.sort]}
                    className={`hover:text-cream transition-colors ${col.sort === sort ? "text-cream" : ""}`}
                    title={`Sort by ${col.label.toLowerCase()}`}
                  >
                    {col.label}
                    <span className="ml-1">{col.sort === sort ? (dir === "ASC" ? "▲" : "▼") : ""}</span>
                  </Link>
                ) : (
                  col.label
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bookings.length === 0 && (
            <tr>
              <td colSpan={COLUMNS.length} className="py-6 text-cream/50">
                {emptyMessage}
              </td>
            </tr>
          )}
          {bookings.map((b) => {
            const units = roomUnitSummary(b);
            const arrivalPassed = isArrivalPassed(b, todayKey);
            return (
              <tr
                key={b.id}
                onClick={(e) => handleRowClick(e, b.id)}
                className="border-b border-cream/5 hover:bg-cream/5 cursor-pointer"
              >
                <td className="py-3 pr-4">
                  <Link href={`/admin/bookings/${b.id}`} className="text-cream hover:text-coral transition-colors">
                    {b.guestName}
                  </Link>
                  <p className="text-xs text-cream/40">
                    {b.guestEmail || b.guest?.email || ""}
                    {b.externalReference && <span className="block">SiteMinder {b.externalReference}</span>}
                  </p>
                </td>
                <td className="py-3 pr-4 text-cream/70">{roomTypeSummary(b)}</td>
                <td className="py-3 pr-4">
                  {units ? (
                    <span className="text-cream/70">{units}</span>
                  ) : (
                    <span className="rounded-full px-2.5 py-1 text-xs bg-amber-400/15 text-amber-400">Unassigned</span>
                  )}
                </td>
                <td className="py-3 pr-4 text-cream/70 whitespace-nowrap">{formatDate(b.checkIn)}</td>
                <td className="py-3 pr-4 text-cream/70 whitespace-nowrap">{formatDate(b.checkOut)}</td>
                <td className="py-3 pr-4 text-cream/70">฿{Number(b.totalPrice).toLocaleString("en-US")}</td>
                <td className="py-3 pr-4">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className={`rounded-full px-2.5 py-1 text-xs ${STATUS_STYLES[b.status] ?? ""}`}>{b.status}</span>
                    {arrivalPassed && (
                      // Amber with a dashed outline (shape, not a new colour - the palette is full):
                      // attention, not urgent. A probable no-show nobody has handled yet.
                      <span
                        className="rounded-full px-2.5 py-1 text-xs border border-dashed border-amber-400/60 text-amber-400"
                        title="The arrival date has passed and the guest was never checked in. Check them in or mark a no-show."
                      >
                        Arrival passed
                      </span>
                    )}
                    {folios[b.id] && <RoomChargeDebtBadge roomChargesTotal={folios[b.id].roomChargesTotal} />}
                  </div>
                </td>
                <td className="py-3 pr-4 text-cream/40 text-xs whitespace-nowrap">{formatTimestampDate(b.createdAt)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
