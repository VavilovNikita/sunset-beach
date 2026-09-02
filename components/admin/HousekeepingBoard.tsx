"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateRoomUnitHousekeeping } from "@/lib/roomUnitHousekeepingClient";
import type { Room, RoomUnit } from "@/lib/types";

// Every physical room's cleaning state, grouped by room type - independent of RoomUnitManager
// (label/isActive, MANAGER+) and of AvailabilityManager's RoomUnitBlock editor (a unit pulled
// off sale for a written reason, not a cleaning state) - see HousekeepingStatus's own
// description for why these stay three separate concerns rather than one combined "room admin"
// screen. CASHIER+ can change status here; inactive units are still shown (a deactivated room
// can still need its final clean recorded) but visually muted, same convention RoomUnitManager
// already uses.
export default function HousekeepingBoard({ rooms, units }: { rooms: Room[]; units: RoomUnit[] }) {
  const roomsById = new Map(rooms.map((r) => [r.id, r]));
  const unitsByRoom = new Map<string, RoomUnit[]>();
  for (const unit of units) {
    const list = unitsByRoom.get(unit.roomId) ?? [];
    list.push(unit);
    unitsByRoom.set(unit.roomId, list);
  }

  const groups = Array.from(unitsByRoom.entries())
    .map(([roomId, roomUnits]) => ({
      room: roomsById.get(roomId),
      units: roomUnits.sort((a, b) => a.label.localeCompare(b.label)),
    }))
    .filter((g): g is { room: Room; units: RoomUnit[] } => g.room !== undefined)
    .sort((a, b) => a.room.name.localeCompare(b.room.name));

  if (groups.length === 0) {
    return <p className="text-sm text-cream/50">No physical rooms yet.</p>;
  }

  return (
    <div className="space-y-8">
      {groups.map(({ room, units: roomUnits }) => (
        <div key={room.id}>
          <p className="eyebrow text-cream/50 mb-2">{room.name}</p>
          <div className="space-y-2">
            {roomUnits.map((unit) => (
              <UnitRow key={unit.id} unit={unit} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function UnitRow({ unit }: { unit: RoomUnit }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dirty = unit.housekeepingStatus === "DIRTY";

  async function setStatus(status: "DIRTY" | "CLEAN") {
    setBusy(true);
    setError(null);
    const result = await updateRoomUnitHousekeeping(unit.id, status);
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
        dirty ? "border-coral/30" : "border-cream/10"
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span className={`text-cream ${unit.isActive ? "" : "text-cream/40"}`}>{unit.label}</span>
        {!unit.isActive && <span className="text-xs text-cream/40">Inactive</span>}
        <span
          className={`text-xs rounded-full px-3 py-1 ${dirty ? "bg-coral/15 text-coral" : "bg-sea/15 text-sea"}`}
        >
          {dirty ? "Dirty" : "Clean"}
        </span>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {error && <p className="text-xs text-coral">{error}</p>}
        <button
          type="button"
          onClick={() => setStatus(dirty ? "CLEAN" : "DIRTY")}
          disabled={busy}
          className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {busy ? "…" : dirty ? "Mark clean" : "Mark dirty"}
        </button>
      </div>
    </div>
  );
}
