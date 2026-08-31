"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_API_URL } from "@/lib/backend";
import { extractApiError } from "@/lib/apiError";
import { ZONE_LABELS } from "@/lib/posOrders";
import DeleteButton from "@/components/admin/DeleteButton";
import type { Table, TableInput, Zone } from "@/lib/posTypes";

const ZONES: Zone[] = ["RESTAURANT", "BAR", "SPA", "POOL", "ROOM_SERVICE"];
const EMPTY_FORM: TableInput = { zone: "RESTAURANT", label: "", capacity: 4, isActive: true };

function TableFields({ values, onChange }: { values: TableInput; onChange: (values: TableInput) => void }) {
  return (
    <div className="grid sm:grid-cols-4 gap-3 items-end">
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Zone</label>
        <select
          value={values.zone}
          onChange={(e) => onChange({ ...values, zone: e.target.value as Zone })}
          className="w-full bg-ink2 border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
        >
          {ZONES.map((z) => (
            <option key={z} value={z}>
              {ZONE_LABELS[z]}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Label</label>
        <input
          type="text"
          required
          minLength={1}
          maxLength={60}
          value={values.label}
          onChange={(e) => onChange({ ...values, label: e.target.value })}
          className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
        />
      </div>
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Capacity</label>
        <input
          type="number"
          required
          min={1}
          max={50}
          value={values.capacity}
          onChange={(e) => onChange({ ...values, capacity: Number(e.target.value) })}
          className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
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

export default function TableManager({
  initialTables,
  canManage,
}: {
  initialTables: Table[];
  canManage: boolean;
}) {
  const router = useRouter();
  // Auto-expanded when the board has nothing to show — this section is the
  // way out of that empty state, not an optional extra behind a click.
  const [open, setOpen] = useState(initialTables.length === 0);
  const [tables, setTables] = useState(initialTables);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<TableInput>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [newValues, setNewValues] = useState<TableInput>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(table: Table) {
    setEditingId(table.id);
    setEditValues({ zone: table.zone, label: table.label, capacity: table.capacity, isActive: table.isActive });
    setError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch(`${ADMIN_API_URL}/tables`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newValues),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(extractApiError(data, "Could not create table."));
      return;
    }
    const created: Table = await res.json();
    setTables((prev) => [...prev, created]);
    setNewValues(EMPTY_FORM);
    setCreating(false);
    router.refresh();
  }

  // PATCH is a full replace on this API, same as everywhere else — the whole
  // TableInput goes out, not just the field that changed.
  async function handleSaveEdit(id: string) {
    setSubmitting(true);
    setError(null);

    const res = await fetch(`${ADMIN_API_URL}/tables/${id}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editValues),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(extractApiError(data, "Could not save table."));
      return;
    }
    const updated: Table = await res.json();
    setTables((prev) => prev.map((t) => (t.id === id ? updated : t)));
    setEditingId(null);
    router.refresh();
  }

  function handleDeleted(id: string) {
    setTables((prev) => prev.filter((t) => t.id !== id));
    router.refresh();
  }

  return (
    <div id="table-manager" className="mt-8 pt-8 border-t border-cream/10">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="text-sm text-cream/60 hover:text-cream transition-colors"
      >
        {open ? "Hide table management" : "Manage tables"}
      </button>

      {open && (
        <div className="mt-4 space-y-4 max-w-3xl">
          {tables.length === 0 && (
            <p className="text-cream/50 text-sm">
              {canManage ? "No tables set up yet — add one below." : "No tables set up yet. Ask a manager to add some."}
            </p>
          )}

          <div className="space-y-2">
            {tables.map((table) =>
              editingId === table.id ? (
                <div key={table.id} className="bg-ink2/40 border border-cream/10 rounded-xl p-4 space-y-3">
                  <TableFields values={editValues} onChange={setEditValues} />
                  <div className="flex gap-3">
                    <button
                      type="button"
                      disabled={submitting}
                      onClick={() => handleSaveEdit(table.id)}
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
                <div key={table.id} className="flex items-center gap-4 bg-ink2/40 border border-cream/10 rounded-xl p-4">
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-lg">
                      {table.label} <span className="text-cream/40 text-sm">· {ZONE_LABELS[table.zone]}</span>
                    </p>
                    <p className="text-sm text-cream/60">
                      Seats {table.capacity}
                      {!table.isActive && " · Inactive"}
                    </p>
                  </div>
                  {canManage && (
                    <>
                      <button
                        type="button"
                        onClick={() => startEdit(table)}
                        className="text-sm text-sea hover:text-coral transition-colors"
                      >
                        Edit
                      </button>
                      <DeleteButton
                        url={`${ADMIN_API_URL}/tables/${table.id}`}
                        confirmText={`Delete "${table.label}"? This can't be undone.`}
                        conflictMessage={`"${table.label}" has orders on record and can't be deleted. Deactivate it instead (Edit → uncheck Active) to hide it from new orders while keeping its history.`}
                        onDeleted={() => handleDeleted(table.id)}
                      />
                    </>
                  )}
                </div>
              )
            )}
          </div>

          {canManage &&
            (creating ? (
              <form onSubmit={handleCreate} className="bg-ink2/40 border border-cream/10 rounded-xl p-4 space-y-3">
                <p className="eyebrow text-cream/60">New table</p>
                <TableFields values={newValues} onChange={setNewValues} />
                <div className="flex gap-3">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-60"
                  >
                    {submitting ? "Creating…" : "Create table"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setCreating(false);
                      setNewValues(EMPTY_FORM);
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
                New table
              </button>
            ))}

          {error && <p className="text-sm text-coral">{error}</p>}
        </div>
      )}
    </div>
  );
}
