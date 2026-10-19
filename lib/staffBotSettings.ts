import { parseWholeNumberInRange } from "@/lib/lifecycleEmails";
import { isHourMinute } from "@/lib/notifications";
import type { StaffBotSettings, StaffBotSettingsUpdateInput } from "@/lib/types";

// Pure logic of the staff bot settings form (ADMIN, on the notification settings page). The server
// validates every one of these; this only puts the message beside the control and enables Save for a
// real change. Numbers are strings while typed, like every settings form here.

export type BotNumberKey =
  | "requestMinHoursBefore"
  | "moveWindowDays"
  | "myShiftsDays"
  | "pendingReminderHours"
  | "rosterChangeHorizonDays"
  | "rosterChangeDelayMinutes";

export type BotToggleKey = Exclude<keyof StaffBotSettingsUpdateInput, BotNumberKey | "eveReminderTime">;

export type BotSettingsForm = { [K in BotToggleKey]: boolean } & { [K in BotNumberKey]: string } & { eveReminderTime: string };

export type BotSettingsField = keyof BotSettingsForm | "form";
export type BotSettingsFieldErrors = Partial<Record<BotSettingsField, string>>;

// The ranges are the server's (openapi: StaffBotSettings).
export const BOT_NUMBER_FIELDS: { key: BotNumberKey; label: string; min: number; max: number; unit: string; hint: string }[] = [
  { key: "requestMinHoursBefore", label: "Notice before the shift", min: 0, max: 720, unit: "hours", hint: "A request must be made at least this long before the shift starts." },
  { key: "moveWindowDays", label: "Move window", min: 1, max: 90, unit: "days", hint: "A shift can be moved to a day at most this far ahead." },
  { key: "myShiftsDays", label: "“My shifts” shows", min: 1, max: 60, unit: "days", hint: "How many days ahead the employee sees." },
  { key: "pendingReminderHours", label: "Remind the deciders after", min: 1, max: 168, unit: "hours", hint: "A request waiting this long is mentioned again, at most once a day." },
  { key: "rosterChangeHorizonDays", label: "Roster changes announced up to", min: 1, max: 90, unit: "days ahead", hint: "Changes to a shift further away say nothing." },
  { key: "rosterChangeDelayMinutes", label: "Roster change message after", min: 1, max: 240, unit: "minutes", hint: "One message with the final state, this long after the last change to that person and day." },
];

export const BOT_COMMAND_TOGGLES: { key: BotToggleKey; label: string }[] = [
  { key: "myShiftsEnabled", label: "My shifts" },
  { key: "myDayEnabled", label: "My day (today's shift and own punches)" },
  { key: "myMonthEnabled", label: "My month (planned and worked)" },
  { key: "myRequestsEnabled", label: "My requests" },
  { key: "botSettingsEnabled", label: "Settings (language, evening reminder)" },
];

export const BOT_REQUEST_TOGGLES: { key: BotToggleKey; label: string; hint?: string }[] = [
  { key: "requestsEnabled", label: "Shift requests", hint: "Master switch: filing, the deciders' list and the messages about them." },
  { key: "moveRequestsEnabled", label: "Requests to move a shift" },
  { key: "deleteRequestsEnabled", label: "Requests for a day off" },
  { key: "allowTodayRequests", label: "Allow a request for today's shift", hint: "Still subject to the notice above." },
  { key: "reasonRequired", label: "The employee must give a reason" },
  { key: "fallbackToAdmin", label: "Administrators decide when nobody holds HR or the HR director is on leave" },
  { key: "pendingReminderEnabled", label: "Remind the deciders of a waiting request" },
];

export const BOT_MESSAGE_TOGGLES: { key: BotToggleKey; label: string; hint?: string }[] = [
  { key: "eveReminderEnabled", label: "Evening-before reminder of tomorrow's shift", hint: "Each employee chooses in the bot." },
  { key: "eveReminderDefaultOn", label: "On for employees who never chose", hint: "Off by default." },
  { key: "rosterChangeEnabled", label: "Tell an employee when a manager changed their shift" },
];

export function toBotSettingsForm(s: StaffBotSettings): BotSettingsForm {
  return {
    myShiftsEnabled: s.myShiftsEnabled,
    myDayEnabled: s.myDayEnabled,
    myMonthEnabled: s.myMonthEnabled,
    myRequestsEnabled: s.myRequestsEnabled,
    botSettingsEnabled: s.botSettingsEnabled,
    requestsEnabled: s.requestsEnabled,
    moveRequestsEnabled: s.moveRequestsEnabled,
    deleteRequestsEnabled: s.deleteRequestsEnabled,
    requestMinHoursBefore: String(s.requestMinHoursBefore),
    allowTodayRequests: s.allowTodayRequests,
    moveWindowDays: String(s.moveWindowDays),
    reasonRequired: s.reasonRequired,
    myShiftsDays: String(s.myShiftsDays),
    fallbackToAdmin: s.fallbackToAdmin,
    pendingReminderEnabled: s.pendingReminderEnabled,
    pendingReminderHours: String(s.pendingReminderHours),
    eveReminderEnabled: s.eveReminderEnabled,
    eveReminderTime: s.eveReminderTime,
    eveReminderDefaultOn: s.eveReminderDefaultOn,
    rosterChangeEnabled: s.rosterChangeEnabled,
    rosterChangeHorizonDays: String(s.rosterChangeHorizonDays),
    rosterChangeDelayMinutes: String(s.rosterChangeDelayMinutes),
  };
}

export type BotSettingsValidation = { ok: true; input: StaffBotSettingsUpdateInput } | { ok: false; errors: BotSettingsFieldErrors };

// Every rule the server enforces on PUT /settings/staff-bot, each message under its own control.
export function validateBotSettingsForm(form: BotSettingsForm): BotSettingsValidation {
  const errors: BotSettingsFieldErrors = {};
  const numbers = {} as Record<BotNumberKey, number>;
  for (const f of BOT_NUMBER_FIELDS) {
    const value = parseWholeNumberInRange(form[f.key], f.min, f.max);
    if (value === null) errors[f.key] = `A whole number from ${f.min} to ${f.max}.`;
    else numbers[f.key] = value;
  }
  if (!isHourMinute(form.eveReminderTime)) errors.eveReminderTime = "A time like 18:00.";
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  return {
    ok: true,
    input: {
      myShiftsEnabled: form.myShiftsEnabled,
      myDayEnabled: form.myDayEnabled,
      myMonthEnabled: form.myMonthEnabled,
      myRequestsEnabled: form.myRequestsEnabled,
      botSettingsEnabled: form.botSettingsEnabled,
      requestsEnabled: form.requestsEnabled,
      moveRequestsEnabled: form.moveRequestsEnabled,
      deleteRequestsEnabled: form.deleteRequestsEnabled,
      requestMinHoursBefore: numbers.requestMinHoursBefore,
      allowTodayRequests: form.allowTodayRequests,
      moveWindowDays: numbers.moveWindowDays,
      reasonRequired: form.reasonRequired,
      myShiftsDays: numbers.myShiftsDays,
      fallbackToAdmin: form.fallbackToAdmin,
      pendingReminderEnabled: form.pendingReminderEnabled,
      pendingReminderHours: numbers.pendingReminderHours,
      eveReminderEnabled: form.eveReminderEnabled,
      eveReminderTime: form.eveReminderTime,
      eveReminderDefaultOn: form.eveReminderDefaultOn,
      rosterChangeEnabled: form.rosterChangeEnabled,
      rosterChangeHorizonDays: numbers.rosterChangeHorizonDays,
      rosterChangeDelayMinutes: numbers.rosterChangeDelayMinutes,
    },
  };
}

// Compared as the server will see it (numbers parsed), so Save is enabled by a real change only.
export function botSettingsFormDirty(form: BotSettingsForm, saved: StaffBotSettings): boolean {
  const base = toBotSettingsForm(saved);
  const numberKeys = new Set<string>(BOT_NUMBER_FIELDS.map((f) => f.key));
  for (const key of Object.keys(base) as (keyof BotSettingsForm)[]) {
    if (numberKeys.has(key)) {
      const typed = String(form[key]).trim();
      if (typed === "" || Number(typed) !== Number(base[key])) return true;
    } else if (form[key] !== base[key]) {
      return true;
    }
  }
  return false;
}

const FIELDS: BotSettingsField[] = [...BOT_NUMBER_FIELDS.map((f) => f.key as BotSettingsField), "eveReminderTime"];

// A rejected save, attributed: a 400 carries { error: { fieldErrors: { moveWindowDays: [...] } } }; anything else is
// a message for the form as a whole.
export function botSettingsServerError(status: number, error: string, body: unknown): { field: BotSettingsField; message: string } {
  if (status === 400 && body && typeof body === "object" && "error" in body) {
    const inner = (body as { error: unknown }).error;
    if (inner && typeof inner === "object") {
      const fields = (inner as { fieldErrors?: Record<string, string[]> }).fieldErrors ?? {};
      for (const field of FIELDS) {
        const first = fields[field as string]?.[0];
        if (first) return { field, message: first };
      }
    }
  }
  return { field: "form", message: error };
}
