"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_API_URL } from "@/lib/backend";
import { extractApiError } from "@/lib/apiError";
import DeleteButton from "@/components/admin/DeleteButton";
import type { RoomUnit, RoomUnitInput } from "@/lib/types";

function emptyForm(roomId: string): RoomUnitInput {
  return { roomId, label: "", isActive: true };
}

function UnitFields({ values, onChange }: { values: RoomUnitInput; onChange: (values: RoomUnitInput) => void }) {
  return (
    <div className="grid sm:grid-cols-3 gap-3 items-end">
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Label</label>
        <input
          type="text"
          required
          minLength={1}
          maxLength={60}
          value={values.label}
          onChange={(e) => onChange({ ...values, label: e.target.value })}
          placeholder="e.g. 203"
          className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm placeholder:text-cream/30 focus:outline-none focus:border-coral"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-cream/70 pb-2">
        <input
          type="checkbox"
          checked={values.isActive ?? true}
          onChange={(e) => onChange({ ...values, isActive: e.target.checked })}
          className="accent-coral"
        />
        Active
      </label>
    </div>
  );
}

// Room-scoped CRUD for physical rooms, following the same inline-section
// pattern as TableManager (components/admin/pos/TableManager.tsx) — a list
// of rows with edit-in-place and a trailing create form. Unlike tables,
// though, GET /room-units itself is MANAGER+ with no lower-privilege read
// (per openapi.yaml) — so `canManage: false` here means "can't see this at
// all," not just "read-only," and the caller shouldn't have fetched
// `initialUnits` in that case.
export default function RoomUnitManager({
  roomId,
  initialUnits,
  canManage,
}: {
  roomId: string;
  initialUnits: RoomUnit[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [units, setUnits] = useState(initialUnits);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<RoomUnitInput>(emptyForm(roomId));
  const [creating, setCreating] = useState(false);
  const [newValues, setNewValues] = useState<RoomUnitInput>(emptyForm(roomId));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(unit: RoomUnit) {
    setEditingId(unit.id);
    setEditValues({ roomId: unit.roomId, label: unit.label, isActive: unit.isActive });
    setError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch(`${ADMIN_API_URL}/room-units`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newValues),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(extractApiError(data, "Could not create room."));
      return;
    }
    const created: RoomUnit = await res.json();
    setUnits((prev) => [...prev, created]);
    setNewValues(emptyForm(roomId));
    setCreating(false);
    router.refresh();
  }

  // PATCH is a full replace, same convention as TableManager/PrinterManager.
  async function handleSaveEdit(id: string) {
    setSubmitting(true);
    setError(null);

    const res = await fetch(`${ADMIN_API_URL}/room-units/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editValues),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(extractApiError(data, "Could not save room."));
      return;
    }
    const updated: RoomUnit = await res.json();
    setUnits((prev) => prev.map((u) => (u.id === id ? updated : u)));
    setEditingId(null);
    router.refresh();
  }

  function handleDeleted(id: string) {
    setUnits((prev) => prev.filter((u) => u.id !== id));
    router.refresh();
  }

  if (!canManage) {
    return <p className="text-cream/50 text-sm">Managing rooms requires a manager account.</p>;
  }

  return (
    <div>
      {units.length === 0 && <p className="text-cream/50 text-sm mb-4">No rooms set up yet — add one below.</p>}

      <div className="space-y-2">
        {units.map((unit) =>
          editingId === unit.id ? (
            <div key={unit.id} className="bg-ink2/40 border border-cream/10 rounded-xl p-4 space-y-3">
              <UnitFields values={editValues} onChange={setEditValues} />
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSaveEdit(unit.id)}
                  className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-60"
                >
                  {submitting ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="text-sm text-cream/50 hover:text-cream transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div key={unit.id} className="flex items-center gap-4 bg-ink2/40 border border-cream/10 rounded-xl p-4">
              <div className="flex-1 min-w-0">
                <p className="font-display text-lg">{unit.label}</p>
                <p className="text-sm text-cream/60">{unit.isActive ? "Active" : "Inactive"}</p>
              </div>
              <button
                type="button"
                onClick={() => startEdit(unit)}
                className="text-sm text-sea hover:text-coral transition-colors"
              >
                Edit
              </button>
              <DeleteButton
                url={`${ADMIN_API_URL}/room-units/${unit.id}`}
                confirmText={`Delete room "${unit.label}"? This can't be undone.`}
                conflictMessage={`Room "${unit.label}" has bookings or blocks on record and can't be deleted. Deactivate it instead (Edit → uncheck Active) to keep its history while hiding it from new assignments.`}
                onDeleted={() => handleDeleted(unit.id)}
              />
            </div>
          )
        )}
      </div>

      <div className="mt-4">
        {creating ? (
          <form onSubmit={handleCreate} className="bg-ink2/40 border border-cream/10 rounded-xl p-4 space-y-3">
            <p className="eyebrow text-cream/60">New room</p>
            <UnitFields values={newValues} onChange={setNewValues} />
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-60"
              >
                {submitting ? "Creating…" : "Create room"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setNewValues(emptyForm(roomId));
                  setError(null);
                }}
                className="text-sm text-cream/50 hover:text-cream transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2.5 text-sm font-medium"
          >
            New room
          </button>
        )}
      </div>

      {error && <p className="text-sm text-coral mt-3">{error}</p>}
    </div>
  );
}
