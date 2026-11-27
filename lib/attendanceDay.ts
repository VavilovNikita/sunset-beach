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

// The day as it was before each correction, one entry per correction - what "history" and "restore" show. Oldest first.
// A correction is known by what it voided (voidedByCorrectionId) and by what it recorded (correctionId): a correction
// of an empty day voids nothing, and grouping voided punches alone called such a day "never corrected". Its entry has
// no times - the day was empty.
export type ReplacedVersion = { id: string; correctedAt: string; correctedByEmail: string | null; reason: string; times: string[] };

export function replacedVersions(history: AttendancePunch[]): ReplacedVersion[] {
  const corrections = new Map<string, { voided: AttendancePunch[]; recorded: AttendancePunch[] }>();
  const of = (id: string) => {
    const found = corrections.get(id) ?? { voided: [], recorded: [] };
    corrections.set(id, found);
    return found;
  };
  for (const p of history) {
    if (p.voidedAt) of(p.voidedByCorrectionId ?? p.voidedAt).voided.push(p);
    if (p.correctionId) of(p.correctionId).recorded.push(p);
  }
  return [...corrections.entries()]
    .map(([id, { voided, recorded }]) => ({
      id,
      correctedAt: voided[0]?.voidedAt ?? recorded[0].createdAt,
      correctedByEmail: voided[0]?.voidedByEmail ?? recorded[0]?.recordedByEmail ?? null,
      reason: voided[0]?.voidReason ?? recorded[0]?.note ?? "",
      times: punchTimes([...voided].sort((x, y) => (x.punchAt < y.punchAt ? -1 : 1))),
    }))
    .sort((a, b) => (a.correctedAt < b.correctedAt ? -1 : a.correctedAt > b.correctedAt ? 1 : 0));
}

export function livePunches(history: AttendancePunch[]): AttendancePunch[] {
  return history.filter((p) => !p.voidedAt);
}
