"use client";

import { useEffect, useState } from "react";
import { createEmployeePayRate, listEmployeePayRates } from "@/lib/rosterClient";
import type { EmployeePayRate, RosterEmployee } from "@/lib/types";

const TODAY = new Date().toISOString().slice(0, 10);

// EmployeePayRate is versioned like ShiftCode - never edited, only superseded, so this manager
// only ever adds a new rate effective from a given date. History is shown oldest-first, matching
// GET /employee-pay-rates' own ordering.
export default function PayRateManager({ employees }: { employees: RosterEmployee[] }) {
  const [employeeUserId, setEmployeeUserId] = useState(employees[0]?.id ?? "");
  const [rates, setRates] = useState<EmployeePayRate[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [dailyRate, setDailyRate] = useState("");
  const [effectiveFrom, setEffectiveFrom] = useState(TODAY);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!employeeUserId) return;
    setLoading(true);
    setLoadError(null);
    listEmployeePayRates(employeeUserId).then((result) => {
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      setRates(result.data);
    });
  }, [employeeUserId]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const result = await createEmployeePayRate({ employeeUserId, dailyRate, effectiveFrom });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setRates((prev) => [...prev, result.data]);
    setDailyRate("");
  }

  return (
    <div className="max-w-2xl">
      <select
        value={employeeUserId}
        onChange={(e) => setEmployeeUserId(e.target.value)}
        className="w-full bg-ink2 border-b border-cream/25 py-2 text-cream text-sm mb-4 focus:outline-none focus:border-coral"
      >
        {employees.map((emp) => (
          <option key={emp.id} value={emp.id}>
            {emp.email}
          </option>
        ))}
      </select>

      {loading && <p className="text-cream/50 text-sm">Loading…</p>}
      {loadError && <p className="text-sm text-coral">{loadError}</p>}

      {!loading && !loadError && (
        <div className="space-y-2 mb-4">
          {rates.length === 0 && <p className="text-cream/50 text-sm">No rate on record for this employee yet.</p>}
          {rates.map((r) => (
            <div key={r.id} className="flex items-center gap-4 bg-ink2/40 border border-cream/10 rounded-xl p-3">
              <p className="flex-1 font-display text-lg tabular-nums">฿{r.dailyRate}/day</p>
              <p className="text-sm text-cream/60">from {r.effectiveFrom}</p>
              <p className="text-xs text-cream/40">set by {r.createdByEmail}</p>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={handleAdd} className="bg-ink2/40 border border-cream/10 rounded-xl p-4 space-y-3">
        <p className="eyebrow text-cream/60">New rate, effective from a date</p>
        <div className="grid sm:grid-cols-3 gap-3 items-end">
          <div>
            <label className="eyebrow text-cream/60 block mb-1">Daily rate (฿)</label>
            <input
              type="number"
              required
              min={0}
              step="0.01"
              value={dailyRate}
              onChange={(e) => setDailyRate(e.target.value)}
              className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
            />
          </div>
          <div>
            <label className="eyebrow text-cream/60 block mb-1">Effective from</label>
            <input
              type="date"
              required
              value={effectiveFrom}
              onChange={(e) => setEffectiveFrom(e.target.value)}
              className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !employeeUserId}
            className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Add rate"}
          </button>
        </div>
        {error && <p className="text-sm text-coral">{error}</p>}
      </form>
    </div>
  );
}
