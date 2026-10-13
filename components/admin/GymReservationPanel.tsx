"use client";

import { useState } from "react";
import { useCloseOnBrowserBack } from "@/lib/useCloseOnBrowserBack";
import { cancelGymReservation, moveGymReservation } from "@/lib/gymScheduleClient";
import { automationSummary, buildSlots, durationLabel, durationOptions, maxDurationAt, type AutomationTone } from "@/lib/gymSchedule";
import { formatDate, formatTimestamp } from "@/lib/formatDate";
import ConfirmActionDialog from "@/components/admin/ConfirmActionDialog";
import type { GymAutomationDeviceResult, GymAutomationPhase, GymReservation, GymSchedule } from "@/lib/types";

const TONE_TEXT: Record<AutomationTone, string> = {
  neutral: "text-cream/70",
  pending: "text-cream/80",
  ok: "text-sea",
  warn: "text-amber-400",
  bad: "text-coral",
};

const SKIP_TEXT: Record<string, string> = {
  COVERED_BY_PREVIOUS: "already on from the previous session",
  NEXT_BOOKING_SOON: "left on for the next session",
  MISSED: "the session was over before it could be switched on",
  CANCELLED: "the reservation was cancelled",
  DEVICE_REMOVED: "device removed or disabled in settings",
};

function resultText(r: GymAutomationDeviceResult): string {
  switch (r.status) {
    case "OK":
      return "done";
    case "FAILED":
      return `failed${r.error ? ` — ${r.error}` : ""} (${r.attempts} ${r.attempts === 1 ? "attempt" : "attempts"})`;
    case "PENDING":
      return r.error ? `retrying — ${r.error}` : "sending…";
    default:
      return r.skipReason ? (SKIP_TEXT[r.skipReason] ?? "not sent") : "not sent";
  }
}

function Phase({ title, phase }: { title: string; phase: GymAutomationPhase | null | undefined }) {
  return (
    <div>
      <p className="eyebrow text-cream/50 mb-1">{title}</p>
      {!phase ? (
        <p className="text-sm text-cream/50">Not yet.</p>
      ) : (
        <ul className="space-y-1">
          {phase.results.map((r) => (
            <li key={r.deviceName} className="text-sm flex gap-2">
              <span aria-hidden className={r.status === "FAILED" ? "text-coral" : r.status === "OK" ? "text-sea" : "text-cream/40"}>
                {r.status === "FAILED" ? "✕" : r.status === "OK" ? "✓" : r.status === "PENDING" ? "…" : "–"}
              </span>
              <span className="min-w-0">
                <span className="text-cream">{r.deviceName}</span> <span className="text-cream/60">{resultText(r)}</span>
              </span>
            </li>
          ))}
        </ul>
      )}
      {phase?.at && <p className="text-xs text-cream/40 mt-1">{formatTimestamp(phase.at)}</p>}
    </div>
  );
}

// Side panel for one reservation clicked on the grid - same shell as SpaAppointmentPanel (no dimming
// backdrop, click outside closes). Shows what the equipment automation did, then the two actions:
// move (date, start, length - once the equipment has been switched on only the length can change,
// the server says so) and cancel (a session in progress is allowed; the equipment goes off by itself).
export default function GymReservationPanel({
  reservation,
  schedule,
  onClose,
  onUpdated,
}: {
  reservation: GymReservation;
  schedule: GymSchedule;
  onClose: () => void;
  onUpdated: () => void;
}) {
  useCloseOnBrowserBack(true, onClose);
  const summary = automationSummary(reservation);
  const booked = reservation.status === "BOOKED";
  const started = Boolean(reservation.automation.switchOn);

  const [moving, setMoving] = useState(false);
  const [date, setDate] = useState(reservation.date);
  const [startTime, setStartTime] = useState(reservation.startTime);
  const [duration, setDuration] = useState(reservation.durationMinutes);
  const [moveBusy, setMoveBusy] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [reason, setReason] = useState("");

  // What fits at the chosen start (the schedule on screen; the server decides). Only meaningful for dates the schedule covers.
  const max = maxDurationAt({
    reservations: schedule.reservations,
    date,
    start: startTime,
    closeTime: schedule.closeTime,
    step: schedule.stepMinutes,
    maxDuration: schedule.maxDurationMinutes,
    maxDaily: schedule.maxDailyMinutes,
    bookingId: reservation.bookingId,
    exceptId: reservation.id,
  });
  const dateOutsideView = date < schedule.from || date > schedule.to;
  const options = dateOutsideView ? durationOptions(schedule.maxDurationMinutes, schedule.stepMinutes) : durationOptions(max, schedule.stepMinutes);
  const startOptions = buildSlots(schedule.openTime, schedule.closeTime, schedule.stepMinutes);

  async function submitMove(e: React.FormEvent) {
    e.preventDefault();
    setMoveBusy(true);
    setMoveError(null);
    const result = await moveGymReservation(reservation.id, { date, startTime, durationMinutes: duration });
    setMoveBusy(false);
    if (!result.ok) {
      setMoveError(result.error);
      return;
    }
    onUpdated();
  }

  const field = "w-full bg-ink border border-cream/20 rounded-lg px-3 min-h-[44px] text-sm";

  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      <div className="absolute inset-0 pointer-events-auto" onClick={onClose} />
      <div
        className="absolute top-0 right-0 bottom-0 w-full sm:w-[400px] bg-ink2 border-l border-cream/15 shadow-2xl pointer-events-auto overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-cream/10 flex items-center justify-between sticky top-0 bg-ink2 z-10">
          <p className="eyebrow text-sea">{reservation.status}</p>
          <button onClick={onClose} aria-label="Close" className="text-cream/50 hover:text-cream transition-colors text-xl leading-none min-w-[44px] min-h-[44px]">
            ×
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <h2 className="font-display italic text-2xl mb-1">{reservation.guestName}</h2>
            <p className="text-sm text-cream/60">
              {reservation.roomLabel ? `Room ${reservation.roomLabel} · ` : ""}
              {formatDate(reservation.date)} · {reservation.startTime}–{reservation.endTime} ({durationLabel(reservation.durationMinutes)})
            </p>
            <p className="text-xs text-cream/40 mt-1">
              Booked by {reservation.createdByName}
              {reservation.createdByType === "GUEST" ? " (guest, from their account)" : " (front desk)"} · {formatTimestamp(reservation.createdAt)}
            </p>
            {reservation.status === "CANCELLED" && (
              <p className="text-sm text-cream/60 mt-2">
                Cancelled{reservation.cancelledBy ? ` by ${reservation.cancelledBy}` : ""}
                {reservation.cancelReason ? ` — ${reservation.cancelReason}` : ""}.
              </p>
            )}
          </div>

          <div className="bg-ink/40 border border-cream/10 rounded-lg p-3">
            <p className="eyebrow text-cream/50 mb-1">Equipment</p>
            <p className={`text-sm font-medium ${TONE_TEXT[summary.tone]}`}>{summary.label}</p>
            {summary.problems.length > 0 && (
              <ul className="mt-1 space-y-0.5">
                {summary.problems.map((p) => (
                  <li key={p} className="text-xs text-coral">
                    {p}
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 space-y-3">
              <Phase title="Switch-on" phase={reservation.automation.switchOn} />
              <Phase title="Switch-off" phase={reservation.automation.switchOff} />
            </div>
            <p className="text-xs text-cream/40 mt-3">
              The equipment is switched by the system only at these two moments. If a device failed, switch it by hand on the Gym page.
            </p>
          </div>

          {booked && !moving && (
            <div className="flex gap-3 flex-wrap">
              <button
                type="button"
                onClick={() => setMoving(true)}
                className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-5 min-h-[44px] text-sm font-medium"
              >
                {started ? "Change length" : "Move"}
              </button>
              <button
                type="button"
                onClick={() => setConfirmCancel(true)}
                className="rounded-full border border-coral/60 text-coral hover:bg-coral/10 transition-colors px-5 min-h-[44px] text-sm font-medium"
              >
                Cancel reservation
              </button>
            </div>
          )}

          {booked && moving && (
            <form onSubmit={submitMove} className="space-y-3">
              <p className="eyebrow text-cream/60">{started ? "Change the length" : "Move to"}</p>
              {started && (
                <p className="text-xs text-cream/50">The equipment has already been switched on for this reservation, so only its length can change.</p>
              )}
              <div>
                <label htmlFor="gym-move-date" className="text-xs text-cream/60 block mb-1">
                  Date
                </label>
                <input id="gym-move-date" type="date" value={date} disabled={started} onChange={(e) => e.target.value && setDate(e.target.value)} className={field} />
              </div>
              <div>
                <label htmlFor="gym-move-start" className="text-xs text-cream/60 block mb-1">
                  Start
                </label>
                <select id="gym-move-start" value={startTime} disabled={started} onChange={(e) => setStartTime(e.target.value)} className={field}>
                  {startOptions.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="gym-move-duration" className="text-xs text-cream/60 block mb-1">
                  Length
                </label>
                <select id="gym-move-duration" value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={field}>
                  {[...new Set([...options, duration])]
                    .sort((a, b) => a - b)
                    .map((d) => (
                      <option key={d} value={d} disabled={!options.includes(d)}>
                        {durationLabel(d)}
                      </option>
                    ))}
                </select>
                {!dateOutsideView && max === 0 && <p className="text-xs text-coral mt-1">That slot is taken or the booking has no time left that day.</p>}
              </div>
              {moveError && <p className="text-sm text-coral">{moveError}</p>}
              <div className="flex gap-3">
                <button
                  type="submit"
                  disabled={moveBusy}
                  className="flex-1 rounded-full bg-coral hover:bg-coraldeep transition-colors min-h-[44px] text-sm font-medium disabled:opacity-60"
                >
                  {moveBusy ? "Saving…" : "Save"}
                </button>
                <button
                  type="button"
                  disabled={moveBusy}
                  onClick={() => {
                    setMoving(false);
                    setMoveError(null);
                    setDate(reservation.date);
                    setStartTime(reservation.startTime);
                    setDuration(reservation.durationMinutes);
                  }}
                  className="flex-1 rounded-full border border-cream/25 hover:border-cream/50 transition-colors min-h-[44px] text-sm font-medium disabled:opacity-60"
                >
                  Back
                </button>
              </div>
            </form>
          )}
        </div>
      </div>

      {confirmCancel && (
        <div className="pointer-events-auto">
          <ConfirmActionDialog
            eyebrow="Cancel reservation"
            title={`Cancel ${reservation.guestName}'s gym session?`}
            confirmLabel="Cancel reservation"
            busyLabel="Cancelling…"
            backLabel="Keep it"
            action={async () => {
              const result = await cancelGymReservation(reservation.id, reason);
              return result.ok ? null : result.error;
            }}
            onDone={onUpdated}
            onBack={() => setConfirmCancel(false)}
          >
            <p className="text-sm text-cream/70 mb-3">
              {formatDate(reservation.date)} · {reservation.startTime}–{reservation.endTime}.
              {started ? " The equipment is already on — the system switches it off within a minute unless another session starts soon." : ""}
            </p>
            <label htmlFor="gym-cancel-reason" className="text-xs text-cream/60 block mb-1">
              Reason (optional)
            </label>
            <input
              id="gym-cancel-reason"
              value={reason}
              maxLength={300}
              onChange={(e) => setReason(e.target.value)}
              className="w-full bg-ink border border-cream/20 rounded-lg px-3 min-h-[44px] text-sm"
            />
          </ConfirmActionDialog>
        </div>
      )}
    </div>
  );
}
