"use client";

import { bookingStatusLabel } from "@/lib/bookingStatusLabel";

import { useEffect, useState } from "react";
import Link from "next/link";
import PriceCalendar, { type CalendarCell } from "@/components/admin/PriceCalendar";
import { createRoomUnitBlock, deleteRoomUnitBlock, listRoomUnitBlocks } from "@/lib/roomUnitBlockClient";
import { isAutoMigrated, weekdayOf } from "@/lib/ratesGrid";
import type { AvailabilityDay, AvailabilityUnitDay, BlockResponsibleFunction, RoomUnitBlock, RoomUnitBlockResult } from "@/lib/types";
import { formatDate, formatDateRange } from "@/lib/formatDate";
import { hotelDateKey } from "@/lib/hotelDate";
import ConfirmActionDialog from "@/components/admin/ConfirmActionDialog";
import BlockFunctionSelect from "@/components/admin/BlockFunctionSelect";
import { blockFunctionLabel } from "@/lib/notifications";

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

// "Booked" and "Blocked" share a first letter, so the unit calendar's single-character cells need
// their own disambiguated code. A night can be both (a block laid over a booking that was already
// there - RoomUnitService#createBlock allows it and warns), and then both facts are shown.
function unitStatusCode(u: AvailabilityUnitDay | null) {
  if (!u) return "";
  if (u.isBooked && u.isBlocked) return "R X";
  if (u.isBooked) return "R"; // Reserved
  if (u.isBlocked) return "X";
  return "";
}

// Colours follow the app's meanings (CLAUDE.md, "Colour meanings"): sea = free, coral = a blocked
// room, neutral = occupied without a problem. A block over a booking is the one night that is both,
// so it keeps the booking's neutral fill and carries the block as coral hatching - a shape, since
// the palette has no colour left for it. The legend below the calendar draws these same swatches.
const BLOCK_HATCH =
  "repeating-linear-gradient(-45deg, rgba(226,97,47,0.75), rgba(226,97,47,0.75) 3px, transparent 3px, transparent 7px)";

function cellAppearance(u: AvailabilityUnitDay | null): { className: string; style?: React.CSSProperties } {
  if (u?.isBooked && u.isBlocked) return { className: "bg-cream/15 text-cream/90", style: { backgroundImage: BLOCK_HATCH } };
  if (u?.isBooked) return { className: "bg-cream/15 text-cream/80" };
  if (u?.isBlocked) return { className: "bg-coral/30 text-cream/90" };
  return { className: "bg-sea/15 text-cream/70" };
}

function CalendarLegend() {
  const swatch = "inline-block w-4 h-4 rounded align-middle mr-1.5";
  return (
    <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-xs text-cream/60">
      <li>
        <span className={`${swatch} bg-sea/15`} />
        Free
      </li>
      <li>
        <span className={`${swatch} bg-cream/15`} />
        Booked (R)
      </li>
      <li>
        <span className={`${swatch} bg-coral/30`} />
        Blocked (X)
      </li>
      <li>
        <span className={`${swatch} bg-cream/15`} style={{ backgroundImage: BLOCK_HATCH }} />
        Blocked over a booking (R X)
      </li>
      <li>
        <span className={`${swatch} bg-coral/30 ring-1 ring-amber-400/70`} />
        Block from the old data move - needs review
      </li>
    </ul>
  );
}

// Single-room drill-down of the Rates & availability grid (moved here unchanged from the old
// /admin/availability screen): its own month calendar (booked/blocked/free) plus the list of manual
// blocks behind that, with a form to add a new one and a delete action on each - the actual surface
// for fixing an auto-migrated block (delete the wrong one, add a correct one).
export default function RoomUnitBlocksPanel({
  roomUnitId,
  initialDate,
  label,
  month,
  days,
  canManage,
  onBack,
  onMonthChange,
  onChanged,
}: {
  roomUnitId: string;
  // The day picked in the grid before "Manage" - the block form opens on it (today when absent).
  initialDate?: string;
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
  // A block opens on the day that was selected in the grid (today when none), one night - the usual
  // case (a room that broke that day) - and the form goes back to that after each block. Both dates
  // are inclusive, like the block itself.
  const defaultDay = () => initialDate ?? hotelDateKey(new Date());
  const [from, setFrom] = useState(defaultDay);
  const [to, setTo] = useState(defaultDay);
  const [reason, setReason] = useState("");
  // Engineer unless the block is for housekeeping - the server defaults to it as well.
  const [responsibleFunction, setResponsibleFunction] = useState<BlockResponsibleFunction>("ENGINEER");
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

    const result = await createRoomUnitBlock(roomUnitId, { fromDate: from, toDate: to, reason: reason.trim(), responsibleFunction });

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    // The block is already created at this point - this is a warning after the fact, not a
    // confirmation to ask before creating it.
    if (result.result.warning) setBlockWarning(result.result);
    setFrom(defaultDay());
    setTo(defaultDay());
    setReason("");
    setResponsibleFunction("ENGINEER");
    await refetchBlocks();
    onChanged();
  }

  const [removingBlockId, setRemovingBlockId] = useState<string | null>(null);

  async function handleDeleteBlock(id: string): Promise<string | null> {
    setError(null);

    const result = await deleteRoomUnitBlock(roomUnitId, id);

    if (!result.ok) return result.error;
    await refetchBlocks();
    onChanged();
    return null;
  }

  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const firstWeekday = weekdayOf(`${month}-01`);

  const cells: CalendarCell[] = days.map((d) => {
    const u = d.units.find((x) => x.roomUnitId === roomUnitId) ?? null;
    const { className: baseClass, style } = cellAppearance(u);
    let className = baseClass;
    if (u?.isBlocked && isAutoMigrated(u.blockReason)) className += " ring-1 ring-amber-400/70";

    return {
      date: d.date,
      content: <span className="text-[0.6rem]">{unitStatusCode(u)}</span>,
      className,
      style,
      title: u?.isBlocked && u.blockReason ? `${u.isBooked ? "Booked; blocked: " : "Blocked: "}${u.blockReason}` : undefined,
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
          <CalendarLegend />
          {canManage && <p className="mt-2 text-xs text-cream/40">Click a free or blocked day to load it into the form.</p>}
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
                  onChange={(e) => {
                    setFrom(e.target.value);
                    // A "To" before the new "From" can only be a mistake; carry it along.
                    if (e.target.value && to < e.target.value) setTo(e.target.value);
                  }}
                  className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
                />
              </div>
              <div>
                <label className="eyebrow text-cream/60 block mb-1">To</label>
                <input
                  type="date"
                  value={to}
                  min={from || undefined}
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
              <BlockFunctionSelect id="block-function" value={responsibleFunction} onChange={setResponsibleFunction} disabled={saving} />

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
                        {formatDateRange(b.checkIn, b.checkOut)} · {bookingStatusLabel(b.status)}
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
                        {formatDateRange(b.checkIn, b.checkOut)} · {bookingStatusLabel(b.status)}
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
                          onClick={() => setRemovingBlockId(b.id)}
                          className="text-xs text-cream/50 hover:text-coral transition-colors shrink-0"
                        >
                          Delete
                        </button>
                      </div>
                      <p className={`text-xs mt-1 ${flagged ? "text-amber-400" : "text-cream/50"}`}>
                        {flagged && "⚠ Needs review — "}
                        {b.reason}
                      </p>
                      <p className="text-xs mt-1 text-cream/40">Closes it: {blockFunctionLabel(b.responsibleFunction)}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
      {removingBlockId && (
        <ConfirmActionDialog
          eyebrow="Block"
          title="Remove this block?"
          confirmLabel="Remove block"
          busyLabel="Removing…"
          action={() => handleDeleteBlock(removingBlockId)}
          onDone={() => setRemovingBlockId(null)}
          onBack={() => setRemovingBlockId(null)}
        >
          <p className="text-sm text-cream/60">The room becomes bookable for those dates again.</p>
        </ConfirmActionDialog>
      )}
    </div>
  );
}
