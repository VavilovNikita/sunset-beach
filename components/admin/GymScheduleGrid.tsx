"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatDate } from "@/lib/formatDate";
import { hotelDateKey } from "@/lib/hotelDate";
import { usePolling } from "@/lib/usePolling";
import {
  automationSummary,
  buildSlots,
  gridRange,
  holdsSlot,
  isSlotBookableByStaff,
  isSlotWithinHours,
  shiftDate,
  slotIndexOf,
  spanOf,
  visibleDays,
  type AutomationTone,
} from "@/lib/gymSchedule";
import GymReservationCreateModal from "@/components/admin/GymReservationCreateModal";
import GymReservationPanel from "@/components/admin/GymReservationPanel";
import type { GymReservation, GymSchedule } from "@/lib/types";

const COL_WIDTH = 44; // a slot is one 44px column: a free cell is a 44px touch target
const LABEL_WIDTH = 118;

const STATUS_STYLES: Record<GymReservation["status"], string> = {
  BOOKED: "bg-sea text-ink",
  COMPLETED: "bg-green-600 text-cream",
  // Shape, not a new colour (the palette is full): a dashed outline over hatching and a ✕ mark.
  CANCELLED: "text-cream/50 border border-dashed border-cream/40",
};

const CANCELLED_HATCH = "repeating-linear-gradient(-45deg, rgba(245,239,230,0.10) 0px 5px, rgba(245,239,230,0.02) 5px 10px)";

// What the equipment automation did, as a small mark on the block: the tone is the worst of
// switch-on and switch-off. amber-400 is "attention", coral "needs intervention" - their usual meanings.
const TONE_MARK: Record<AutomationTone, { icon: string; className: string; short: string } | null> = {
  neutral: null,
  pending: { icon: "…", className: "bg-ink/30", short: "switching" },
  ok: { icon: "⚡", className: "bg-ink/25", short: "on" },
  warn: { icon: "⚠", className: "bg-amber-400 text-ink", short: "partly" },
  bad: { icon: "✕", className: "bg-coral text-cream", short: "error" },
};

function weekdayShort(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", timeZone: "UTC" });
}

export default function GymScheduleGrid({
  schedule,
  date,
  view,
  showCancelled,
}: {
  schedule: GymSchedule;
  date: string;
  view: "day" | "week";
  showCancelled: boolean;
}) {
  const router = useRouter();
  // Wider than the opening hours when narrowed hours left a reservation outside them - it stays visible.
  const range = gridRange(schedule);
  const slots = buildSlots(range.open, range.close, schedule.stepMinutes);
  const days = visibleDays(date, view);
  const rowHeight = view === "day" ? 96 : 56;
  const todayKey = hotelDateKey(new Date());

  const [createTarget, setCreateTarget] = useState<{ date: string; startTime: string } | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = schedule.reservations.find((r) => r.id === selectedId) ?? null;

  // The automation changes a reservation's status behind the screen's back (switch-on, switch-off,
  // a retry), so the schedule refetches itself now and then - and when the tab comes back. Not while
  // a form is open: a refresh must never pull the slot out from under a half-filled booking.
  usePolling(() => router.refresh(), 60_000, createTarget === null);

  function go(next: { date?: string; view?: "day" | "week"; cancelled?: boolean }) {
    const params = new URLSearchParams({ date: next.date ?? date, view: next.view ?? view });
    if (next.cancelled ?? showCancelled) params.set("cancelled", "1");
    router.push(`/admin/gym/schedule?${params.toString()}`);
  }

  const heading =
    view === "week" ? `${formatDate(days[0])} – ${formatDate(days[6])}` : `${weekdayShort(date)}, ${formatDate(date)}`;

  const button = "rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-4 min-h-[44px] text-sm inline-flex items-center";

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <button type="button" onClick={() => go({ date: shiftDate(date, view, -1) })} className={button}>
          ← Prev {view}
        </button>
        <span className="text-sm text-cream/70 font-medium">{heading}</span>
        <button type="button" onClick={() => go({ date: shiftDate(date, view, 1) })} className={button}>
          Next {view} →
        </button>
        <button type="button" onClick={() => go({ date: todayKey })} disabled={days.includes(todayKey)} className={`${button} disabled:opacity-40`}>
          Today
        </button>
        <input
          type="date"
          value={date}
          onChange={(e) => e.target.value && go({ date: e.target.value })}
          aria-label="Go to date"
          className="bg-ink2 border border-cream/20 rounded-lg px-3 min-h-[44px] text-sm"
        />
        <div className="flex items-center gap-2 ml-auto flex-wrap" role="group" aria-label="View">
          {(["day", "week"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={view === v}
              onClick={() => go({ view: v })}
              className={`${button} ${view === v ? "bg-coral border-coral text-cream" : ""}`}
            >
              {v === "day" ? "Day" : "Week"}
            </button>
          ))}
          <label className="flex items-center gap-2 text-sm text-cream/60 min-h-[44px] cursor-pointer">
            <input type="checkbox" checked={showCancelled} onChange={(e) => go({ cancelled: e.target.checked })} className="w-4 h-4" />
            Show cancelled
          </label>
        </div>
      </div>

      <div className="overflow-auto border border-cream/10 rounded-xl">
        <div style={{ width: LABEL_WIDTH + slots.length * COL_WIDTH }}>
          <div className="flex sticky top-0 z-20 bg-ink2 border-b border-cream/10">
            <div className="sticky left-0 z-30 bg-ink2 shrink-0" style={{ width: LABEL_WIDTH }} />
            {slots.map((c) => (
              <div
                key={c}
                className="shrink-0 text-center text-[10px] text-cream/40 py-1.5 border-r border-cream/5"
                style={{ width: COL_WIDTH }}
              >
                {c}
              </div>
            ))}
          </div>

          {days.map((day) => {
            const dayReservations = schedule.reservations.filter((r) => r.date === day);
            const occupied = new Set<number>();
            for (const r of dayReservations) {
              if (!holdsSlot(r)) continue;
              const start = slotIndexOf(r.startTime, range.open, schedule.stepMinutes);
              const span = spanOf(r.durationMinutes, schedule.stepMinutes);
              for (let i = start; i < start + span; i++) occupied.add(i);
            }
            // Cancelled blocks first so a live reservation in the same slot is drawn on top of them.
            const ordered = [...dayReservations].sort((a, b) => Number(holdsSlot(a)) - Number(holdsSlot(b)));

            return (
              <div key={day} className="flex border-b border-cream/5 relative" style={{ height: rowHeight }}>
                <div
                  className={`sticky left-0 z-10 shrink-0 flex flex-col justify-center px-3 text-sm ${day === todayKey ? "bg-ink2 text-cream" : "bg-ink text-cream/80"}`}
                  style={{ width: LABEL_WIDTH }}
                >
                  <span>{weekdayShort(day)}</span>
                  <span className="text-xs text-cream/50">{formatDate(day)}</span>
                </div>
                <div className="relative shrink-0" style={{ width: slots.length * COL_WIDTH, height: rowHeight }}>
                  {slots.map((c, i) => {
                    const inHours = isSlotWithinHours(c, schedule.stepMinutes, schedule.openTime, schedule.closeTime);
                    const bookable = inHours && !occupied.has(i) && isSlotBookableByStaff(day, c, schedule.stepMinutes, new Date());
                    return (
                      <button
                        key={c}
                        type="button"
                        disabled={!bookable}
                        onClick={() => setCreateTarget({ date: day, startTime: c })}
                        className={`absolute top-0 bottom-0 border-r border-cream/5 ${bookable ? "hover:bg-cream/5 cursor-cell" : ""} ${inHours ? "" : "bg-ink/60"}`}
                        title={inHours ? undefined : "Outside the opening hours"}
                        style={{ left: i * COL_WIDTH, width: COL_WIDTH }}
                        aria-label={`Reserve ${formatDate(day)} at ${c}`}
                      />
                    );
                  })}

                  {ordered.map((r) => {
                    const start = slotIndexOf(r.startTime, range.open, schedule.stepMinutes);
                    const span = spanOf(r.durationMinutes, schedule.stepMinutes);
                    const summary = automationSummary(r);
                    const mark = r.status === "CANCELLED" ? null : TONE_MARK[summary.tone];
                    const cancelled = r.status === "CANCELLED";
                    return (
                      <button
                        key={r.id}
                        type="button"
                        onClick={() => setSelectedId(r.id)}
                        className={`absolute rounded-md flex flex-col justify-center gap-0.5 px-2 text-xs text-left overflow-hidden ${STATUS_STYLES[r.status]} ${
                          selectedId === r.id ? "ring-2 ring-cream" : ""
                        }`}
                        style={{
                          left: start * COL_WIDTH + 2,
                          width: span * COL_WIDTH - 4,
                          top: 4,
                          height: rowHeight - 8,
                          backgroundImage: cancelled ? CANCELLED_HATCH : undefined,
                        }}
                        title={`${r.guestName}${r.roomLabel ? ` · room ${r.roomLabel}` : ""} · ${r.startTime}–${r.endTime}${
                          cancelled ? " · cancelled" : ` · ${summary.label}`
                        }`}
                      >
                        <span className="flex items-center gap-1 min-w-0">
                          {cancelled && <span aria-label="Cancelled">✕</span>}
                          <span className={`truncate font-medium ${cancelled ? "line-through" : ""}`}>{r.guestName}</span>
                          {r.roomLabel && <span className="shrink-0 text-[10px] rounded px-1 bg-ink/25">{r.roomLabel}</span>}
                        </span>
                        {view === "day" && (
                          <span className="text-[10px] opacity-80 truncate">
                            {r.startTime}–{r.endTime}
                          </span>
                        )}
                        {mark && (
                          <span className={`self-start inline-flex items-center gap-1 rounded px-1 text-[10px] ${mark.className}`} aria-label={summary.label}>
                            <span aria-hidden>{mark.icon}</span>
                            {span >= 3 && <span className="truncate">{mark.short}</span>}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {range.open !== schedule.openTime || range.close !== schedule.closeTime ? (
        <p className="text-xs text-amber-400 mt-3">
          The gym is open {schedule.openTime}–{schedule.closeTime}. The shaded columns are outside those hours - a reservation made earlier still stands there.
        </p>
      ) : null}
      <p className="text-xs text-cream/40 mt-3">
        Marks on a reservation: ⚡ equipment switched on · ⚠ partly (some device failed) · ✕ error · … in progress. Open a reservation for details.
      </p>

      {createTarget && (
        <GymReservationCreateModal
          schedule={schedule}
          date={createTarget.date}
          startTime={createTarget.startTime}
          onClose={() => setCreateTarget(null)}
          onCreated={() => {
            setCreateTarget(null);
            router.refresh();
          }}
        />
      )}

      {selected && (
        <GymReservationPanel
          reservation={selected}
          schedule={schedule}
          onClose={() => setSelectedId(null)}
          onUpdated={() => {
            setSelectedId(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
