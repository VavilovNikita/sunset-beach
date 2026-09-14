"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createShiftCode } from "@/lib/rosterClient";
import { STAFF_AREA_LABELS } from "@/lib/rosterGrid";
import type { ShiftCode, ShiftCodeCreateInput, StaffArea } from "@/lib/types";

const STAFF_AREAS: StaffArea[] = ["ADMIN", "FRONT_OFFICE", "MAINTENANCE", "HOUSEKEEPING", "RESTAURANT", "KITCHEN"];
const TODAY = new Date().toISOString().slice(0, 10);

function emptyForm(): ShiftCodeCreateInput {
  return {
    staffArea: "RESTAURANT",
    code: "",
    startTime1: "",
    endTime1: "",
    startTime2: "",
    endTime2: "",
    countsAsWorked: true,
    isPaid: true,
    effectiveFrom: TODAY,
  };
}

// Shift codes are versioned, never edited (see ShiftCode's own description) - this manager only
// ever creates a new row. Creating one with the same (staffArea, code) as an active row silently
// retires that row on the backend; there is no separate "edit" action to offer here.
export default function ShiftCodeManager({ initialCodes }: { initialCodes: ShiftCode[] }) {
  const router = useRouter();
  const [codes, setCodes] = useState(initialCodes);
  const [filterArea, setFilterArea] = useState<StaffArea | "">("");
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<ShiftCodeCreateInput>(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const visible = filterArea ? codes.filter((c) => c.staffArea === filterArea) : codes;
  const grouped = STAFF_AREAS.map((area) => ({ area, codes: visible.filter((c) => c.staffArea === area) })).filter(
    (g) => g.codes.length > 0
  );

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (form.startTime2 && !form.startTime1) {
      setError("A second interval needs a first one.");
      return;
    }
    setSubmitting(true);
    setError(null);

    const input: ShiftCodeCreateInput = {
      ...form,
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
                value={form.staffArea}
                onChange={(e) => setForm({ ...form, staffArea: e.target.value as StaffArea })}
                className="w-full bg-ink2 border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
              >
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
          <div key={area}>
            <p className="eyebrow text-cream/40 mb-2">{STAFF_AREA_LABELS[area]}</p>
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
                    </p>
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
