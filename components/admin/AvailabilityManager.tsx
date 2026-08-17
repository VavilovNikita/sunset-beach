"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import PriceCalendar, { type CalendarCell } from "@/components/admin/PriceCalendar";
import { ADMIN_API_URL } from "@/lib/backend";
import type { AvailabilityDay, AvailabilityUnitDay, RoomUnitBlock } from "@/lib/types";

type Room = { id: string; name: string };

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

// Migrated blocks were assigned an arbitrary room and reason by the backend
// migration — staff need to spot and re-verify these rather than trust them
// at face value. Marked purely by this reason-text prefix, per the backend.
const AUTO_MIGRATED_PREFIX = "Auto-migrated from legacy block count";
function isAutoMigrated(reason: string) {
  return reason.startsWith(AUTO_MIGRATED_PREFIX);
}

function monthParam(monthDate: Date) {
  return `${monthDate.getUTCFullYear()}-${String(monthDate.getUTCMonth() + 1).padStart(2, "0")}`;
}

// The backend reports validation failures two different ways: a plain
// `{ error: "..." }` string, or `{ error: { formErrors, fieldErrors } }`
// (Zod's error.flatten()). Collapse both into one readable line instead of
// dumping raw JSON at the manager.
function formatApiError(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object" || !("error" in data)) return fallback;
  const err = (data as { error: unknown }).error;
  if (typeof err === "string") return err;
  if (err && typeof err === "object") {
    const { formErrors, fieldErrors } = err as { formErrors?: string[]; fieldErrors?: Record<string, string[]> };
    const messages = [
      ...(formErrors ?? []),
      ...Object.values(fieldErrors ?? {}).flat(),
    ];
    if (messages.length > 0) return messages.join(" ");
  }
  return fallback;
}

function unitStatusLabel(u: AvailabilityUnitDay) {
  if (u.isBooked) return "Booked";
  if (u.isBlocked) return "Blocked";
  return "Free";
}

// "Booked" and "Blocked" share a first letter, so the unit calendar's
// single-character cells need their own disambiguated code instead of
// unitStatusLabel(u)[0].
function unitStatusCode(u: AvailabilityUnitDay | null) {
  if (!u) return "";
  if (u.isBooked) return "R"; // Reserved
  if (u.isBlocked) return "X";
  return "";
}

// Room-type overview: a month calendar where each day shows how many of
// that type's rooms are still sellable. Deliberately doesn't try to show
// every room's status inline — with a dozen rooms that turns into an
// unreadable month grid. Clicking a day expands the per-room breakdown for
// just that date in the side panel; from there "Manage" drills into
// UnitDetail for one specific room.
function TypeOverview({
  days,
  loading,
  monthDate,
  setMonthDate,
  selectedDate,
  onSelectDate,
  onManageUnit,
}: {
  days: AvailabilityDay[];
  loading: boolean;
  monthDate: Date;
  setMonthDate: (updater: (d: Date) => Date) => void;
  selectedDate: string | null;
  onSelectDate: (date: string) => void;
  onManageUnit: (roomUnitId: string) => void;
}) {
  const daysInMonth = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)).getUTCDate();
  const firstWeekday = monthDate.getUTCDay();
  const selectedDay = days.find((d) => d.date === selectedDate) ?? null;

  const cells: CalendarCell[] = days.map((d) => {
    const total = d.units.length;
    const free = d.units.filter((u) => u.isAvailable).length;
    const flagged = d.units.some((u) => u.isBlocked && u.blockReason && isAutoMigrated(u.blockReason));

    let className = "bg-sea/10 text-cream/70"; // fully open
    if (total > 0 && free <= 0) {
      className = "bg-coraldeep/40 text-cream/70"; // sold out
    } else if (free < total) {
      className = "bg-coral/15 text-cream/80"; // partially reduced
    }
    if (flagged) className += " ring-1 ring-amber-400/70";

    return {
      date: d.date,
      content: (
        <div className="flex flex-col items-center leading-tight">
          <span className="text-[0.65rem] font-medium">
            {total === 0 ? "—" : `${free}/${total}`}
          </span>
          {flagged && <span className="text-[0.5rem] text-amber-400">review</span>}
        </div>
      ),
      className: selectedDate === d.date ? `${className} ring-2 ring-coral` : className,
      onClick: () => onSelectDate(d.date),
    };
  });

  return (
    <div className="grid lg:grid-cols-[1fr_320px] gap-8">
      <div>
        {loading ? (
          <p className="text-sm text-cream/50">Loading…</p>
        ) : (
          <PriceCalendar
            monthLabel={MONTH_FORMAT.format(monthDate)}
            firstWeekday={firstWeekday}
            daysInMonth={daysInMonth}
            cells={cells}
            onPrevMonth={() => setMonthDate((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)))}
            onNextMonth={() => setMonthDate((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)))}
          />
        )}
        <p className="mt-3 text-xs text-cream/40">
          Each day shows free/total rooms of this type. Click a day to see which specific rooms are free, booked, or
          blocked, and to manage a room&rsquo;s blocks. A <span className="text-amber-400">review</span> mark means
          at least one block that day was auto-migrated from the old system and hasn&rsquo;t been checked yet.
        </p>
      </div>

      <div>
        <h2 className="font-display italic text-lg mb-4">
          {selectedDay ? selectedDay.date : "Pick a day"}
        </h2>
        {!selectedDay && <p className="text-sm text-cream/50">Click a day on the calendar to see room-by-room status.</p>}
        {selectedDay && selectedDay.units.length === 0 && (
          <p className="text-sm text-cream/50">This room type has no active rooms yet.</p>
        )}
        {selectedDay && (
          <div className="space-y-2">
            {selectedDay.units.map((u) => {
              const flagged = u.isBlocked && u.blockReason && isAutoMigrated(u.blockReason);
              return (
                <div key={u.roomUnitId} className="bg-ink2/40 border border-cream/10 rounded-xl p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-display">{u.label}</p>
                    <button
                      type="button"
                      onClick={() => onManageUnit(u.roomUnitId)}
                      className="text-xs text-sea hover:text-coral transition-colors shrink-0"
                    >
                      Manage
                    </button>
                  </div>
                  <p
                    className={`text-xs mt-1 ${
                      u.isBooked ? "text-coral" : u.isBlocked ? (flagged ? "text-amber-400" : "text-cream/60") : "text-sea"
                    }`}
                  >
                    {unitStatusLabel(u)}
                    {u.isBlocked && u.blockReason && ` — ${u.blockReason}`}
                    {u.isBooked && u.bookingId && (
                      <>
                        {" — "}
                        <Link href={`/admin/bookings/${u.bookingId}`} className="underline hover:text-cream">
                          view booking
                        </Link>
                      </>
                    )}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// Single-room drill-down: its own month calendar (booked/blocked/free) plus
// the list of manual blocks behind that, with a form to add a new one and a
// delete action on each — the actual surface for fixing an auto-migrated
// block (delete the wrong one, add a correct one).
function UnitDetail({
  roomUnitId,
  label,
  days,
  loading,
  monthDate,
  setMonthDate,
  canManage,
  onBack,
  onChanged,
}: {
  roomUnitId: string;
  label: string;
  days: AvailabilityDay[];
  loading: boolean;
  monthDate: Date;
  setMonthDate: (updater: (d: Date) => Date) => void;
  canManage: boolean;
  onBack: () => void;
  onChanged: () => void;
}) {
  const [blocks, setBlocks] = useState<RoomUnitBlock[]>([]);
  const [blocksLoading, setBlocksLoading] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // GET .../blocks is MANAGER+, same as GET /room-units — a lower role
  // that can still see day-by-day status via `days` (unrestricted) has no
  // access to the raw block list, so don't even attempt the fetch for them.
  function refetchBlocks() {
    if (!canManage) return Promise.resolve();
    setBlocksLoading(true);
    return fetch(`${ADMIN_API_URL}/room-units/${roomUnitId}/blocks`, { credentials: "include" })
      .then((res) => res.json())
      .then((data) => setBlocks(Array.isArray(data) ? data : []))
      .finally(() => setBlocksLoading(false));
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

    const res = await fetch(`${ADMIN_API_URL}/room-units/${roomUnitId}/blocks`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fromDate: from, toDate: to, reason: reason.trim() }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(formatApiError(data, "Could not add block."));
      return;
    }
    setFrom("");
    setTo("");
    setReason("");
    await refetchBlocks();
    onChanged();
  }

  async function handleDeleteBlock(id: string) {
    if (!window.confirm("Remove this block? The room becomes bookable for those dates again.")) return;
    setError(null);

    const res = await fetch(`${ADMIN_API_URL}/room-units/${roomUnitId}/blocks/${id}`, {
      method: "DELETE",
      credentials: "include",
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(formatApiError(data, "Could not remove block."));
      return;
    }
    await refetchBlocks();
    onChanged();
  }

  const unitDays = days.map((d) => d.units.find((u) => u.roomUnitId === roomUnitId) ?? null);
  const daysInMonth = new Date(Date.UTC(monthDate.getUTCFullYear(), monthDate.getUTCMonth() + 1, 0)).getUTCDate();
  const firstWeekday = monthDate.getUTCDay();

  const cells: CalendarCell[] = days.map((d, i) => {
    const u = unitDays[i];
    let className = "bg-sea/10 text-cream/70"; // free
    if (u?.isBooked) className = "bg-coraldeep/40 text-cream/70";
    else if (u?.isBlocked) className = "bg-coral/15 text-cream/80";
    const flagged = !!u?.isBlocked && !!u.blockReason && isAutoMigrated(u.blockReason);
    if (flagged) className += " ring-1 ring-amber-400/70";

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
          {loading ? (
            <p className="text-sm text-cream/50">Loading…</p>
          ) : (
            <PriceCalendar
              monthLabel={MONTH_FORMAT.format(monthDate)}
              firstWeekday={firstWeekday}
              daysInMonth={daysInMonth}
              cells={cells}
              onPrevMonth={() => setMonthDate((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)))}
              onNextMonth={() => setMonthDate((d) => new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1)))}
            />
          )}
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

          <div>
            <h3 className="font-display italic mb-3">Blocks</h3>
            {!canManage ? (
              <p className="text-sm text-cream/50">
                Only managers can view or edit the block list. Blocked days for this room still show on the calendar
                above.
              </p>
            ) : blocksLoading ? (
              <p className="text-sm text-cream/50">Loading…</p>
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
                          {b.fromDate} → {b.toDate}
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

export default function AvailabilityManager({ rooms, canManage }: { rooms: Room[]; canManage: boolean }) {
  const [roomId, setRoomId] = useState(rooms[0]?.id ?? "");
  const [monthDate, setMonthDate] = useState(() => {
    const now = new Date();
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  });
  const [days, setDays] = useState<AvailabilityDay[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);

  function refetch() {
    if (!roomId) return Promise.resolve();
    return fetch(`${ADMIN_API_URL}/availability/${roomId}?month=${monthParam(monthDate)}`, {
      credentials: "include",
    })
      .then((res) => res.json())
      .then((data) => setDays(data.days ?? []));
  }

  useEffect(() => {
    if (!roomId) return;
    setLoading(true);
    refetch().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId, monthDate]);

  const selectedUnitLabel =
    selectedUnitId != null ? days.flatMap((d) => d.units).find((u) => u.roomUnitId === selectedUnitId)?.label ?? "" : "";

  return (
    <div>
      <div className="mb-6">
        <label className="eyebrow text-cream/60 block mb-1">Room type</label>
        <select
          value={roomId}
          onChange={(e) => {
            setRoomId(e.target.value);
            setSelectedDate(null);
            setSelectedUnitId(null);
          }}
          className="bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
        >
          {rooms.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>
      </div>

      {selectedUnitId ? (
        <UnitDetail
          roomUnitId={selectedUnitId}
          label={selectedUnitLabel}
          days={days}
          loading={loading}
          monthDate={monthDate}
          setMonthDate={setMonthDate}
          canManage={canManage}
          onBack={() => setSelectedUnitId(null)}
          onChanged={refetch}
        />
      ) : (
        <TypeOverview
          days={days}
          loading={loading}
          monthDate={monthDate}
          setMonthDate={setMonthDate}
          selectedDate={selectedDate}
          onSelectDate={setSelectedDate}
          onManageUnit={setSelectedUnitId}
        />
      )}
    </div>
  );
}
