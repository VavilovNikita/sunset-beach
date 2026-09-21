"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createShiftCode, updateShiftCodeKind } from "@/lib/rosterClient";
import { STAFF_AREA_LABELS } from "@/lib/rosterGrid";
import type { ShiftCode, ShiftCodeCreateInput, ShiftCodeKind, StaffArea } from "@/lib/types";

const STAFF_AREAS: StaffArea[] = ["ADMIN", "FRONT_OFFICE", "MAINTENANCE", "HOUSEKEEPING", "RESTAURANT", "KITCHEN"];
const TODAY = new Date().toISOString().slice(0, 10);
const SHARED_LABEL = "Shared (every area)";

const SHIFT_CODE_KINDS: ShiftCodeKind[] = ["MORNING", "SPLIT", "EVENING", "OPEN_SCHEDULE", "ABSENCE"];
const SHIFT_CODE_KIND_LABELS: Record<ShiftCodeKind, string> = {
  MORNING: "Morning",
  SPLIT: "Split",
  EVENING: "Evening",
  OPEN_SCHEDULE: "Open schedule",
  ABSENCE: "Absence",
};

// Local-only form shape: kind starts unset ("") so nothing is silently defaulted - a person
// chooses it, or the Save button stays disabled (see the required attribute below).
type FormState = Omit<ShiftCodeCreateInput, "kind"> & { kind: ShiftCodeKind | "" };

function emptyForm(): FormState {
  return {
    staffArea: null,
    code: "",
    kind: "",
    startTime1: "",
    endTime1: "",
    startTime2: "",
    endTime2: "",
    countsAsWorked: true,
    isPaid: true,
    effectiveFrom: TODAY,
  };
}

// The one row-level action here that mutates an existing ShiftCode in place instead of creating a
// new version - see ShiftCode.kind's own comment. Pre-filled with the backend's own suggestion
// (computed from the code's shape), editable before confirming.
function KindConfirmRow({ code, onConfirmed }: { code: ShiftCode; onConfirmed: (updated: ShiftCode) => void }) {
  const [selected, setSelected] = useState<ShiftCodeKind>(code.suggestedKind ?? "MORNING");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setSaving(true);
    setError(null);
    const result = await updateShiftCodeKind(code.id, selected);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onConfirmed(result.data);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 mt-1">
      <span className="text-xs text-amber-400">Kind not set{code.suggestedKind ? " - suggested:" : ""}</span>
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value as ShiftCodeKind)}
        className="bg-ink2 border-b border-cream/25 py-0.5 text-cream text-xs focus:outline-none focus:border-coral"
      >
        {SHIFT_CODE_KINDS.map((k) => (
          <option key={k} value={k}>
            {SHIFT_CODE_KIND_LABELS[k]}
          </option>
        ))}
      </select>
      <button
        type="button"
        onClick={handleConfirm}
        disabled={saving}
        className="text-xs text-sea hover:text-coral transition-colors disabled:opacity-50"
      >
        {saving ? "…" : "Confirm"}
      </button>
      {error && <span className="text-xs text-coral">{error}</span>}
    </div>
  );
}

// Shift codes are versioned, never edited (see ShiftCode's own description) - this manager only
// ever creates a new row. Creating one with the same (staffArea, code) as an active row silently
// retires that row on the backend; there is no separate "edit" action to offer here.
export default function ShiftCodeManager({ initialCodes }: { initialCodes: ShiftCode[] }) {
  const router = useRouter();
  const [codes, setCodes] = useState(initialCodes);
  const [filterArea, setFilterArea] = useState<StaffArea | "">("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = filterArea ? codes.filter((c) => c.staffArea === filterArea) : codes;
  // This list is the raw, unresolved "every code as stored" view (see GET /shift-codes's own
  // description) - a shared and an area-scoped row for the same code both show up here, each in
  // its own group, which is the point: this screen is for seeing the collision, not resolving it
  // the way the roster grid's per-employee picker does.
  const grouped = [
    { area: null as StaffArea | null, codes: visible.filter((c) => c.staffArea === null) },
    ...STAFF_AREAS.map((area) => ({ area: area as StaffArea | null, codes: visible.filter((c) => c.staffArea === area) })),
  ].filter((g) => g.codes.length > 0);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (form.startTime2 && !form.startTime1) {
      setError("A second interval needs a first one.");
      return;
    }
    if (!form.kind) {
      setError("Choose what kind of shift this is.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const input: ShiftCodeCreateInput = {
      ...form,
      kind: form.kind,
      startTime1: form.startTime1 || null,
      endTime1: form.endTime1 || null,
      startTime2: form.startTime2 || null,
      endTime2: form.endTime2 || null,
    };
    const result = await createShiftCode(input);
    setSubmitting(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    setCodes((prev) => [...prev.filter((c) => !(c.staffArea === result.data.staffArea && c.code === result.data.code)), result.data]);
    setForm(emptyForm());
    setCreating(false);
    router.refresh();
  }

  // Replaces the row in place - kind is mutated on the existing row, not versioned into a new
  // one (see ShiftCode.kind's own comment), so this is the one update here that never touches
  // which rows exist, only one row's own field.
  function handleKindConfirmed(updated: ShiftCode) {
    setCodes((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
    router.refresh();
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-4">
        <select
          value={filterArea}
          onChange={(e) => setFilterArea(e.target.value as StaffArea | "")}
          className="bg-ink2 border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
        >
          <option value="">All areas</option>
          {STAFF_AREAS.map((a) => (
            <option key={a} value={a}>
              {STAFF_AREA_LABELS[a]}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium"
        >
          New shift code
        </button>
      </div>

      {creating && (
        <form onSubmit={handleCreate} className="bg-ink2/40 border border-cream/10 rounded-xl p-4 space-y-3 mb-4">
          <p className="eyebrow text-cream/60">New shift code version</p>
          <div className="grid sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="eyebrow text-cream/60 block mb-1">Area</label>
              <select
                value={form.staffArea ?? ""}
                onChange={(e) => setForm({ ...form, staffArea: e.target.value ? (e.target.value as StaffArea) : null })}
                className="w-full bg-ink2 border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
              >
                <option value="">{SHARED_LABEL}</option>
                {STAFF_AREAS.map((a) => (
                  <option key={a} value={a}>
                    {STAFF_AREA_LABELS[a]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="eyebrow text-cream/60 block mb-1">Code</label>
              <input
                type="text"
                required
                maxLength={12}
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="9, OP, PH…"
                className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm placeholder:text-cream/40 focus:outline-none focus:border-coral"
              />
            </div>
            <div>
              <label className="eyebrow text-cream/60 block mb-1">Effective from</label>
              <input
                type="date"
                required
                value={form.effectiveFrom}
                onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
              />
            </div>
            <div>
              <label className="eyebrow text-cream/60 block mb-1">Kind</label>
              <select
                required
                value={form.kind}
                onChange={(e) => setForm({ ...form, kind: e.target.value as ShiftCodeKind })}
                className="w-full bg-ink2 border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
              >
                <option value="">Which kind is this?</option>
                {SHIFT_CODE_KINDS.map((k) => (
                  <option key={k} value={k}>
                    {SHIFT_CODE_KIND_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <p className="text-xs text-cream/40">Leave every time blank for OP - worked, no fixed hours.</p>
          <div className="grid sm:grid-cols-4 gap-3 items-end">
            <div>
              <label className="eyebrow text-cream/60 block mb-1">Start 1</label>
              <input
                type="time"
                value={form.startTime1 ?? ""}
                onChange={(e) => setForm({ ...form, startTime1: e.target.value })}
                className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
              />
            </div>
            <div>
              <label className="eyebrow text-cream/60 block mb-1">End 1</label>
              <input
                type="time"
                value={form.endTime1 ?? ""}
                onChange={(e) => setForm({ ...form, endTime1: e.target.value })}
                className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
              />
            </div>
            <div>
              <label className="eyebrow text-cream/60 block mb-1">Start 2 (split shift)</label>
              <input
                type="time"
                value={form.startTime2 ?? ""}
                onChange={(e) => setForm({ ...form, startTime2: e.target.value })}
                className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
              />
            </div>
            <div>
              <label className="eyebrow text-cream/60 block mb-1">End 2</label>
              <input
                type="time"
                value={form.endTime2 ?? ""}
                onChange={(e) => setForm({ ...form, endTime2: e.target.value })}
                className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
              />
            </div>
          </div>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm text-cream/70">
              <input
                type="checkbox"
                checked={form.countsAsWorked}
                onChange={(e) => setForm({ ...form, countsAsWorked: e.target.checked })}
                className="accent-coral"
              />
              Counts as worked
            </label>
            <label className="flex items-center gap-2 text-sm text-cream/70">
              <input type="checkbox" checked={form.isPaid} onChange={(e) => setForm({ ...form, isPaid: e.target.checked })} className="accent-coral" />
              Paid
            </label>
          </div>
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-60"
            >
              {submitting ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setCreating(false);
                setForm(emptyForm());
                setError(null);
              }}
              className="text-sm text-cream/50 hover:text-cream transition-colors"
            >
              Cancel
            </button>
          </div>
          {error && <p className="text-sm text-coral">{error}</p>}
        </form>
      )}

      {grouped.length === 0 && <p className="text-cream/50 text-sm">No shift codes yet.</p>}

      <div className="space-y-6">
        {grouped.map(({ area, codes: areaCodes }) => (
          <div key={area ?? "shared"}>
            <p className="eyebrow text-cream/40 mb-2">{area ? STAFF_AREA_LABELS[area] : SHARED_LABEL}</p>
            <div className="space-y-2">
              {areaCodes.map((c) => (
                <div key={c.id} className="flex items-center gap-4 bg-ink2/40 border border-cream/10 rounded-xl p-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-lg">
                      {c.code}
                      {!c.active && <span className="text-cream/40 text-sm"> · retired</span>}
                    </p>
                    <p className="text-sm text-cream/60">
                      {c.startTime1 ? `${c.startTime1}–${c.endTime1}` : "OP"}
                      {c.startTime2 ? `, ${c.startTime2}–${c.endTime2}` : ""}
                      {" · "}
                      {c.countsAsWorked ? "Counts as worked" : "Does not count as worked"}
                      {" · "}
                      {c.isPaid ? "Paid" : "Unpaid"}
                      {c.kind && (
                        <>
                          {" · "}
                          {SHIFT_CODE_KIND_LABELS[c.kind]}
                        </>
                      )}
                    </p>
                    {!c.kind && <KindConfirmRow code={c} onConfirmed={handleKindConfirmed} />}
                  </div>
                  <p className="text-xs text-cream/40">from {c.effectiveFrom}</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
