"use client";

import { useEffect, useState } from "react";
import { getAttendanceSummary } from "@/lib/rosterClient";
import type { AttendanceDaySummary, RosterEmployee } from "@/lib/types";
import { attendanceCell, totalWorkedMinutes, type AttendanceCellTone } from "@/lib/attendanceMatrix";
import { hotelDateKey, hotelYearMonth } from "@/lib/hotelDate";
import AttendanceDayEditor from "@/components/admin/AttendanceDayEditor";

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
// blank the table. Click a cell to correct that day (AttendanceDayEditor): the old punches are
// voided and kept as history, never deleted. "Today" and the opening month are the hotel's
// (Asia/Bangkok), not this device's.
export default function AttendancePanel({ employees }: { employees: RosterEmployee[] }) {
  const [initial] = useState(() => hotelYearMonth(new Date()));
  const [year, setYear] = useState(initial.year);
  const [month, setMonth] = useState(initial.month);
  const [editing, setEditing] = useState<{ employeeUserId: string; employeeName: string; date: string } | null>(null);
  const [summaries, setSummaries] = useState<Record<string, AttendanceDaySummary[]>>({});
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  const today = hotelDateKey(new Date());
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
                    {emp.name}
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
                          <td key={key} className={`p-0 text-center tabular-nums whitespace-nowrap ${TONE_CLASS[cell.tone]}`}>
                            {key <= today ? (
                              <button
                                type="button"
                                onClick={() => setEditing({ employeeUserId: emp.id, employeeName: emp.name, date: key })}
                                className="block w-full min-w-[3.25rem] px-1.5 py-1.5 hover:bg-cream/10 min-h-[2rem]"
                                title={`Correct ${emp.name}, ${key}`}
                              >
                                {cell.lines.map((line, n) => (
                                  <div key={n}>{line}</div>
                                ))}
                              </button>
                            ) : null}
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
        Click a day to correct it - the old punches stay in its history. Time in – out per day. <span className="text-coral">–?</span> clock-out missing, <span className="text-coral italic">missed</span> scheduled but no punches. Today and future days are never flagged.
      </p>

      {editing && (
        <AttendanceDayEditor
          employeeUserId={editing.employeeUserId}
          employeeName={editing.employeeName}
          date={editing.date}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
    </div>
  );
}
