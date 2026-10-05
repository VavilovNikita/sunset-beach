"use client";

import { useEffect, useState } from "react";
import { getAttendanceSummary, recordAttendancePunch } from "@/lib/rosterClient";
import type { AttendanceDaySummary, PunchDirection, RosterEmployee } from "@/lib/types";
import { attendanceCell, hotelToday, totalWorkedMinutes, type AttendanceCellTone } from "@/lib/attendanceMatrix";

const NOW = new Date();

function minutesToHours(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}h${m ? ` ${m}m` : ""}`;
}

const TONE_CLASS: Record<AttendanceCellTone, string> = {
  empty: "",
  ok: "text-cream/80",
  incomplete: "text-coral font-medium",
  missed: "text-coral italic",
};

// Every employee at once: rows are people, columns are days of the month, a cell holds that day's
// punches (paired at read time - see AttendanceDaySummary's own description). One summary request
// per employee, in parallel; one person failing to load is shown on their own row and doesn't
// blank the table. An incomplete day (odd punch count) is closed only by recording another punch
// below, with a note; there is no separate "correction" action.
export default function AttendancePanel({ employees }: { employees: RosterEmployee[] }) {
  const [employeeUserId, setEmployeeUserId] = useState(employees[0]?.id ?? "");
  const [year, setYear] = useState(NOW.getFullYear());
  const [month, setMonth] = useState(NOW.getMonth() + 1);
  const [summaries, setSummaries] = useState<Record<string, AttendanceDaySummary[]>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const [punchAt, setPunchAt] = useState("");
  const [direction, setDirection] = useState<PunchDirection>("IN");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const today = hotelToday(NOW);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

  function reload() {
    let cancelled = false;
    setLoading(true);
    Promise.all(employees.map((emp) => getAttendanceSummary(emp.id, year, month).then((result) => [emp.id, result] as const))).then((results) => {
      if (cancelled) return;
      const data: Record<string, AttendanceDaySummary[]> = {};
      const errors: Record<string, string> = {};
      for (const [id, result] of results) {
        if (result.ok) data[id] = result.data;
        else errors[id] = result.error;
      }
      setSummaries(data);
      setRowErrors(errors);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }

  useEffect(reload, [year, month, employees]);

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
    <div>
      <div className="flex flex-wrap items-end gap-3 mb-4">
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

      {loading && <p className="text-cream/50 text-sm mb-2">Loading…</p>}

      <div className="overflow-x-auto mb-2">
        <table className="text-xs border-collapse">
          <thead>
            <tr className="text-cream/40">
              <th className="sticky left-0 z-10 bg-ink text-left py-2 pr-3 font-normal eyebrow">Employee</th>
              {Array.from({ length: daysInMonth }, (_, i) => {
                const key = `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
                const weekday = new Date(Date.UTC(year, month - 1, i + 1)).getUTCDay();
                return (
                  <th key={key} className={`px-1.5 py-2 text-center font-normal tabular-nums ${key === today ? "text-sea" : ""} ${weekday === 0 || weekday === 6 ? "bg-cream/5" : ""}`}>
                    {i + 1}
                    <div className="text-[10px]">{["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"][weekday]}</div>
                  </th>
                );
              })}
              <th className="px-2 py-2 text-right font-normal eyebrow">Total</th>
            </tr>
          </thead>
          <tbody>
            {employees.map((emp) => {
              const days = summaries[emp.id];
              const byDate = new Map((days ?? []).map((d) => [d.date, d]));
              return (
                <tr key={emp.id} className="border-t border-cream/10 align-top">
                  <td className="sticky left-0 z-10 bg-ink py-1.5 pr-3 whitespace-nowrap text-sm">
                    <button type="button" onClick={() => setEmployeeUserId(emp.id)} className="hover:text-coral text-left" title="Select for manual punch">
                      {emp.name}
                    </button>
                  </td>
                  {rowErrors[emp.id] ? (
                    <td colSpan={daysInMonth + 1} className="py-1.5 text-coral">
                      {rowErrors[emp.id]}
                    </td>
                  ) : (
                    <>
                      {Array.from({ length: daysInMonth }, (_, i) => {
                        const key = `${year}-${String(month).padStart(2, "0")}-${String(i + 1).padStart(2, "0")}`;
                        const cell = attendanceCell(byDate.get(key), today);
                        return (
                          <td key={key} className={`px-1.5 py-1.5 text-center tabular-nums whitespace-nowrap ${TONE_CLASS[cell.tone]}`}>
                            {cell.lines.map((line, n) => (
                              <div key={n}>{line}</div>
                            ))}
                          </td>
                        );
                      })}
                      <td className="px-2 py-1.5 text-right tabular-nums whitespace-nowrap">{days ? minutesToHours(totalWorkedMinutes(days)) : "—"}</td>
                    </>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-cream/40 mb-6">
        Time in – out per day. <span className="text-coral">–?</span> clock-out missing, <span className="text-coral italic">missed</span> scheduled but no punches. Today and future days are never flagged.
      </p>

      <form onSubmit={handleRecord} className="max-w-4xl bg-ink2/40 border border-cream/10 rounded-xl p-4 space-y-3">
        <p className="eyebrow text-cream/60">Record a punch by hand</p>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Employee</label>
          <select
            value={employeeUserId}
            onChange={(e) => setEmployeeUserId(e.target.value)}
            className="bg-ink2 border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
          >
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.name}
              </option>
            ))}
          </select>
        </div>
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
