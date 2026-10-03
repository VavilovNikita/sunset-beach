"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import RoomUnitBlocksPanel from "@/components/admin/RoomUnitBlocksPanel";
import { fetchAvailability } from "@/lib/availabilityClient";
import { fetchPricing, setPriceRange } from "@/lib/pricingClient";
import {
  availabilityTone,
  buildRateCells,
  isAutoMigrated,
  monthDateKeys,
  parsePriceInput,
  shiftMonth,
  validatePriceRange,
  weekdayOf,
  type AvailabilityTone,
  type RateCell,
  type RatesView,
} from "@/lib/ratesGrid";
import type { AvailabilityDay, PricingResponse } from "@/lib/types";
import { formatDate } from "@/lib/formatDate";

type Room = { id: string; name: string };

// One room type's month, as two independent server reads. Either can fail on its own; the row then
// says so and shows "—" for that half, never a fallback number.
type RowData = {
  pricing: PricingResponse | null;
  pricingError: string | null;
  availability: AvailabilityDay[] | null;
  availabilityError: string | null;
};

type Editing = { roomId: string; date: string; value: string; saving: boolean; error: string | null };

const MONTH_FORMAT = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const WEEKDAY_LETTER = ["S", "M", "T", "W", "T", "F", "S"];
const DAY_COL_PX = 64;
const LABEL_COL_PX = 168;

function formatBaht(n: number) {
  return `฿${n.toLocaleString("en-US")}`;
}

function toneClass(tone: AvailabilityTone) {
  switch (tone) {
    case "oversold":
      return "bg-coral text-cream font-semibold";
    case "soldOut":
      return "text-cream/30";
    case "partial":
      return "text-sea/80";
    case "open":
      return "text-sea";
    default:
      return "text-cream/30";
  }
}

async function loadRow(roomId: string, month: string): Promise<RowData> {
  const [p, a] = await Promise.all([fetchPricing(roomId, month), fetchAvailability(roomId, month)]);
  return {
    pricing: p.ok ? p.pricing : null,
    pricingError: p.ok ? null : p.error,
    availability: a.ok ? a.days : null,
    availabilityError: a.ok ? null : a.error,
  };
}

// Rates & availability: one table, room type x date, for a month. Every cell carries both the price
// for that night (GET /pricing/{roomId}) and how many rooms of the type are left
// (GET /availability/{roomId}'s availableCount - the same server figure as the booking calendar's
// per-type row). The Rates / Availability tabs only change which of the two leads and what a click
// on a cell does: in Rates a manager edits that night's price in place; in Availability anyone sees
// the room-by-room breakdown for that day and can drill into one room's blocks. Replaces the
// separate /admin/pricing and /admin/availability screens, which both redirect here.
export default function RatesAvailabilityGrid({
  rooms,
  canManage,
  month,
  view,
  todayKey,
}: {
  rooms: Room[];
  canManage: boolean;
  month: string;
  view: RatesView;
  todayKey: string;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Record<string, RowData>>({});
  const [loading, setLoading] = useState(true);
  const [roomFilter, setRoomFilter] = useState<string>("");
  const [editing, setEditing] = useState<Editing | null>(null);
  const [selectedDay, setSelectedDay] = useState<{ roomId: string; date: string } | null>(null);
  const [selectedUnit, setSelectedUnit] = useState<{ roomId: string; roomUnitId: string } | null>(null);
  // Guards against an older month's responses landing after a newer month was requested.
  const requestedMonth = useRef(month);

  const dates = monthDateKeys(month);
  const visibleRooms = roomFilter ? rooms.filter((r) => r.id === roomFilter) : rooms;

  // Keyed on the room ids, not the `rooms` array: the server page hands over a fresh array on every
  // navigation, and switching the Rates/Availability tab must not reload the whole month.
  const roomKey = rooms.map((r) => r.id).join(",");
  useEffect(() => {
    requestedMonth.current = month;
    setLoading(true);
    setEditing(null);
    setSelectedDay(null);
    Promise.all(rooms.map(async (r) => [r.id, await loadRow(r.id, month)] as const)).then((entries) => {
      if (requestedMonth.current !== month) return;
      setRows(Object.fromEntries(entries));
      setLoading(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, roomKey]);

  async function refetchRoom(roomId: string) {
    const row = await loadRow(roomId, month);
    if (requestedMonth.current !== month) return;
    setRows((prev) => ({ ...prev, [roomId]: row }));
  }

  function navigate(next: { month?: string; view?: RatesView }) {
    const params = new URLSearchParams({ month: next.month ?? month, view: next.view ?? view });
    router.push(`/admin/rates?${params.toString()}`);
  }

  async function saveInlinePrice() {
    if (!editing) return;
    const price = parsePriceInput(editing.value);
    if (price === null) {
      setEditing({ ...editing, error: "Enter a price above 0." });
      return;
    }
    setEditing({ ...editing, saving: true, error: null });
    const result = await setPriceRange(editing.roomId, editing.date, editing.date, price);
    if (!result.ok) {
      setEditing((e) => (e ? { ...e, saving: false, error: result.error } : e));
      return;
    }
    const roomId = editing.roomId;
    setEditing(null);
    // Show what the server now says for that night, not the number that was typed.
    await refetchRoom(roomId);
  }

  function onCellClick(roomId: string, cell: RateCell) {
    if (view === "rates") {
      if (!canManage || cell.price === null) return;
      if (editing?.saving) return;
      setEditing({ roomId, date: cell.date, value: String(cell.price), saving: false, error: null });
    } else {
      setSelectedUnit(null);
      setSelectedDay({ roomId, date: cell.date });
    }
  }

  const selectedRoom = selectedDay ? rooms.find((r) => r.id === selectedDay.roomId) ?? null : null;
  const selectedDayData =
    selectedDay && rows[selectedDay.roomId]?.availability
      ? rows[selectedDay.roomId].availability!.find((d) => d.date === selectedDay.date) ?? null
      : null;
  const unitRoomDays = selectedUnit ? rows[selectedUnit.roomId]?.availability ?? [] : [];
  const unitLabel = selectedUnit
    ? unitRoomDays.flatMap((d) => d.units).find((u) => u.roomUnitId === selectedUnit.roomUnitId)?.label ?? ""
    : "";

  return (
    <div>
      <div className="flex flex-wrap items-end gap-x-6 gap-y-4 mb-5">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => navigate({ month: shiftMonth(month, -1) })}
            className="text-sm text-cream/60 hover:text-cream px-2 py-1"
          >
            ← Prev
          </button>
          <p className="font-display italic text-lg min-w-[10rem] text-center">
            {MONTH_FORMAT.format(new Date(`${month}-01T00:00:00Z`))}
          </p>
          <button
            type="button"
            onClick={() => navigate({ month: shiftMonth(month, 1) })}
            className="text-sm text-cream/60 hover:text-cream px-2 py-1"
          >
            Next →
          </button>
          {month !== todayKey.slice(0, 7) && (
            <button
              type="button"
              onClick={() => navigate({ month: todayKey.slice(0, 7) })}
              className="text-xs text-sea hover:text-coral ml-2"
            >
              This month
            </button>
          )}
        </div>

        <div role="tablist" className="flex rounded-full border border-cream/20 p-0.5 text-sm">
          {(["rates", "availability"] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => {
                setEditing(null);
                navigate({ view: v });
              }}
              className={`px-4 py-1.5 rounded-full transition-colors ${
                view === v ? "bg-cream/15 text-cream" : "text-cream/50 hover:text-cream"
              }`}
            >
              {v === "rates" ? "Rates" : "Availability"}
            </button>
          ))}
        </div>

        <div>
          <label className="eyebrow text-cream/60 block mb-1">Room type</label>
          <select
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value)}
            className="bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All room types</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <Link href="/admin/bookings/calendar" className="text-xs text-cream/50 hover:text-cream ml-auto">
          Bookings by room → Calendar
        </Link>
      </div>

      <div className="overflow-x-auto border border-cream/10 rounded-xl">
        <table className="border-collapse text-xs" style={{ minWidth: LABEL_COL_PX + dates.length * DAY_COL_PX }}>
          <thead>
            <tr className="border-b border-cream/10">
              <th
                className="sticky left-0 z-20 bg-ink2 text-left px-3 py-2 font-normal eyebrow text-cream/40"
                style={{ width: LABEL_COL_PX, minWidth: LABEL_COL_PX }}
              >
                Room type
              </th>
              {dates.map((d) => {
                const wd = weekdayOf(d);
                const isToday = d === todayKey;
                const weekend = wd === 0 || wd === 6;
                return (
                  <th
                    key={d}
                    className={`font-normal py-1.5 ${weekend ? "bg-cream/[0.04]" : ""} ${isToday ? "text-cream" : "text-cream/50"}`}
                    style={{ width: DAY_COL_PX, minWidth: DAY_COL_PX }}
                  >
                    <span className="block text-[0.6rem] text-cream/35">{WEEKDAY_LETTER[wd]}</span>
                    <span className={isToday ? "font-semibold border-b border-coral" : ""}>{Number(d.slice(8))}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visibleRooms.map((room) => {
              const row = rows[room.id];
              const cells = buildRateCells(dates, row?.pricing?.days ?? null, row?.availability ?? null);
              return (
                <tr key={room.id} className="border-b border-cream/10 last:border-b-0">
                  <th
                    scope="row"
                    className="sticky left-0 z-10 bg-ink2 text-left px-3 py-2 font-normal align-top"
                    style={{ width: LABEL_COL_PX, minWidth: LABEL_COL_PX }}
                  >
                    <p className="text-sm text-cream truncate" title={room.name}>
                      {room.name}
                    </p>
                    {row?.pricing && (
                      <p className="text-[0.65rem] text-cream/40">Base {formatBaht(row.pricing.basePrice)}</p>
                    )}
                    {row?.pricingError && <p className="text-[0.65rem] text-coral">Prices: {row.pricingError}</p>}
                    {row?.availabilityError && (
                      <p className="text-[0.65rem] text-coral">Rooms left: {row.availabilityError}</p>
                    )}
                  </th>
                  {cells.map((cell) => (
                    <RateCellView
                      key={cell.date}
                      cell={cell}
                      view={view}
                      loading={loading}
                      clickable={view === "availability" ? cell.available !== null : canManage && cell.price !== null}
                      selected={view === "availability" && selectedDay?.roomId === room.id && selectedDay.date === cell.date}
                      editing={editing && editing.roomId === room.id && editing.date === cell.date ? editing : null}
                      onClick={() => onCellClick(room.id, cell)}
                      onEditChange={(value) => setEditing((e) => (e ? { ...e, value, error: null } : e))}
                      onEditSave={saveInlinePrice}
                      onEditCancel={() => setEditing(null)}
                    />
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <p className="mt-3 text-xs text-cream/40">
        {view === "rates" ? (
          <>
            Coral = manually set price. Otherwise showing the room&rsquo;s base price. The small number is rooms of that
            type still free that night.{canManage && " Click a price to change that night; Enter saves, Esc cancels."}
          </>
        ) : (
          <>
            Each day shows free/total rooms of this type
            {" "}(a booking without a room assigned still takes one). Click a day to see which specific rooms are free,
            booked, or blocked, and to manage a room&rsquo;s blocks. A <span className="text-amber-400">review</span>{" "}
            mark means at least one block that day was auto-migrated from the old system and hasn&rsquo;t been checked
            yet. A <span className="text-coral">coral</span> number means more stays and blocks than rooms (oversold).
          </>
        )}
      </p>

      <div className="mt-8">
        {view === "rates" ? (
          <PriceRangeForm
            rooms={rooms}
            defaultRoomId={roomFilter || rooms[0]?.id || ""}
            canManage={canManage}
            onSaved={refetchRoom}
          />
        ) : selectedUnit ? (
          <RoomUnitBlocksPanel
            key={selectedUnit.roomUnitId}
            roomUnitId={selectedUnit.roomUnitId}
            label={unitLabel}
            month={month}
            days={unitRoomDays}
            canManage={canManage}
            onBack={() => setSelectedUnit(null)}
            onMonthChange={(delta) => navigate({ month: shiftMonth(month, delta) })}
            onChanged={() => refetchRoom(selectedUnit.roomId)}
          />
        ) : (
          <DayBreakdown
            roomName={selectedRoom?.name ?? null}
            date={selectedDay?.date ?? null}
            day={selectedDayData}
            onManageUnit={(roomUnitId) => selectedDay && setSelectedUnit({ roomId: selectedDay.roomId, roomUnitId })}
          />
        )}
      </div>
    </div>
  );
}

function RateCellView({
  cell,
  view,
  loading,
  clickable,
  selected,
  editing,
  onClick,
  onEditChange,
  onEditSave,
  onEditCancel,
}: {
  cell: RateCell;
  view: RatesView;
  loading: boolean;
  clickable: boolean;
  selected: boolean;
  editing: Editing | null;
  onClick: () => void;
  onEditChange: (value: string) => void;
  onEditSave: () => void;
  onEditCancel: () => void;
}) {
  const weekend = [0, 6].includes(weekdayOf(cell.date));
  const tone = availabilityTone(cell.available, cell.total);
  const priceText = cell.price === null ? "—" : formatBaht(cell.price);
  const availText = cell.available === null ? "—" : view === "availability" ? `${cell.available}/${cell.total}` : `${cell.available} left`;

  if (editing) {
    return (
      <td className="relative p-0.5 align-middle" style={{ width: DAY_COL_PX }}>
        <input
          autoFocus
          inputMode="decimal"
          value={editing.value}
          disabled={editing.saving}
          onChange={(e) => onEditChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onEditSave();
            if (e.key === "Escape") onEditCancel();
          }}
          aria-label={`Price for ${cell.date}`}
          className={`w-full bg-ink border rounded px-1 py-1.5 text-center text-xs text-cream focus:outline-none ${
            editing.error ? "border-coral" : "border-sea"
          }`}
        />
        {editing.error && (
          <div className="absolute left-0 top-full z-30 mt-1 w-48 rounded-lg border border-coral/40 bg-ink2 p-2 text-[0.7rem] text-coral shadow-lg">
            {editing.error}
            <button type="button" onClick={onEditCancel} className="block mt-1 text-cream/50 hover:text-cream">
              Cancel
            </button>
          </div>
        )}
      </td>
    );
  }

  const lead =
    view === "rates" ? (
      <span className={`block ${cell.isOverride ? "text-coral font-medium" : "text-cream/70"}`}>{priceText}</span>
    ) : (
      <span className={`inline-block rounded px-1 ${toneClass(tone)}`}>{availText}</span>
    );
  const secondary =
    view === "rates" ? (
      <span className={`inline-block rounded px-1 text-[0.6rem] ${toneClass(tone)}`}>{availText}</span>
    ) : (
      <span className={`block text-[0.6rem] ${cell.isOverride ? "text-coral/80" : "text-cream/40"}`}>{priceText}</span>
    );

  return (
    <td
      className={`p-0 align-middle text-center ${weekend ? "bg-cream/[0.04]" : ""} ${selected ? "ring-2 ring-inset ring-coral" : ""} ${
        cell.needsReview ? "ring-1 ring-inset ring-amber-400/70" : ""
      }`}
      style={{ width: DAY_COL_PX }}
    >
      <button
        type="button"
        onClick={onClick}
        disabled={!clickable || loading}
        className={`w-full py-1.5 leading-tight ${loading ? "opacity-40" : ""} ${
          clickable ? "hover:bg-cream/10 cursor-pointer" : "cursor-default"
        }`}
      >
        {lead}
        {secondary}
        {cell.needsReview && view === "availability" && <span className="block text-[0.5rem] text-amber-400">review</span>}
      </button>
    </td>
  );
}

function DayBreakdown({
  roomName,
  date,
  day,
  onManageUnit,
}: {
  roomName: string | null;
  date: string | null;
  day: AvailabilityDay | null;
  onManageUnit: (roomUnitId: string) => void;
}) {
  if (!date || !roomName) {
    return <p className="text-sm text-cream/50">Click a day in the table to see room-by-room status.</p>;
  }
  return (
    <div className="max-w-xl">
      <h2 className="font-display italic text-lg mb-1">
        {roomName} · {formatDate(date)}
      </h2>
      {day && (
        <p className="text-xs text-cream/50 mb-4">
          {day.availableCount} of {day.unitCount} free · {day.bookedCount} booked · {day.blockedCount} blocked
          {day.bookedCount > day.units.filter((u) => u.isBooked).length && " (includes bookings with no room assigned yet)"}
        </p>
      )}
      {!day ? (
        <p className="text-sm text-coral">Room-by-room status for this day didn&rsquo;t load.</p>
      ) : day.units.length === 0 ? (
        <p className="text-sm text-cream/50">This room type has no active rooms yet.</p>
      ) : (
        <div className="grid sm:grid-cols-2 gap-2">
          {day.units.map((u) => {
            const flagged = u.isBlocked && isAutoMigrated(u.blockReason);
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
                  {u.isBooked ? "Booked" : u.isBlocked ? "Blocked" : "Free"}
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
  );
}

function PriceRangeForm({
  rooms,
  defaultRoomId,
  canManage,
  onSaved,
}: {
  rooms: Room[];
  defaultRoomId: string;
  canManage: boolean;
  onSaved: (roomId: string) => Promise<void>;
}) {
  const [roomId, setRoomId] = useState(defaultRoomId);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [price, setPrice] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedNote, setSavedNote] = useState<string | null>(null);

  // Follow the table's room-type filter while the form is untouched.
  useEffect(() => setRoomId(defaultRoomId), [defaultRoomId]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSavedNote(null);
    const rangeError = validatePriceRange(from, to);
    const parsed = parsePriceInput(price);
    if (rangeError) return setError(rangeError);
    if (parsed === null) return setError("Enter a price above 0.");
    setSaving(true);
    setError(null);
    const result = await setPriceRange(roomId, from, to, parsed);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const name = rooms.find((r) => r.id === roomId)?.name ?? "";
    setSavedNote(`Saved ${result.updated} night${result.updated === 1 ? "" : "s"} for ${name}.`);
    await onSaved(roomId);
  }

  return (
    <div className="max-w-md">
      <h2 className="font-display italic text-lg mb-4">Set a price range</h2>
      {!canManage ? (
        <p className="text-cream/50 text-sm">Setting prices requires a manager account.</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4 bg-ink2/40 border border-cream/10 rounded-xl p-5">
          <div>
            <label className="eyebrow text-cream/60 block mb-1">Room type</label>
            <select
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
            >
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="eyebrow text-cream/60 block mb-1">From</label>
              <input
                type="date"
                required
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
              />
            </div>
            <div>
              <label className="eyebrow text-cream/60 block mb-1">To</label>
              <input
                type="date"
                required
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
              />
            </div>
          </div>
          <div>
            <label className="eyebrow text-cream/60 block mb-1">Price / night (฿)</label>
            <input
              type="number"
              min={1}
              step="1"
              required
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
            />
          </div>

          {error && <p className="text-sm text-coral">{error}</p>}
          {savedNote && <p className="text-sm text-sea">{savedNote}</p>}

          <button
            type="submit"
            disabled={saving || !roomId}
            className="w-full rounded-full bg-coral hover:bg-coraldeep transition-colors py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {saving ? "Saving…" : "Apply to range"}
          </button>
        </form>
      )}
    </div>
  );
}
