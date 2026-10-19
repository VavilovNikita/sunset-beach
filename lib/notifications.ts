import { addDaysToDateKey, hotelDateKey } from "@/lib/hotelDate";
import { parseWholeNumberInRange } from "@/lib/lifecycleEmails";
import type {
  BlockResponsibleFunction,
  NotificationDeliveryStatus,
  NotificationLanguage,
  NotificationSettings,
  NotificationSettingsUpdateInput,
  NotificationStaffMember,
  NotificationStatus,
  NotificationType,
} from "@/lib/types";

// Pure logic of the staff notification screens (settings, staff channels, log), kept out of the
// components so a wrong number or a wrong "can this be linked" is a tested rule, not something seen
// only in a browser. The server stays the authority on every one of these: this only spares a round
// trip and puts the message beside the control that caused it.

export const NOTIFICATION_LANGUAGES: { value: NotificationLanguage; label: string }[] = [
  { value: "EN", label: "English" },
  { value: "TH", label: "ไทย (Thai)" },
  { value: "RU", label: "Русский" },
];

export function languageLabel(language: NotificationLanguage | undefined, defaultLanguage?: NotificationLanguage): string {
  const shown = language ?? defaultLanguage;
  const label = NOTIFICATION_LANGUAGES.find((l) => l.value === shown)?.label;
  if (!label) return "Default";
  return language ? label : `Default (${label})`;
}

export const NOTIFICATION_TYPE_LABELS: Record<NotificationType, string> = {
  LATE: "Late",
  ABSENT: "Absent",
  BLOCK_CREATED: "Room blocked",
  BLOCK_LAST_DAY: "Block: last day",
  BLOCK_EXPIRED_OPEN: "Block ended, task open",
  TERMINAL_OFFLINE: "Terminal not responding",
  TERMINAL_ONLINE: "Terminal back online",
  SHIFT_REQUEST_NEW: "Shift request",
  SHIFT_REQUEST_DECIDED: "Request decided",
  SHIFT_REQUEST_EXPIRED: "Request expired",
  SHIFT_REQUEST_REMINDER: "Request reminder",
  SHIFT_EVE_REMINDER: "Evening reminder",
  ROSTER_CHANGED: "Schedule changed",
};

export const NOTIFICATION_TYPES = Object.keys(NOTIFICATION_TYPE_LABELS) as NotificationType[];

export const DELIVERY_STATUS_LABELS: Record<NotificationDeliveryStatus, string> = {
  PENDING: "Waiting",
  SENT: "Sent",
  FAILED: "Failed",
  NO_CHANNEL: "No chat linked",
};

export const DELIVERY_STATUSES = Object.keys(DELIVERY_STATUS_LABELS) as NotificationDeliveryStatus[];

// Colour meanings from CLAUDE.md: green-600 = done, amber-400 = attention but not urgent, coral =
// needs intervention; "no chat" is neutral - a fact about the person, not an error.
export function deliveryStatusClass(status: NotificationDeliveryStatus): string {
  switch (status) {
    case "SENT":
      return "text-green-600 border-green-600/40";
    case "PENDING":
      return "text-amber-400 border-amber-400/40";
    case "FAILED":
      return "text-coral border-coral/40";
    case "NO_CHANNEL":
      return "text-cream/60 border-cream/20";
  }
}

export const BLOCK_FUNCTION_LABELS: Record<BlockResponsibleFunction, string> = {
  ENGINEER: "Engineer",
  HOUSEKEEPER: "Housekeeper",
};

export const BLOCK_FUNCTIONS = Object.keys(BLOCK_FUNCTION_LABELS) as BlockResponsibleFunction[];

// A block from before the field existed has none; its reminders go to the directors.
export function blockFunctionLabel(fn: BlockResponsibleFunction | undefined): string {
  return fn ? BLOCK_FUNCTION_LABELS[fn] : "Not set (directors are told)";
}

// ---- settings form -----------------------------------------------------------------------------

// Numbers are strings while typed, like every settings form here; the rest mirrors the update body.
export type SettingsForm = {
  lateEnabled: boolean;
  lateGraceMinutes: string;
  absenceEnabled: boolean;
  absenceMinutes: string;
  blockCreatedEnabled: boolean;
  blockLastDayEnabled: boolean;
  blockExpiredEnabled: boolean;
  terminalAlertsEnabled: boolean;
  terminalSilenceMinutes: string;
  quietHoursEnabled: boolean;
  quietStart: string;
  quietEnd: string;
  morningTime: string;
  defaultLanguage: NotificationLanguage;
  lateRecipientUserIds: string[];
  directorUserIds: string[];
};

export type SettingsField = keyof SettingsForm | "form";
export type SettingsFieldErrors = Partial<Record<SettingsField, string>>;

export function toSettingsForm(s: NotificationSettings): SettingsForm {
  return {
    lateEnabled: s.lateEnabled,
    lateGraceMinutes: String(s.lateGraceMinutes),
    absenceEnabled: s.absenceEnabled,
    absenceMinutes: String(s.absenceMinutes),
    blockCreatedEnabled: s.blockCreatedEnabled,
    blockLastDayEnabled: s.blockLastDayEnabled,
    blockExpiredEnabled: s.blockExpiredEnabled,
    terminalAlertsEnabled: s.terminalAlertsEnabled,
    terminalSilenceMinutes: String(s.terminalSilenceMinutes),
    quietHoursEnabled: s.quietHoursEnabled,
    quietStart: s.quietStart,
    quietEnd: s.quietEnd,
    morningTime: s.morningTime,
    defaultLanguage: s.defaultLanguage,
    lateRecipientUserIds: [...s.lateRecipientUserIds],
    directorUserIds: [...s.directorUserIds],
  };
}

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isHourMinute(value: string): boolean {
  return HHMM.test(value);
}

export type SettingsValidation = { ok: true; input: NotificationSettingsUpdateInput } | { ok: false; errors: SettingsFieldErrors };

// Every rule the server enforces on PUT /settings/notifications, each message under its own control.
// minGrace is the server's floor for the late grace (the terminal's poll interval).
export function validateSettingsForm(form: SettingsForm, minGrace: number): SettingsValidation {
  const errors: SettingsFieldErrors = {};

  const grace = parseWholeNumberInRange(form.lateGraceMinutes, 1, 240);
  if (grace === null) errors.lateGraceMinutes = "A whole number of minutes from 1 to 240.";
  else if (grace < minGrace) errors.lateGraceMinutes = `At least ${minGrace} minutes - the attendance terminal is read every ${minGrace} minutes.`;

  const absence = parseWholeNumberInRange(form.absenceMinutes, 1, 1440);
  if (absence === null) errors.absenceMinutes = "A whole number of minutes from 1 to 1440.";
  else if (grace !== null && absence < grace) errors.absenceMinutes = `Not shorter than the late grace (${grace} minutes).`;

  const silence = parseWholeNumberInRange(form.terminalSilenceMinutes, 1, 1440);
  if (silence === null) errors.terminalSilenceMinutes = "A whole number of minutes from 1 to 1440.";

  if (!isHourMinute(form.quietStart)) errors.quietStart = "A time like 22:00.";
  if (!isHourMinute(form.quietEnd)) errors.quietEnd = "A time like 07:00.";
  if (form.quietHoursEnabled && !errors.quietStart && !errors.quietEnd && form.quietStart === form.quietEnd) {
    errors.quietEnd = "Quiet hours can't start and end at the same time - switch them off instead.";
  }
  if (!isHourMinute(form.morningTime)) errors.morningTime = "A time like 09:00.";

  if (Object.keys(errors).length > 0 || grace === null || absence === null || silence === null) return { ok: false, errors };

  return {
    ok: true,
    input: {
      lateEnabled: form.lateEnabled,
      lateGraceMinutes: grace,
      absenceEnabled: form.absenceEnabled,
      absenceMinutes: absence,
      blockCreatedEnabled: form.blockCreatedEnabled,
      blockLastDayEnabled: form.blockLastDayEnabled,
      blockExpiredEnabled: form.blockExpiredEnabled,
      terminalAlertsEnabled: form.terminalAlertsEnabled,
      terminalSilenceMinutes: silence,
      quietHoursEnabled: form.quietHoursEnabled,
      quietStart: form.quietStart,
      quietEnd: form.quietEnd,
      morningTime: form.morningTime,
      defaultLanguage: form.defaultLanguage,
      lateRecipientUserIds: form.lateRecipientUserIds,
      directorUserIds: form.directorUserIds,
    },
  };
}

// Compared as the server will see it (numbers parsed, recipient order irrelevant), so "Save" is
// enabled by a real change only.
export function settingsFormDirty(form: SettingsForm, saved: NotificationSettings): boolean {
  const a = toSettingsForm(saved);
  const sameSet = (x: string[], y: string[]) => x.length === y.length && [...x].sort().join("\u0000") === [...y].sort().join("\u0000");
  const numbers: (keyof SettingsForm)[] = ["lateGraceMinutes", "absenceMinutes", "terminalSilenceMinutes"];
  for (const key of Object.keys(a) as (keyof SettingsForm)[]) {
    if (key === "lateRecipientUserIds" || key === "directorUserIds") {
      if (!sameSet(form[key], a[key])) return true;
    } else if (numbers.includes(key)) {
      if (Number(String(form[key]).trim()) !== Number(a[key]) || String(form[key]).trim() === "") return true;
    } else if (form[key] !== a[key]) {
      return true;
    }
  }
  return false;
}

const SETTINGS_FIELDS: SettingsField[] = [
  "lateGraceMinutes",
  "absenceMinutes",
  "terminalSilenceMinutes",
  "quietStart",
  "quietEnd",
  "morningTime",
  "lateRecipientUserIds",
  "directorUserIds",
];

// A rejected save, attributed: a 400 carries { error: { fieldErrors: { lateGraceMinutes: [...] } } }
// (the same shape the lighting settings read); anything else is a message for the form as a whole.
export function settingsServerError(status: number, error: string, body: unknown): { field: SettingsField; message: string } {
  if (status === 400 && body && typeof body === "object" && "error" in body) {
    const inner = (body as { error: unknown }).error;
    if (inner && typeof inner === "object") {
      const fields = (inner as { fieldErrors?: Record<string, string[]> }).fieldErrors ?? {};
      for (const field of SETTINGS_FIELDS) {
        const first = fields[field as string]?.[0];
        if (first) return { field, message: first };
      }
    }
  }
  return { field: "form", message: error };
}

export function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
}

// ---- staff channels ----------------------------------------------------------------------------

// Link Telegram is offered only when it can work: Telegram is configured on the server, the bot's
// name is known (the link is built from it) and the employee is active.
export function linkAvailability(member: NotificationStaffMember, status: NotificationStatus): { allowed: boolean; reason?: string } {
  if (!status.telegramConfigured) return { allowed: false, reason: "Telegram is not configured on the server." };
  if (!status.botUsername) return { allowed: false, reason: "The bot's name is not known yet - reload in a moment." };
  if (!member.isActive) return { allowed: false, reason: "The employee is deactivated." };
  return { allowed: true };
}

export function filterStaff(staff: NotificationStaffMember[], query: string, onlyUnlinked: boolean): NotificationStaffMember[] {
  const q = query.trim().toLowerCase();
  return staff.filter((m) => (!q || m.name.toLowerCase().includes(q)) && (!onlyUnlinked || !m.telegramLinked));
}

// Seconds of a link code's life left, never negative.
export function secondsLeft(expiresAt: string, nowMs: number): number {
  const end = new Date(expiresAt).getTime();
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.ceil((end - nowMs) / 1000));
}

export function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// ---- log ---------------------------------------------------------------------------------------

export type LogFilters = {
  from: string; // hotel day, YYYY-MM-DD, or ""
  to: string;
  type: NotificationType | "";
  deliveryStatus: NotificationDeliveryStatus | "";
};

// The last seven hotel days, today included.
export function defaultLogFilters(now: Date): LogFilters {
  const today = hotelDateKey(now);
  return { from: addDaysToDateKey(today, -6), to: today, type: "", deliveryStatus: "" };
}

export const LOG_LIMIT = 200;

export function logQueryString(filters: LogFilters, limit: number = LOG_LIMIT): string {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.type) params.set("type", filters.type);
  if (filters.deliveryStatus) params.set("deliveryStatus", filters.deliveryStatus);
  params.set("limit", String(limit));
  return params.toString();
}

// The server answers 400 for a backwards range; saying it first spares the round trip.
export function logFiltersError(filters: LogFilters): string | null {
  if (filters.from && filters.to && filters.from > filters.to) return "“From” must be on or before “To”.";
  return null;
}
