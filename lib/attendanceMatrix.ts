// Display rules for the all-employees attendance table (components/admin/AttendancePanel.tsx):
// one cell per employee per day, built from GET /attendance/summary's own per-day rows. Pairing is
// positional (1st+2nd, 3rd+4th ...), the same rule the backend uses for worked minutes.
import type { AttendanceDaySummary } from "@/lib/types";
import { formatTimestampTime } from "@/lib/formatDate";

export type AttendanceCellTone = "empty" | "ok" | "incomplete" | "missed";

export type AttendanceCell = { lines: string[]; tone: AttendanceCellTone };

const EMPTY: AttendanceCell = { lines: [], tone: "empty" };

// today: hotel-local "YYYY-MM-DD". A scheduled day is "missed" only once it is over, and a lone
// punch today is someone still in the house, not a forgotten clock-out - same rules as the
// backend's export.
export function attendanceCell(day: AttendanceDaySummary | undefined, today: string): AttendanceCell {
  if (!day) return EMPTY;
  if (day.punches.length === 0) {
    return day.shiftCode && day.date < today ? { lines: ["missed"], tone: "missed" } : EMPTY;
  }
  const lines: string[] = [];
  for (let i = 0; i < day.punches.length; i += 2) {
    const inTime = formatTimestampTime(day.punches[i].punchAt);
    const out = day.punches[i + 1];
    lines.push(`${inTime}–${out ? formatTimestampTime(out.punchAt) : day.date < today ? "?" : "…"}`);
  }
  const open = day.punches.length % 2 !== 0;
  return { lines, tone: open && day.date < today ? "incomplete" : "ok" };
}

export function totalWorkedMinutes(days: AttendanceDaySummary[]): number {
  return days.reduce((sum, d) => sum + (d.workedMinutes ?? 0), 0);
}
