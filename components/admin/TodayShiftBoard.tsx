"use client";

import { useEffect, useState } from "react";
import { getTodayShiftBoard } from "@/lib/rosterClient";
import { usePolling } from "@/lib/usePolling";
import { chipAppearanceFor, STAFF_AREA_LABELS } from "@/lib/rosterGrid";
import type { TodayShiftState, TodayShiftStatus } from "@/lib/types";

// Same 5s cadence SpaTableMapView already uses for a live floor board glanced at repeatedly
// through a shift - not the tighter cadence an actively-open single record needs, not the looser
// one a background badge can get away with. See usePolling's own comment: it only fires while the
// tab is actually visible, so this never burns requests in a background tab.
const POLL_INTERVAL_MS = 5000;

const STATE_LABEL: Record<TodayShiftState, string> = {
  NOT_YET_ARRIVED: "Not yet arrived",
  SCHEDULED: "Scheduled",
  ARRIVING_SOON: "Arriving soon",
  LATE: "Late",
  ON_SHIFT: "On shift",
  BETWEEN_SHIFTS: "Between shifts",
  FINISHED: "Finished",
  MISSED: "Missed",
};

// Reuses this app's existing semantic colours rather than inventing new ones - see CLAUDE.md's
// colour-meaning discipline. coral is already "late/warning" elsewhere (coverage shortfalls, a
// stale attendance device - AttendanceDeviceManager's own LastSeenLabel) and covers LATE/MISSED
// here too; amber-400 is already "notable and transitional, not quite wrong" (a device never yet
// reached, a live board paused mid-edit) and fits ARRIVING_SOON/BETWEEN_SHIFTS, both "not here
// yet, but nothing's actually wrong"; sea is this app's one positive/active accent (SpaTableMapView's
// own "free" table fill), used here for ON_SHIFT. SCHEDULED/FINISHED/NOT_YET_ARRIVED get the plain
// neutral cream treatment ordinary, unremarkable rows already use throughout the roster screens.
const STATE_BADGE_CLASS: Record<TodayShiftState, string> = {
  NOT_YET_ARRIVED: "bg-cream/10 text-cream/50",
  SCHEDULED: "bg-cream/10 text-cream/60",
  ARRIVING_SOON: "bg-amber-400/20 text-amber-400",
  LATE: "bg-coral/20 text-coral",
  ON_SHIFT: "bg-sea/20 text-sea",
  BETWEEN_SHIFTS: "bg-amber-400/20 text-amber-400",
  FINISHED: "bg-cream/10 text-cream/60",
  MISSED: "bg-coral/20 text-coral",
};

// Sliced straight out of the ISO string, not reformatted through Date/toLocaleTimeString - same
// convention AttendancePanel's own punch list already uses (p.punchAt.slice(11, 16)), so a shift
// time reads the same wherever it appears rather than drifting through the viewer's own browser
// timezone.
function timeLabel(iso: string) {
  return iso.slice(11, 16);
}

// Duration math, unlike timeLabel above, uses real Date arithmetic - a difference between two
// instants is correct regardless of how either one is labelled, the same reasoning
// AttendanceDeviceManager's own staleness check already relies on.
function formatDuration(ms: number) {
  const totalMinutes = Math.max(0, Math.round(ms / 60000));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  return h === 0 ? `${m}m` : `${h}h${m ? ` ${m}m` : ""}`;
}

// referenceTime's meaning switches with state - see TodayShiftStatus's own comment. This is the
// one place that switch is read; re-derived on every render (every poll tick), never cached, so
// the "in 23m" text this produces never goes stale between polls on its own.
function detailFor(status: TodayShiftStatus): string {
  const ref = status.referenceTime;
  if (!ref) return "No punches yet today";
  const now = Date.now();
  const refMs = new Date(ref).getTime();
  switch (status.state) {
    case "NOT_YET_ARRIVED":
      return "No punches yet today";
    case "SCHEDULED":
    case "ARRIVING_SOON":
      return `Starts at ${timeLabel(ref)} — in ${formatDuration(refMs - now)}`;
    case "BETWEEN_SHIFTS":
      return `Back at ${timeLabel(ref)} — in ${formatDuration(refMs - now)}`;
    case "LATE":
      return `${formatDuration(now - refMs)} late for the ${timeLabel(ref)} shift`;
    case "MISSED":
      return `Missed the ${timeLabel(ref)} shift`;
    case "ON_SHIFT":
      return `On shift since ${timeLabel(ref)} (${formatDuration(now - refMs)})`;
    case "FINISHED":
      return `Finished at ${timeLabel(ref)}`;
  }
}

// "Who's on shift right now" - GET /attendance/today, polled. initialStatuses comes from the
// page's own server-side fetch (same pattern SpaTableMapView takes initialMap) so the board isn't
// empty for the few hundred ms before the first poll lands.
export default function TodayShiftBoard({ initialStatuses }: { initialStatuses: TodayShiftStatus[] }) {
  const [statuses, setStatuses] = useState(initialStatuses);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStatuses(initialStatuses);
  }, [initialStatuses]);

  async function refetch() {
    const result = await getTodayShiftBoard();
    if (result.ok) {
      setStatuses(result.data);
      setError(null);
    } else {
      setError(result.error);
    }
  }

  usePolling(refetch, POLL_INTERVAL_MS);

  const sorted = [...statuses].sort((a, b) => a.employeeName.localeCompare(b.employeeName));

  return (
    <div>
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <p className="text-xs text-cream/40 max-w-2xl">Who&rsquo;s on shift right now, live from today&rsquo;s roster and punches.</p>
        <span className="text-xs shrink-0 text-cream/40">Updates every {POLL_INTERVAL_MS / 1000}s</span>
      </div>

      {error && <p className="text-sm text-coral bg-coral/10 border border-coral/30 rounded-xl px-4 py-3 mb-4">{error}</p>}

      {sorted.length === 0 ? (
        <p className="text-sm text-cream/50">No one is scheduled to work today.</p>
      ) : (
        <div className="space-y-1.5">
          {sorted.map((status) => {
            const appearance = chipAppearanceFor(status.shiftCode);
            return (
              <div
                key={status.employeeUserId}
                className="flex items-center gap-3 rounded-xl border border-cream/10 px-4 py-2.5 flex-wrap sm:flex-nowrap"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-cream truncate">{status.employeeName}</p>
                  {status.staffArea && <p className="text-xs text-cream/40">{STAFF_AREA_LABELS[status.staffArea]}</p>}
                </div>
                <span
                  className={`inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs shrink-0 ${
                    appearance ? "" : "bg-ink2/60 border border-cream/10"
                  }`}
                  style={appearance ? { ...appearance.style, color: appearance.textColor } : undefined}
                >
                  {appearance?.glyph && <span aria-hidden="true">{appearance.glyph}</span>}
                  {status.shiftCode.code}
                </span>
                <div className="text-right shrink-0 w-full sm:w-56">
                  <span className={`inline-block rounded-full px-2.5 py-1 text-xs font-medium ${STATE_BADGE_CLASS[status.state]}`}>
                    {STATE_LABEL[status.state]}
                  </span>
                  <p className="text-xs text-cream/40 mt-1">{detailFor(status)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
