"use client";

import { useEffect, useState } from "react";
import { correctAttendanceDay, listAttendancePunches } from "@/lib/rosterClient";
import { livePunches, punchTimes, replacedVersions, sameTimes, validateTimes } from "@/lib/attendanceDay";
import { formatDate, formatTimestamp } from "@/lib/formatDate";
import type { AttendancePunch } from "@/lib/types";

// Fixes one employee's one day. Nothing is deleted: saving voids the day's current punches and
// records the new list, and every earlier version stays below with who changed it, when and why -
// so a mistake can be fixed (or the day rolled back to an earlier version) without anything being
// quietly rewritten. Times are HH:mm hotel time end to end: the inputs hold plain strings, the
// server combines them with the date, so this device's own clock or zone never enters into it.
export default function AttendanceDayEditor({
  employeeUserId,
  employeeName,
  date,
  onClose,
  onSaved,
}: {
  employeeUserId: string;
  employeeName: string;
  date: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [history, setHistory] = useState<AttendancePunch[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [times, setTimes] = useState<string[]>([]);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setHistory(null);
    setLoadError(null);
    listAttendancePunches(employeeUserId, date, date, true).then((result) => {
      if (!result.ok) {
        setLoadError(result.error);
        return;
      }
      setHistory(result.data);
      setTimes(punchTimes(livePunches(result.data)));
    });
  }

  useEffect(load, [employeeUserId, date]);

  const live = history ? livePunches(history) : [];
  const currentTimes = punchTimes(live);
  const versions = history ? replacedVersions(history) : [];
  const problem = validateTimes(times);
  const unchanged = sameTimes(times, currentTimes);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (problem || unchanged) return;
    if (!reason.trim()) {
      setError("Say why the day is being corrected.");
      return;
    }
    setSaving(true);
    setError(null);
    const result = await correctAttendanceDay({ employeeUserId, date, times, reason: reason.trim() });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setReason("");
    onSaved();
    load();
  }

  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      <div className="absolute inset-0 pointer-events-auto bg-black/30" onClick={onClose} />
      <div className="absolute top-0 right-0 bottom-0 w-full sm:w-[440px] bg-ink2 border-l border-cream/15 shadow-2xl pointer-events-auto overflow-y-auto p-5 space-y-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="eyebrow text-sea">Correct a day</p>
            <h2 className="font-display italic text-2xl">{employeeName}</h2>
            <p className="text-sm text-cream/60">{formatDate(date)}</p>
          </div>
          <button type="button" onClick={onClose} className="text-cream/50 hover:text-cream text-sm">
            Close
          </button>
        </div>

        {loadError && <p className="text-sm text-coral">{loadError}</p>}
        {!history && !loadError && <p className="text-sm text-cream/50">Loading…</p>}

        {history && (
          <form onSubmit={handleSave} className="space-y-3">
            <p className="text-xs text-cream/50">
              The full list of this day&apos;s punches, hotel time. In and out alternate by order. Saving keeps the old punches in the history below — nothing is deleted.
            </p>
            <ul className="space-y-2">
              {times.map((t, i) => (
                <li key={i} className="flex items-center gap-3">
                  <span className="w-10 text-xs eyebrow text-cream/60">{i % 2 === 0 ? "In" : "Out"}</span>
                  <input
                    type="time"
                    value={t}
                    onChange={(e) => setTimes(times.map((v, n) => (n === i ? e.target.value : v)))}
                    className="bg-transparent border-b border-cream/25 py-1.5 text-cream text-sm focus:outline-none focus:border-coral"
                  />
                  <button type="button" onClick={() => setTimes(times.filter((_, n) => n !== i))} className="text-xs text-cream/40 hover:text-coral">
                    Remove
                  </button>
                </li>
              ))}
              {times.length === 0 && <li className="text-sm text-cream/50">No punches this day.</li>}
            </ul>
            <div className="flex gap-4">
              <button type="button" onClick={() => setTimes([...times, ""])} className="text-sm text-sea hover:text-coral">
                + Add a punch
              </button>
              {times.length > 0 && (
                <button type="button" onClick={() => setTimes([])} className="text-sm text-cream/50 hover:text-coral">
                  Clear the day
                </button>
              )}
              {!unchanged && (
                <button type="button" onClick={() => setTimes(currentTimes)} className="text-sm text-cream/50 hover:text-cream">
                  Reset
                </button>
              )}
            </div>
            {times.length % 2 === 1 && <p className="text-xs text-amber-400">An odd number of punches leaves the day incomplete (no clock-out).</p>}
            {problem && <p className="text-xs text-coral">{problem}</p>}
            <div>
              <label className="eyebrow text-cream/60 block mb-1">Reason (required)</label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. forgot to clock out, typed the wrong time"
                className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm placeholder:text-cream/40 focus:outline-none focus:border-coral"
              />
            </div>
            <button
              type="submit"
              disabled={saving || unchanged || problem !== null}
              className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save correction"}
            </button>
            {error && <p className="text-sm text-coral">{error}</p>}
          </form>
        )}

        {history && (
          <section>
            <p className="eyebrow text-cream/60 mb-2">Now on record</p>
            {live.length === 0 ? (
              <p className="text-sm text-cream/50">No punches.</p>
            ) : (
              <ul className="text-sm space-y-1">
                {live.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3 tabular-nums">
                    <span>
                      {p.direction === "IN" ? "In" : "Out"} {punchTimes([p])[0]}
                    </span>
                    <span className="text-cream/40 text-xs">
                      {p.source === "SCANNER" ? "scanner" : `by hand${p.recordedByEmail ? ` · ${p.recordedByEmail}` : ""}`}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        {history && (
          <section>
            <p className="eyebrow text-cream/60 mb-2">History</p>
            {versions.length === 0 ? (
              <p className="text-sm text-cream/50">This day has never been corrected.</p>
            ) : (
              <ul className="space-y-3">
                {[...versions].reverse().map((v) => (
                  <li key={v.voidedAt} className="rounded-lg border border-cream/10 p-3 text-sm">
                    <p className="tabular-nums text-cream/70 line-through decoration-cream/30">{v.times.length ? v.times.join("  ·  ") : "no punches"}</p>
                    <p className="text-xs text-cream/50 mt-1">
                      Replaced {formatTimestamp(v.voidedAt)}
                      {v.voidedByEmail ? ` by ${v.voidedByEmail}` : ""} — “{v.reason}”
                    </p>
                    <button type="button" onClick={() => setTimes(v.times)} className="mt-1 text-xs text-sea hover:text-coral">
                      Restore these times
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
