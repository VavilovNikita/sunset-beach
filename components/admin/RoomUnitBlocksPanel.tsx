"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PriceCalendar, { type CalendarCell } from "@/components/admin/PriceCalendar";
import { createRoomUnitBlock, deleteRoomUnitBlock, listRoomUnitBlocks } from "@/lib/roomUnitBlockClient";
import { isAutoMigrated, weekdayOf } from "@/lib/ratesGrid";
import type { AvailabilityDay, AvailabilityUnitDay, RoomUnitBlock, RoomUnitBlockResult } from "@/lib/types";
import { formatDate, formatDateRange } from "@/lib/formatDate";

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

// "Booked" and "Blocked" share a first letter, so the unit calendar's single-character cells need
// their own disambiguated code.
function unitStatusCode(u: AvailabilityUnitDay | null) {
  if (!u) return "";
  if (u.isBooked) return "R"; // Reserved
  if (u.isBlocked) return "X";
  return "";
}

// Single-room drill-down of the Rates & availability grid (moved here unchanged from the old
// /admin/availability screen): its own month calendar (booked/blocked/free) plus the list of manual
// blocks behind that, with a form to add a new one and a delete action on each - the actual surface
// for fixing an auto-migrated block (delete the wrong one, add a correct one).
export default function RoomUnitBlocksPanel({
  roomUnitId,
  label,
  month,
  days,
  canManage,
  onBack,
  onMonthChange,
  onChanged,
}: {
  roomUnitId: string;
  label: string;
  month: string; // YYYY-MM, the grid's month
  days: AvailabilityDay[]; // this unit's room type, that month
  canManage: boolean;
  onBack: () => void;
  onMonthChange: (delta: number) => void;
  onChanged: () => void;
}) {
  const [blocks, setBlocks] = useState<RoomUnitBlock[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [blocksError, setBlocksError] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Set only when the block just created overlaps a booking - cleared by the manager dismissing it,
  // or by this whole panel closing. Not a toast: it names every affected booking, which the manager
  // needs while they work through relocating each one.
  const [blockWarning, setBlockWarning] = useState<RoomUnitBlockResult | null>(null);

  // GET .../blocks is MANAGER+, same as GET /room-units - a lower role still sees day-by-day status
  // via `days`, so don't even attempt the fetch for them.
  async function refetchBlocks() {
    if (!canManage) return;
    setBlocksLoading(true);
    const result = await listRoomUnitBlocks(roomUnitId);
    setBlocksLoading(false);
    if (result.ok) {
      setBlocks(result.blocks);
      setBlocksError(null);
    } else {
      setBlocksError(result.error);
    }
  }

  useEffect(() => {
    refetchBlocks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomUnitId, canManage]);

  async function handleAddBlock(e: React.FormEvent) {
    e.preventDefault();
    if (!from || !to || !reason.trim()) return;
    setSaving(true);
    setError(null);
    setBlockWarning(null);

    const result = await createRoomUnitBlock(roomUnitId, { fromDate: from, toDate: to, reason: reason.trim() });

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    // The block is already created at this point - this is a warning after the fact, not a
    // confirmation to ask before creating it.
    if (result.result.warning) setBlockWarning(result.result);
    setFrom("");
    setTo("");
    setReason("");
    await refetchBlocks();
    onChanged();
  }

  async function handleDeleteBlock(id: string) {
    if (!window.confirm("Remove this block? The room becomes bookable for those dates again.")) return;
    setError(null);

    const result = await deleteRoomUnitBlock(roomUnitId, id);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    await refetchBlocks();
    onChanged();
  }

  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const firstWeekday = weekdayOf(`${month}-01`);

  const cells: CalendarCell[] = days.map((d) => {
    const u = d.units.find((x) => x.roomUnitId === roomUnitId) ?? null;
    let className = "bg-sea/10 text-cream/70"; // free
    if (u?.isBooked) className = "bg-coraldeep/40 text-cream/70";
    else if (u?.isBlocked) className = "bg-coral/15 text-cream/80";
    if (u?.isBlocked && isAutoMigrated(u.blockReason)) className += " ring-1 ring-amber-400/70";

    return {
      date: d.date,
      content: <span className="text-[0.6rem]">{unitStatusCode(u)}</span>,
      className,
      onClick: () => {
        if (!canManage) return;
        setFrom(d.date);
        setTo(d.date);
        setError(null);
      },
    };
  });

  return (
    <div>
      <button type="button" onClick={onBack} className="text-sm text-cream/60 hover:text-cream transition-colors mb-4">
        ← Back to overview
      </button>
      <h2 className="font-display italic text-xl mb-4">Room {label}</h2>

      <div className="grid lg:grid-cols-[1fr_360px] gap-8">
        <div>
          <PriceCalendar
            monthLabel={MONTH_FORMAT.format(new Date(Date.UTC(y, m - 1, 1)))}
            firstWeekday={firstWeekday}
            daysInMonth={daysInMonth}
            cells={cells}
            onPrevMonth={() => onMonthChange(-1)}
            onNextMonth={() => onMonthChange(1)}
          />
          <p className="mt-3 text-xs text-cream/40">
            Sea = free, coral = blocked, dark = booked. {canManage && "Click a free or blocked day to load it into the form."}
          </p>
        </div>

        <div className="space-y-6">
          {canManage && (
            <form onSubmit={handleAddBlock} className="space-y-4 bg-ink2/40 border border-cream/10 rounded-xl p-5">
              <h3 className="font-display italic">Add block</h3>
              <div>
                <label className="eyebrow text-cream/60 block mb-1">From</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
                />
              </div>
              <div>
                <label className="eyebrow text-cream/60 block mb-1">To</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
                />
              </div>
              <div>
                <label className="eyebrow text-cream/60 block mb-1">Reason</label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="e.g. maintenance, deep clean"
                  className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm placeholder:text-cream/30 focus:outline-none focus:border-coral"
                />
              </div>

              {error && <p className="text-sm text-coral">{error}</p>}

              <button
                type="submit"
                disabled={saving || !from || !to || !reason.trim()}
                className="w-full rounded-full bg-coral hover:bg-coraldeep transition-colors py-2.5 text-sm font-medium disabled:opacity-60"
              >
                {saving ? "Saving…" : "Add block"}
              </button>
            </form>
          )}

          {blockWarning && (
            <div className="bg-amber-400/10 border border-amber-400/40 rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm text-amber-400">{blockWarning.warning}</p>
                <button
                  type="button"
                  onClick={() => setBlockWarning(null)}
                  className="text-xs text-cream/50 hover:text-cream transition-colors shrink-0"
                >
                  Dismiss
                </button>
              </div>
              {blockWarning.affectedBookings.length > 0 && (
                <div className="space-y-2">
                  <p className="eyebrow text-cream/40">In this room</p>
                  {blockWarning.affectedBookings.map((b) => (
                    <Link
                      key={b.bookingId}
                      href={`/admin/bookings/${b.bookingId}`}
                      className="block bg-ink2/40 border border-cream/10 rounded-lg p-2.5 hover:border-amber-400/40 transition-colors"
                    >
                      <p className="text-sm text-cream/80">{b.guestName}</p>
                      <p className="text-xs text-cream/50 mt-0.5">
                        {formatDateRange(b.checkIn, b.checkOut)} · {b.status}
                      </p>
                    </Link>
                  ))}
                </div>
              )}

              {blockWarning.affectedUnassignedBookings.length > 0 && (
                <div className="space-y-2">
                  {/* Distinct from "in this room" above: not tied to this specific unit, but
                      booked into its room type with no unit assigned yet - one fewer unit in the
                      pool may leave too few for them. The manager's next move differs (reassign
                      a different unit vs. relocate this exact guest), so the two stay separate. */}
                  <p className="eyebrow text-cream/40">Unassigned, same room type</p>
                  {blockWarning.affectedUnassignedBookings.map((b) => (
                    <Link
                      key={b.bookingId}
                      href={`/admin/bookings/${b.bookingId}`}
                      className="block bg-ink2/40 border border-cream/10 rounded-lg p-2.5 hover:border-amber-400/40 transition-colors"
                    >
                      <p className="text-sm text-cream/80">{b.guestName}</p>
                      <p className="text-xs text-cream/50 mt-0.5">
                        {formatDateRange(b.checkIn, b.checkOut)} · {b.status}
                      </p>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}

          <div>
            <h3 className="font-display italic mb-3">Blocks</h3>
            {!canManage ? (
              <p className="text-sm text-cream/50">
                Only managers can view or edit the block list. Blocked days for this room still show on the calendar
                above.
              </p>
            ) : blocksLoading ? (
              <p className="text-sm text-cream/50">Loading…</p>
            ) : blocksError ? (
              <p className="text-sm text-coral">{blocksError}</p>
            ) : blocks.length === 0 ? (
              <p className="text-sm text-cream/50">No manual blocks on this room.</p>
            ) : (
              <div className="space-y-2">
                {blocks.map((b) => {
                  const flagged = isAutoMigrated(b.reason);
                  return (
                    <div
                      key={b.id}
                      className={`bg-ink2/40 border rounded-xl p-3 ${flagged ? "border-amber-400/50" : "border-cream/10"}`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm text-cream/80">
                          {formatDate(b.fromDate)} → {formatDate(b.toDate)}
                        </p>
                        <button
                          type="button"
                          onClick={() => handleDeleteBlock(b.id)}
                          className="text-xs text-cream/50 hover:text-coral transition-colors shrink-0"
                        >
                          Delete
                        </button>
                      </div>
                      <p className={`text-xs mt-1 ${flagged ? "text-amber-400" : "text-cream/50"}`}>
                        {flagged && "⚠ Needs review — "}
                        {b.reason}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
