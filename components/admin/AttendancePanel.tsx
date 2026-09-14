"use client";

import { useEffect, useState } from "react";
import { getAttendanceSummary, recordAttendancePunch } from "@/lib/rosterClient";
import type { AttendanceDaySummary, PunchDirection, RosterEmployee } from "@/lib/types";

const NOW = new Date();

function minutesToHours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m ? ` ${m}m` : ""}`;
}

// The raw punch stream, paired at read time - see AttendanceDaySummary's own description.
// incomplete (an odd punch count) is closed only by recording another punch below, with a note;
// there is no separate "correction" action.
export default function AttendancePanel({ employees }: { employees: RosterEmployee[] }) {
  const [employeeUserId, setEmployeeUserId] = useState(employees[0]?.id ?? "");
  const [year, setYear] = useState(NOW.getFullYear());
  const [month, setMonth] = useState(NOW.getMonth() + 1);
  const [summaries, setSummaries] = useState<AttendanceDaySummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [punchAt, setPunchAt] = useState("");
  const [direction, setDirection] = useState<PunchDirection>("IN");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    if (!employeeUserId) return;
    setLoading(true);
    setLoadError(null);
    getAttendanceSummary(employeeUserId, year, month).then((result) => {
      setLoading(false);
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      setSummaries(result.data);
    });
  }

  useEffect(reload, [employeeUserId, year, month]);

  async function handleRecord(e: React.FormEvent) {
    e.preventDefault();
    if (!punchAt) return;
    setSubmitting(true);
    setError(null);
    const result = await recordAttendancePunch({
      employeeUserId,
      punchAt: new Date(punchAt).toISOString(),
      direction,
      note: note || null,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setPunchAt("");
    setNote("");
    reload();
  }

  return (
    <div className="max-w-4xl">
      <div className="flex flex-wrap items-end gap-3 mb-4">
        <select
          value={employeeUserId}
          onChange={(e) => setEmployeeUserId(e.target.value)}
          className="bg-ink2 border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
        >
          {employees.map((emp) => (
            <option key={emp.id} value={emp.id}>
              {emp.email}
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => {
            if (month === 1) {
              setMonth(12);
              setYear((y) => y - 1);
            } else {
              setMonth((m) => m - 1);
            }
          }}
          className="text-sm text-sea hover:text-coral"
        >
          ← Prev
        </button>
        <p className="text-sm text-cream/70 tabular-nums">
          {year}-{String(month).padStart(2, "0")}
        </p>
        <button
          type="button"
          onClick={() => {
            if (month === 12) {
              setMonth(1);
              setYear((y) => y + 1);
            } else {
              setMonth((m) => m + 1);
            }
          }}
          className="text-sm text-sea hover:text-coral"
        >
          Next →
        </button>
      </div>

      {loading && <p className="text-cream/50 text-sm">Loading…</p>}
      {loadError && <p className="text-sm text-coral">{loadError}</p>}

      {!loading && !loadError && (
        <div className="overflow-x-auto mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-cream/40 eyebrow">
                <th className="py-2 pr-4">Date</th>
                <th className="py-2 pr-4">Planned</th>
                <th className="py-2 pr-4">Punches</th>
                <th className="py-2 pr-4">Worked</th>
              </tr>
            </thead>
            <tbody>
              {summaries.map((day) => (
                <tr key={day.date} className="border-t border-cream/10">
                  <td className="py-2 pr-4 tabular-nums">{day.date}</td>
                  <td className="py-2 pr-4 text-cream/70">
                    {day.shiftCode ? (day.plannedIntervals.length ? day.plannedIntervals.map((i) => `${i.startTime}–${i.endTime}`).join(", ") : "OP") : "Day off"}
                  </td>
                  <td className="py-2 pr-4 text-cream/70">
                    {day.punches.length === 0
                      ? "—"
                      : day.punches.map((p) => `${p.direction === "IN" ? "In" : "Out"} ${p.punchAt.slice(11, 16)}`).join(", ")}
                    {day.incomplete && <span className="text-coral ml-2">Incomplete</span>}
                  </td>
                  <td className="py-2 pr-4 tabular-nums">{day.workedMinutes !== null ? minutesToHours(day.workedMinutes) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <form onSubmit={handleRecord} className="bg-ink2/40 border border-cream/10 rounded-xl p-4 space-y-3">
        <p className="eyebrow text-cream/60">Record a punch by hand</p>
        <div className="grid sm:grid-cols-4 gap-3 items-end">
          <div>
            <label className="eyebrow text-cream/60 block mb-1">When</label>
            <input
              type="datetime-local"
              required
              value={punchAt}
              onChange={(e) => setPunchAt(e.target.value)}
              className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
            />
          </div>
          <div>
            <label className="eyebrow text-cream/60 block mb-1">Direction</label>
            <select
              value={direction}
              onChange={(e) => setDirection(e.target.value as PunchDirection)}
              className="w-full bg-ink2 border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
            >
              <option value="IN">In</option>
              <option value="OUT">Out</option>
            </select>
          </div>
          <div className="sm:col-span-2">
            <label className="eyebrow text-cream/60 block mb-1">Note (required to close an incomplete day)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. forgot to clock out"
              className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm placeholder:text-cream/40 focus:outline-none focus:border-coral"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={submitting || !employeeUserId}
          className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-60"
        >
          {submitting ? "Recording…" : "Record punch"}
        </button>
        {error && <p className="text-sm text-coral">{error}</p>}
      </form>
    </div>
  );
}
