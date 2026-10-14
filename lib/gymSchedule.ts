// Pure helpers for the gym schedule (components/admin/GymScheduleGrid.tsx and friends) and for the
// guest's gym page. The numbers that are rules (30-minute grid, 30-120 minutes, 120 a day) come from
// the server's GymSchedule/GymGuestInfo, never from constants here - these functions only do the
// arithmetic with them. The server still decides every booking; this is what the screens already
// know, so a slot that cannot work is not offered.
import { addDaysToDateKey } from "@/lib/hotelDate";
import type { GymAutomation, GymAutomationPhase, GymHallSettings, GymReservation } from "@/lib/types";

export function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function toHHMM(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

// One column per slot in [open, close).
export function buildSlots(open: string, close: string, step: number): string[] {
  const slots: string[] = [];
  for (let t = toMinutes(open); t + step <= toMinutes(close); t += step) slots.push(toHHMM(t));
  return slots;
}

export function slotIndexOf(time: string, open: string, step: number): number {
  return Math.round((toMinutes(time) - toMinutes(open)) / step);
}

export function spanOf(durationMinutes: number, step: number): number {
  return Math.max(1, Math.ceil(durationMinutes / step));
}

// The hotel's wall clock for a given instant (Asia/Bangkok), as the date key and HH:mm the schedule
// compares against - never the browser's zone.
export function hotelNow(now: Date): { date: string; time: string } {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return { date: `${get("year")}-${get("month")}-${get("day")}`, time: `${get("hour")}:${get("minute")}` };
}

// Monday-first week containing `date`, as seven date keys. Computed on UTC dates, no zone involved.
export function weekDays(date: string): string[] {
  const [y, m, d] = date.split("-").map(Number);
  const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay(); // 0 Sunday .. 6 Saturday
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const monday = addDaysToDateKey(date, mondayOffset);
  return Array.from({ length: 7 }, (_, i) => addDaysToDateKey(monday, i));
}

export function visibleDays(date: string, view: "day" | "week"): string[] {
  return view === "week" ? weekDays(date) : [date];
}

// Step by a day or a week depending on the view.
export function shiftDate(date: string, view: "day" | "week", direction: -1 | 1): string {
  return addDaysToDateKey(date, direction * (view === "week" ? 7 : 1));
}

// BOOKED and COMPLETED hold the slot (the server's exclusion constraint is scoped to them).
export function holdsSlot(r: Pick<GymReservation, "status">): boolean {
  return r.status === "BOOKED" || r.status === "COMPLETED";
}

// A slot staff may still book: it has not fully passed (the half hour that is running now counts -
// the server allows it for the front desk).
export function isSlotBookableByStaff(date: string, slotStart: string, step: number, now: Date): boolean {
  const n = hotelNow(now);
  if (date !== n.date) return date > n.date;
  return toMinutes(slotStart) + step > toMinutes(n.time);
}

// Minutes of gym time a hotel booking already holds on a date (optionally leaving one reservation out - the one being moved).
export function usedMinutes(reservations: GymReservation[], bookingId: string, date: string, exceptId?: string): number {
  return reservations
    .filter((r) => holdsSlot(r) && r.bookingId === bookingId && r.date === date && r.id !== exceptId)
    .reduce((sum, r) => sum + r.durationMinutes, 0);
}

// The longest session that can start at `start` on `date`: stopped by closing time, by the next
// reservation, by 120 minutes in all and by what is left of the booking's daily allowance. 0 when
// the slot itself is taken. A multiple of the step.
export function maxDurationAt(params: {
  reservations: GymReservation[];
  date: string;
  start: string;
  closeTime: string;
  step: number;
  maxDuration: number;
  maxDaily: number;
  bookingId?: string;
  exceptId?: string;
}): number {
  const { reservations, date, start, closeTime, step, maxDuration, maxDaily, bookingId, exceptId } = params;
  const startMin = toMinutes(start);
  const others = reservations.filter((r) => holdsSlot(r) && r.date === date && r.id !== exceptId);
  const taken = others.some((r) => toMinutes(r.startTime) < startMin + step && toMinutes(r.endTime) > startMin);
  if (taken) return 0;
  const nextStart = others.map((r) => toMinutes(r.startTime)).filter((s) => s >= startMin + step).sort((a, b) => a - b)[0];
  const untilNext = nextStart === undefined ? Infinity : nextStart - startMin;
  const left = bookingId ? maxDaily - usedMinutes(reservations, bookingId, date, exceptId) : maxDaily;
  const longest = Math.min(maxDuration, left, toMinutes(closeTime) - startMin, untilNext);
  return Math.max(0, Math.floor(longest / step) * step);
}

export function durationOptions(max: number, step: number): number[] {
  const options: number[] = [];
  for (let d = step; d <= max; d += step) options.push(d);
  return options;
}

export function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

// ---- what the automation did, in words ----

// What GET /gym/status says about the equipment side. With no Tuya keys, or no device that bookings
// switch, a reservation's equipment is never touched - a screen says the automation is not set up
// rather than "not switched on yet", which reads like something that is still going to happen.
export type GymSetup = { tuyaConfigured: boolean; automatedDeviceCount: number };

export function automationNotSetUp(setup: GymSetup | null | undefined): boolean {
  return setup != null && (!setup.tuyaConfigured || setup.automatedDeviceCount === 0);
}

export type AutomationTone = "neutral" | "pending" | "ok" | "warn" | "bad";

export type AutomationSummary = {
  tone: AutomationTone;
  label: string;
  // One line per device that did not do what was needed (name and the reason) - empty when all is well.
  problems: string[];
};

const TONE_RANK: Record<AutomationTone, number> = { neutral: 0, ok: 1, pending: 2, warn: 3, bad: 4 };

function worst(a: AutomationTone, b: AutomationTone): AutomationTone {
  return TONE_RANK[b] > TONE_RANK[a] ? b : a;
}

function failedLines(phase: GymAutomationPhase | null | undefined): string[] {
  if (!phase) return [];
  return phase.results
    .filter((r) => r.status === "FAILED" || (r.status === "PENDING" && r.error))
    .map((r) => `${r.deviceName}${r.error ? ` — ${r.error}` : ""}${r.status === "PENDING" ? " (will retry)" : ""}`);
}

function failedNames(phase: GymAutomationPhase): string {
  return phase.results
    .filter((r) => r.status === "FAILED")
    .map((r) => r.deviceName)
    .join(", ");
}

function skippedReason(phase: GymAutomationPhase): string | null {
  const reasons = new Set(phase.results.map((r) => r.skipReason).filter(Boolean));
  if (reasons.has("MISSED")) return "missed";
  if (reasons.has("NEXT_BOOKING_SOON")) return "next-session";
  if (reasons.has("CANCELLED")) return "cancelled";
  if (reasons.has("DEVICE_REMOVED")) return "removed";
  return null;
}

// The headline for a reservation's block and panel: switched on / partly (with who failed) / error,
// then the switch-off once it has happened. The tone is the worst of both phases, the label the latest.
export function automationSummary(r: Pick<GymReservation, "status" | "automation">, setup?: GymSetup | null): AutomationSummary {
  const { switchOn, switchOff } = r.automation as GymAutomation;
  const problems = [...failedLines(switchOn), ...failedLines(switchOff)];
  let tone: AutomationTone = "neutral";
  let label: string;

  if (!switchOn) {
    label =
      r.status === "CANCELLED"
        ? "Cancelled — equipment untouched"
        : r.status === "COMPLETED"
          ? "No equipment switched"
          : automationNotSetUp(setup)
            ? "Automation not set up"
            : "Equipment not switched on yet";
    return { tone, label, problems };
  }

  switch (switchOn.state) {
    case "PENDING":
      tone = "pending";
      label = problems.length > 0 ? "Switching on — retrying a device" : "Switching on…";
      break;
    case "OK":
      tone = "ok";
      label = "Equipment on";
      break;
    case "PARTIAL":
      tone = "warn";
      label = `Partly on — failed: ${failedNames(switchOn)}`;
      break;
    case "FAILED":
      tone = "bad";
      label = "Switch-on failed";
      break;
    default:
      tone = skippedReason(switchOn) === "missed" ? "warn" : "neutral";
      label = skippedReason(switchOn) === "missed" ? "Not switched on — the session was over by then" : "Equipment not switched on";
  }

  if (switchOff) {
    switch (switchOff.state) {
      case "PENDING":
        tone = worst(tone, "pending");
        label = "Switching off…";
        break;
      case "OK":
        label = tone === "ok" ? "Equipment off — done" : `${label}; switched off`;
        break;
      case "PARTIAL":
        tone = worst(tone, "warn");
        label = `Switch-off partly failed — still on: ${failedNames(switchOff)}`;
        break;
      case "FAILED":
        tone = worst(tone, "bad");
        label = "Switch-off failed — equipment may still be on";
        break;
      default:
        label = skippedReason(switchOff) === "next-session" ? "Left on for the next session" : label;
    }
  }
  return { tone, label, problems };
}

// The same checks the server makes on PUT /gym/settings/hall, so an obviously wrong form says so
// before it is sent. Returns the first problem in words, or null. The server still decides.
export function hallSettingsProblem(s: GymHallSettings, step = 30): string | null {
  const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
  if (!timePattern.test(s.openTime) || !timePattern.test(s.closeTime)) return "Enter the opening and closing time like 06:00.";
  if (toMinutes(s.openTime) % step !== 0 || toMinutes(s.closeTime) % step !== 0) return `Times must be on the ${step}-minute grid (:00 or :30).`;
  if (toMinutes(s.openTime) >= toMinutes(s.closeTime)) return "The gym must open before it closes.";
  if (!Number.isInteger(s.leadMinutes) || s.leadMinutes < 0 || s.leadMinutes > 180) return "Switch-on lead time must be 0 to 180 minutes.";
  if (!Number.isInteger(s.acTemp) || s.acTemp < 16 || s.acTemp > 30) return "Air conditioner temperature must be 16 to 30 degrees.";
  if (![0, 1, 2, 3, 4].includes(s.acMode)) return "Pick an air conditioner mode.";
  if (![0, 1, 2, 3].includes(s.acWind)) return "Pick an air conditioner fan speed.";
  return null;
}

// The dates a guest can pick for a stay: from today (or check-in, if later) to the departure day,
// which is still part of the stay. null when the stay is already over.
export function guestDateBounds(stay: { checkIn: string; checkOut: string }, today: string): { min: string; max: string } | null {
  const min = stay.checkIn > today ? stay.checkIn : today;
  return min > stay.checkOut ? null : { min, max: stay.checkOut };
}

// A guest's date, kept inside what the stay allows (a stale or typed value falls back to the nearest day).
export function clampGuestDate(date: string, bounds: { min: string; max: string }): string {
  if (date < bounds.min) return bounds.min;
  if (date > bounds.max) return bounds.max;
  return date;
}

// The columns the schedule shows: the opening hours, widened to take in any reservation outside them
// (the owner narrowed the hours over existing bookings - they must stay visible, not vanish off the
// edge of the grid). Rounded outwards to the step. Cancelled ones count too when they are shown.
export function gridRange(schedule: { openTime: string; closeTime: string; stepMinutes: number; reservations: Pick<GymReservation, "startTime" | "endTime">[] }): {
  open: string;
  close: string;
} {
  const step = schedule.stepMinutes;
  let open = toMinutes(schedule.openTime);
  let close = toMinutes(schedule.closeTime);
  for (const r of schedule.reservations) {
    open = Math.min(open, Math.floor(toMinutes(r.startTime) / step) * step);
    close = Math.max(close, Math.ceil(toMinutes(r.endTime) / step) * step);
  }
  return { open: toHHMM(open), close: toHHMM(close) };
}

// Whether a slot lies inside the opening hours (outside ones are shown but cannot be booked).
export function isSlotWithinHours(slot: string, step: number, openTime: string, closeTime: string): boolean {
  const start = toMinutes(slot);
  return start >= toMinutes(openTime) && start + step <= toMinutes(closeTime);
}
