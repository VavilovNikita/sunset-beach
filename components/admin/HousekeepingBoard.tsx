"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateRoomUnitHousekeeping } from "@/lib/roomUnitHousekeepingClient";
import {
  HOUSEKEEPING_CODE_LABELS,
  resolveHousekeepingStatus,
  type HousekeepingCode,
  type HousekeepingRoomStatus,
} from "@/lib/housekeepingCode";
import { bulkTargets, canChangeStatus, filterBoardUnits, splitArrivals, type BoardUnit, type StatusFilter } from "@/lib/housekeepingFilter";
import { overdueLabel } from "@/lib/overstay";
import type { PropertyMapUnit, Room, RoomUnit } from "@/lib/types";

// Every physical room's cleaning state, grouped by room type - independent of RoomUnitManager
// (label/isActive, MANAGER+) and of RoomUnitBlocksPanel's RoomUnitBlock editor (a unit pulled
// off sale for a written reason, not a cleaning state) - see HousekeepingStatus's own
// description for why these stay three separate concerns rather than one combined "room admin"
// screen. CASHIER+ can change status here. A deactivated room is listed (its final clean may
// still be wanted in the records) but offers no action: nothing is cleaned in a room that is out
// of service. Rooms arriving today are lifted into their own block on top; the list can be
// narrowed by status and room type, and several rooms changed at once (one request per room
// through the ordinary endpoint).
export default function HousekeepingBoard({
  rooms,
  units,
  occupancy,
  today,
}: {
  rooms: Room[];
  units: RoomUnit[];
  // null when GET /property-map failed - occupancy unknown, clean/dirty still editable.
  occupancy: PropertyMapUnit[] | null;
  today: string;
}) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [roomFilter, setRoomFilter] = useState<string>("ALL");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState<string | null>(null);

  const roomsById = new Map(rooms.map((r) => [r.id, r]));
  const occupancyByUnit = new Map((occupancy ?? []).map((u) => [u.roomUnitId, u]));
  const statusOf = (unit: RoomUnit) =>
    occupancy === null ? null : resolveHousekeepingStatus(unit.housekeepingStatus, occupancyByUnit.get(unit.id), today);
  const counts = new Map<HousekeepingCode, number>();
  for (const unit of units) {
    const code = unit.isActive ? statusOf(unit)?.code : undefined;
    if (code) counts.set(code, (counts.get(code) ?? 0) + 1);
  }

  const allItems: BoardUnit[] = units.map((unit) => ({ unit, status: statusOf(unit) }));
  const visible = filterBoardUnits(allItems, statusFilter, roomFilter);
  const { arriving, rest } = splitArrivals(visible);

  const unitsByRoom = new Map<string, BoardUnit[]>();
  for (const item of rest) {
    const list = unitsByRoom.get(item.unit.roomId) ?? [];
    list.push(item);
    unitsByRoom.set(item.unit.roomId, list);
  }
  const groups = Array.from(unitsByRoom.entries())
    .map(([roomId, roomUnits]) => ({
      room: roomsById.get(roomId),
      units: roomUnits.sort((a, b) => a.unit.label.localeCompare(b.unit.label)),
    }))
    .filter((g): g is { room: Room; units: BoardUnit[] } => g.room !== undefined)
    .sort((a, b) => a.room.name.localeCompare(b.room.name));

  if (units.length === 0) {
    return <p className="text-sm text-cream/50">No physical rooms yet.</p>;
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  // A failure names the room and the others still go through; the failed ones stay selected for another try.
  async function applyBulk(to: "CLEAN" | "DIRTY") {
    const targets = bulkTargets(allItems, selected, to);
    if (targets.length === 0) return;
    setBulkBusy(true);
    setBulkError(null);
    const failed: { id: string; text: string }[] = [];
    for (const unit of targets) {
      const result = await updateRoomUnitHousekeeping(unit.id, to);
      if (!result.ok) failed.push({ id: unit.id, text: `${unit.label}: ${result.error}` });
    }
    setBulkBusy(false);
    setSelected(new Set(failed.map((f) => f.id)));
    if (failed.length > 0) setBulkError(`Not changed - ${failed.map((f) => f.text).join("; ")}`);
    router.refresh();
  }

  const row = (item: BoardUnit) => (
    <UnitRow key={item.unit.id} unit={item.unit} status={item.status} selected={selected.has(item.unit.id)} onToggle={() => toggle(item.unit.id)} />
  );

  return (
    <div className="space-y-8">
      {occupancy === null ? (
        <p className="text-sm text-amber-400">
          Couldn&apos;t load which rooms are occupied - showing clean/dirty only. Reload to try again.
        </p>
      ) : (
        <div className="flex flex-wrap gap-2" aria-label="Status codes">
          {(Object.keys(HOUSEKEEPING_CODE_LABELS) as HousekeepingCode[]).map((code) => (
            <span key={code} className={`text-xs rounded-full px-3 py-1 ${codeChipClass(code)}`}>
              <span className="font-semibold">{code}</span> {HOUSEKEEPING_CODE_LABELS[code]} · {counts.get(code) ?? 0}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <label className="text-xs text-cream/60">
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
            className="block mt-1 bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm text-cream"
          >
            <option value="ALL">All</option>
            <option value="NEEDS_CLEANING">Needs cleaning (dirty)</option>
            {(Object.keys(HOUSEKEEPING_CODE_LABELS) as HousekeepingCode[]).map((code) => (
              <option key={code} value={code}>
                {code} - {HOUSEKEEPING_CODE_LABELS[code]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-xs text-cream/60">
          Room type
          <select
            value={roomFilter}
            onChange={(e) => setRoomFilter(e.target.value)}
            className="block mt-1 bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm text-cream"
          >
            <option value="ALL">All room types</option>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </label>
        {selected.size > 0 && (
          <div className="flex items-center gap-2 ml-auto">
            <span className="text-sm text-cream/70">{selected.size} selected</span>
            <button type="button" disabled={bulkBusy} onClick={() => applyBulk("CLEAN")} className={BULK_BUTTON}>
              {bulkBusy ? "…" : "Mark clean"}
            </button>
            <button type="button" disabled={bulkBusy} onClick={() => applyBulk("DIRTY")} className={BULK_BUTTON}>
              {bulkBusy ? "…" : "Mark dirty"}
            </button>
            <button type="button" disabled={bulkBusy} onClick={() => setSelected(new Set())} className="text-sm text-cream/60 underline px-2">
              Clear
            </button>
          </div>
        )}
      </div>
      {bulkError && <p className="text-sm text-coral">{bulkError}</p>}

      {visible.length === 0 && <p className="text-sm text-cream/50">No rooms match these filters.</p>}

      {arriving.length > 0 && (
        <div>
          <p className="eyebrow text-amber-400 mb-2">Arriving today · {arriving.length}</p>
          <div className="space-y-2">{arriving.map(row)}</div>
        </div>
      )}
      {groups.map(({ room, units: roomUnits }) => (
        <div key={room.id}>
          <p className="eyebrow text-cream/50 mb-2">{room.name}</p>
          <div className="space-y-2">{roomUnits.map(row)}</div>
        </div>
      ))}
    </div>
  );
}

const BULK_BUTTON = "rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-4 py-2 text-sm font-medium disabled:opacity-50";

// Colour follows the app-wide meanings: sand = not cleaned, sea = free, neutral = occupied with
// no problem. Occupied vs vacant is told apart by the code itself, not by a new colour.
function codeChipClass(code: HousekeepingCode): string {
  if (code === "VD" || code === "OD") return "bg-sand/15 text-sand";
  if (code === "VC") return "bg-sea/15 text-sea";
  return "bg-cream/10 text-cream";
}

function UnitRow({
  unit,
  status,
  selected,
  onToggle,
}: {
  unit: RoomUnit;
  status: HousekeepingRoomStatus | null;
  selected: boolean;
  onToggle: () => void;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = unit.housekeepingStatus === "DIRTY";
  const actionable = canChangeStatus(unit);

  async function setStatus(next: "DIRTY" | "CLEAN") {
    setBusy(true);
    setError(null);
    const result = await updateRoomUnitHousekeeping(unit.id, next);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div
      className={`bg-ink2/40 border rounded-xl p-4 flex items-center justify-between gap-4 flex-wrap ${
        dirty ? "border-sand/30" : "border-cream/10"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        {actionable && <input type="checkbox" checked={selected} onChange={onToggle} aria-label={`Select ${unit.label}`} className="h-4 w-4" />}
        <span className={`text-cream ${unit.isActive ? "" : "text-cream/40"}`}>{unit.label}</span>
        {!unit.isActive && <span className="text-xs text-cream/40">Out of service</span>}
        {status ? (
          <span className={`text-xs rounded-full px-3 py-1 ${codeChipClass(status.code)}`}>
            <span className="font-semibold">{status.code}</span> {HOUSEKEEPING_CODE_LABELS[status.code]}
          </span>
        ) : (
          <span className={`text-xs rounded-full px-3 py-1 ${dirty ? "bg-sand/15 text-sand" : "bg-sea/15 text-sea"}`}>
            {dirty ? "Dirty" : "Clean"}
          </span>
        )}
        {status?.departingToday && <span className="text-xs text-amber-400">Due out today</span>}
        {status && overdueLabel(status.overdueDays) && (
          <span className="text-xs text-coral">Overdue · {overdueLabel(status.overdueDays)}</span>
        )}
        {status?.arrivingToday && <span className="text-xs text-amber-400">Arriving today</span>}
        {status?.outOfOrder && <span className="text-xs text-coral">Out of order</span>}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {error && <p className="text-xs text-coral">{error}</p>}
        {actionable && (
          <button
            type="button"
            onClick={() => setStatus(dirty ? "CLEAN" : "DIRTY")}
            disabled={busy}
            className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-4 py-2 text-sm font-medium disabled:opacity-50"
          >
            {busy ? "…" : dirty ? "Mark clean" : "Mark dirty"}
          </button>
        )}
      </div>
    </div>
  );
}
