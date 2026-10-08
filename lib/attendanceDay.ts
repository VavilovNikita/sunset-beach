// Pure helpers behind the day-correction editor (components/admin/AttendanceDayEditor.tsx).
// A day's punches are corrected as a whole list of HH:mm hotel times (PUT /attendance/day); the
// old punches are voided on the server and kept as history, never deleted.
import type { AttendancePunch } from "@/lib/types";
import { formatTimestampTime } from "@/lib/formatDate";

// The HH:mm hotel time of each punch, in order - the same string the time input holds and the
// endpoint takes, so nothing here goes through a Date in the browser's own zone.
export function punchTimes(punches: AttendancePunch[]): string[] {
  return punches.map((p) => formatTimestampTime(p.punchAt));
}

// null when the list can be sent; otherwise what is wrong with it. Same rules as the server's
// (it re-checks): every time filled in, strictly increasing.
export function validateTimes(times: string[]): string | null {
  for (const t of times) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(t)) return "Fill in every time (or remove the empty row).";
  }
  for (let i = 1; i < times.length; i++) {
    if (times[i] <= times[i - 1]) return "Times must be in increasing order, with no repeats.";
  }
  return null;
}

export function sameTimes(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((t, i) => t === b[i]);
}

// The punches a correction replaced, one entry per correction - what "history" and "restore" show.
// Every punch voided by one correction carries the same voidedAt, so that's the grouping key.
// Oldest replacement first.
export type ReplacedVersion = { voidedAt: string; voidedByEmail: string | null; reason: string; times: string[] };

export function replacedVersions(history: AttendancePunch[]): ReplacedVersion[] {
  const groups = new Map<string, AttendancePunch[]>();
  for (const p of history) {
    if (!p.voidedAt) continue;
    groups.set(p.voidedAt, [...(groups.get(p.voidedAt) ?? []), p]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([voidedAt, punches]) => ({
      voidedAt,
      voidedByEmail: punches[0].voidedByEmail ?? null,
      reason: punches[0].voidReason ?? "",
      times: punchTimes([...punches].sort((x, y) => (x.punchAt < y.punchAt ? -1 : 1))),
    }));
}

export function livePunches(history: AttendancePunch[]): AttendancePunch[] {
  return history.filter((p) => !p.voidedAt);
}
