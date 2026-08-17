"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_API_URL } from "@/lib/backend";
import type { RoomUnit } from "@/lib/types";

// The backend explains assignment failures in plain text (e.g. "room 203 is
// already assigned to an overlapping booking") — surface that text as-is
// rather than a generic "couldn't assign" that would hide the actual reason.
function extractError(data: unknown, fallback: string): string {
  if (data && typeof data === "object" && "error" in data) {
    const err = (data as { error: unknown }).error;
    if (typeof err === "string") return err;
  }
  return fallback;
}

export default function BookingRoomUnitAssign({
  bookingId,
  units,
  currentRoomUnit,
  canAssign,
  canListUnits,
}: {
  bookingId: string;
  // Active rooms of this booking's room type — empty whenever canListUnits
  // is false, since the page doesn't attempt the (MANAGER+) read then.
  units: RoomUnit[];
  currentRoomUnit: RoomUnit | null;
  // PUT /bookings/{id}/room-unit is CASHIER+.
  canAssign: boolean;
  // GET /room-units — the only way to list rooms to pick from — is
  // MANAGER+, one tier above canAssign. A CASHIER can therefore still
  // clear an assignment (no list needed) but can't pick a *different*
  // specific room without a manager present.
  canListUnits: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [selectedId, setSelectedId] = useState(currentRoomUnit?.id ?? units[0]?.id ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function assign(roomUnitId: string | null) {
    setSaving(true);
    setError(null);

    const res = await fetch(`${ADMIN_API_URL}/bookings/${bookingId}/room-unit`, {
      method: "PUT",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ roomUnitId }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(extractError(data, "Could not update the room assignment."));
      return;
    }
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="bg-ink2/40 border border-cream/10 rounded-xl p-5">
      <p className="eyebrow text-cream/60 mb-2">Room assignment</p>

      {!editing ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            {currentRoomUnit ? (
              <p className="text-cream">
                Room <span className="font-display italic">{currentRoomUnit.label}</span>
              </p>
            ) : (
              <p className="text-sm text-amber-400">Not assigned yet</p>
            )}
            {canAssign && canListUnits && (
              <button
                type="button"
                onClick={() => {
                  setSelectedId(currentRoomUnit?.id ?? units[0]?.id ?? "");
                  setError(null);
                  setEditing(true);
                }}
                className="text-sm text-sea hover:text-coral transition-colors shrink-0"
              >
                {currentRoomUnit ? "Change" : "Assign"}
              </button>
            )}
            {canAssign && !canListUnits && currentRoomUnit && (
              <button
                type="button"
                disabled={saving}
                onClick={() => assign(null)}
                className="text-sm text-cream/60 hover:text-coral transition-colors shrink-0 disabled:opacity-60"
              >
                {saving ? "Saving…" : "Unassign"}
              </button>
            )}
          </div>

          {canAssign && !canListUnits && (
            <p className="text-xs text-cream/40">
              {currentRoomUnit
                ? "Only managers can list rooms to switch to a different one — you can still clear this assignment."
                : "Only managers can list rooms to assign one here."}
            </p>
          )}
          {!canAssign && <p className="text-xs text-cream/40">Assigning a room requires a cashier account or above.</p>}

          {error && <p className="text-sm text-coral">{error}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {units.length === 0 ? (
            <p className="text-sm text-cream/50">No active rooms of this type to assign.</p>
          ) : (
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
            >
              {units.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.label}
                </option>
              ))}
            </select>
          )}

          {error && <p className="text-sm text-coral">{error}</p>}

          <div className="flex gap-3 flex-wrap">
            <button
              type="button"
              disabled={saving || !selectedId}
              onClick={() => assign(selectedId)}
              className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-60"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {currentRoomUnit && (
              <button
                type="button"
                disabled={saving}
                onClick={() => assign(null)}
                className="text-sm text-cream/60 hover:text-coral transition-colors disabled:opacity-60"
              >
                Unassign
              </button>
            )}
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-sm text-cream/50 hover:text-cream transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
