import { parseWholeNumberInRange } from "@/lib/lifecycleEmails";
import { isHourMinute } from "@/lib/notifications";
import type { NotificationStaffMember, StaffBotSettings, StaffBotSettingsUpdateInput } from "@/lib/types";

// Pure logic of the staff bot settings form (ADMIN, on the notification settings page). The server
// validates every one of these; this only puts the message beside the control and enables Save for a
// real change. Numbers are strings while typed, like every settings form here.

export type BotNumberKey =
  | "requestMinHoursBefore"
  | "moveWindowDays"
  | "moveMaxDaysAhead"
  | "myShiftsDays"
  | "pendingReminderHours"
  | "rosterChangeHorizonDays"
  | "rosterChangeDelayMinutes"
  | "housekeeperBlocksDays"
  | "therapistScheduleDays";

export type BotTimeKey = "eveReminderTime" | "therapistMorningTime" | "morningSummaryTime";

export type BotToggleKey = Exclude<keyof StaffBotSettingsUpdateInput, BotNumberKey | BotTimeKey>;

export type BotSettingsForm = { [K in BotToggleKey]: boolean } & { [K in BotNumberKey]: string } & { [K in BotTimeKey]: string };

export type BotSettingsField = keyof BotSettingsForm | "form";
export type BotSettingsFieldErrors = Partial<Record<BotSettingsField, string>>;

// The ranges are the server's (openapi: StaffBotSettings).
export const BOT_NUMBER_FIELDS: { key: BotNumberKey; label: string; min: number; max: number; unit: string; hint: string }[] = [
  { key: "requestMinHoursBefore", label: "Notice before the shift", min: 0, max: 720, unit: "hours", hint: "A request must be made at least this long before the shift starts." },
  { key: "moveWindowDays", label: "Move window", min: 1, max: 90, unit: "days", hint: "How many of the nearest days the bot offers as buttons when a shift is moved. It does not limit the move: see the next field." },
  {
    key: "moveMaxDaysAhead",
    label: "Move at most this far ahead",
    min: 1,
    max: 180,
    unit: "days",
    hint: "How far ahead a shift can be moved at all. Days past the buttons are reached with “Other date…” (a calendar) or by typing a date. Not less than the move window.",
  },
  { key: "myShiftsDays", label: "“My shifts” shows", min: 1, max: 60, unit: "days", hint: "How many days ahead the employee sees." },
  { key: "pendingReminderHours", label: "Remind the deciders after", min: 1, max: 168, unit: "hours", hint: "A request waiting this long is mentioned again, at most once a day." },
  { key: "rosterChangeHorizonDays", label: "Roster changes announced up to", min: 1, max: 90, unit: "days ahead", hint: "Changes to a shift further away say nothing." },
  { key: "rosterChangeDelayMinutes", label: "Roster change message after", min: 1, max: 240, unit: "minutes", hint: "One message with the final state, this long after the last change to that person and day." },
  { key: "housekeeperBlocksDays", label: "“Room blocks” shows blocks starting within", min: 1, max: 60, unit: "days", hint: "Blocks that are on now, or begin within this many days, are listed." },
  { key: "therapistScheduleDays", label: "“My procedures” shows", min: 1, max: 14, unit: "days", hint: "Today included." },
];

export const BOT_TIME_FIELDS: { key: BotTimeKey; label: string; example: string }[] = [
  { key: "eveReminderTime", label: "evening reminder at (hotel time)", example: "18:00" },
  { key: "therapistMorningTime", label: "morning message to therapists from (hotel time)", example: "08:00" },
  { key: "morningSummaryTime", label: "morning summary from (hotel time)", example: "08:00" },
];

type Toggle = { key: BotToggleKey; label: string; hint?: string };

// The form is grouped by who the screen is for. Each group is a card on the page; "Requests" and "Morning summary"
// also carry numbers/times, listed in GROUP_NUMBERS / GROUP_TIMES below.
export type BotGroupId = "personal" | "requests" | "engineer" | "housekeeping" | "spa" | "managers" | "summary";

// `short` is the one line under the card's title; `note` is the rest, behind "More". `master` is the toggle that
// switches the whole card (the page shows it in the card's header and folds the card's other fields away while it is off).
export type BotGroup = {
  id: BotGroupId;
  title: string;
  short: string;
  note?: string;
  master?: BotToggleKey;
  toggles: Toggle[];
  numbers: BotNumberKey[];
  times: BotTimeKey[];
};

export const BOT_GROUPS: BotGroup[] = [
  {
    id: "personal",
    title: "Personal screens and messages",
    short: "What the bot shows an employee about their own schedule.",
    note: "Each can be switched off; the menu then leaves it out.",
    toggles: [
      { key: "myShiftsEnabled", label: "My shifts" },
      { key: "myDayEnabled", label: "My day (today's shift and own punches)" },
      { key: "myMonthEnabled", label: "My month (planned and worked)" },
      { key: "myRequestsEnabled", label: "My requests" },
      { key: "botSettingsEnabled", label: "Settings (language, evening reminder)" },
      { key: "eveReminderEnabled", label: "Evening-before reminder of tomorrow's shift", hint: "Each employee chooses in the bot." },
      { key: "eveReminderDefaultOn", label: "On for employees who never chose", hint: "Off by default." },
      {
        key: "rosterChangeEnabled",
        label: "Tell an employee when a manager changed their shift",
        hint: "Only changes made by hand in the roster grid are announced. The month generator, “copy a month” and the Excel imports are bulk set-up and send nothing.",
      },
    ],
    numbers: ["myShiftsDays", "rosterChangeHorizonDays", "rosterChangeDelayMinutes"],
    times: ["eveReminderTime"],
  },
  {
    id: "requests",
    title: "Requests",
    short: "An employee can ask to move a shift or take it off; the HR director decides.",
    master: "requestsEnabled",
    toggles: [
      { key: "requestsEnabled", label: "Shift requests", hint: "Master switch: filing, the deciders' list and the messages about them." },
      { key: "moveRequestsEnabled", label: "Requests to move a shift" },
      { key: "deleteRequestsEnabled", label: "Requests for a day off" },
      { key: "allowTodayRequests", label: "Allow a request for today's shift", hint: "Still subject to the notice above." },
      { key: "reasonRequired", label: "The employee must give a reason" },
      {
        key: "fallbackToAdmin",
        label: "Administrators decide when nobody holds HR or the HR director is on leave",
        hint: "With it off those requests wait. The HR director's own request is the exception: they never decide it themselves, so it always goes to the administrators.",
      },
      { key: "pendingReminderEnabled", label: "Remind the deciders of a waiting request" },
    ],
    numbers: ["requestMinHoursBefore", "moveWindowDays", "moveMaxDaysAhead", "pendingReminderHours"],
    times: [],
  },
  {
    id: "engineer",
    title: "Engineer",
    short: "Open maintenance tasks with Start and Done.",
    note: "For the Engineer function (managers as the fallback). Done shortens the room's block exactly as on the Maintenance page.",
    master: "engineerTasksEnabled",
    toggles: [{ key: "engineerTasksEnabled", label: "Tasks" }],
    numbers: [],
    times: [],
  },
  {
    id: "housekeeping",
    title: "Housekeeping",
    short: "Read only: the blocks the Housekeeper function answers for.",
    master: "housekeeperBlocksEnabled",
    toggles: [{ key: "housekeeperBlocksEnabled", label: "Room blocks" }],
    numbers: ["housekeeperBlocksDays"],
    times: [],
  },
  {
    id: "spa",
    title: "Spa",
    short: "For the Therapist function.",
    note: "Never shows the guest's name.",
    toggles: [
      { key: "therapistScheduleEnabled", label: "My procedures" },
      { key: "therapistMorningEnabled", label: "Morning message “N procedures today, the first at 10:00”", hint: "Sent only to a therapist who switched it on in the bot's Settings, and only on a day with procedures." },
      { key: "therapistMorningDefaultOn", label: "On for therapists who never chose", hint: "Off by default." },
    ],
    numbers: ["therapistScheduleDays"],
    times: ["therapistMorningTime"],
  },
  {
    id: "managers",
    title: "Managers",
    short: "For MANAGER and above.",
    toggles: [
      { key: "whoIsOnShiftEnabled", label: "Who is on shift", hint: "The attendance board in words. When a terminal is not responding it says so first and shows only the roster." },
      { key: "whoIsOnShiftForHr", label: "Also for the HR director", hint: "They can already read attendance." },
      { key: "summaryCommandEnabled", label: "Summary (on request)" },
    ],
    numbers: [],
    times: [],
  },
  {
    id: "summary",
    title: "Morning summary",
    short: "Sent to the director recipients once a day.",
    note: "Every figure is read from the same screens the admin uses.",
    toggles: [
      { key: "morningSummaryEnabled", label: "Send the morning summary to the directors" },
      { key: "summaryArrivals", label: "Arrivals" },
      { key: "summaryDepartures", label: "Departures and overdue departures" },
      { key: "summaryInHouse", label: "Rooms and guests in the house" },
      { key: "summaryOccupancy", label: "Occupancy and rooms still free tonight" },
      { key: "summaryRooms", label: "Rooms blocked and rooms to clean" },
      { key: "summaryStaff", label: "Staff on the roster, on shift, absent" },
      { key: "summaryRequests", label: "Shift requests waiting" },
    ],
    numbers: [],
    times: ["morningSummaryTime"],
  },
];

export function toBotSettingsForm(s: StaffBotSettings): BotSettingsForm {
  const { updatedAt: _ignored, ...rest } = s;
  const numberKeys = new Set<string>(BOT_NUMBER_FIELDS.map((f) => f.key));
  const form: Record<string, boolean | string> = {};
  for (const [key, value] of Object.entries(rest)) {
    form[key] = numberKeys.has(key) ? String(value) : (value as boolean | string);
  }
  return form as BotSettingsForm;
}

export type BotSettingsValidation = { ok: true; input: StaffBotSettingsUpdateInput } | { ok: false; errors: BotSettingsFieldErrors };

// Every rule the server enforces on PUT /settings/staff-bot, each message under its own control.
export function validateBotSettingsForm(form: BotSettingsForm): BotSettingsValidation {
  const errors: BotSettingsFieldErrors = {};
  const numbers: Record<string, number> = {};
  for (const f of BOT_NUMBER_FIELDS) {
    const value = parseWholeNumberInRange(form[f.key], f.min, f.max);
    if (value === null) errors[f.key] = `A whole number from ${f.min} to ${f.max}.`;
    else numbers[f.key] = value;
  }
  for (const t of BOT_TIME_FIELDS) {
    if (!isHourMinute(form[t.key])) errors[t.key] = `A time like ${t.example}.`;
  }
  // The horizon can't be shorter than the buttons' window (the server answers 400 on moveMaxDaysAhead).
  if (!errors.moveWindowDays && !errors.moveMaxDaysAhead && numbers.moveMaxDaysAhead < numbers.moveWindowDays) {
    errors.moveMaxDaysAhead = `Not less than the move window (${numbers.moveWindowDays} days).`;
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const input: Record<string, boolean | string | number> = {};
  for (const [key, value] of Object.entries(form)) {
    input[key] = key in numbers ? numbers[key] : (value as boolean | string);
  }
  return { ok: true, input: input as StaffBotSettingsUpdateInput };
}

// Which fields differ from what the server holds, compared as the server will see it (numbers parsed).
export function dirtyBotSettingsFields(form: BotSettingsForm, saved: StaffBotSettings): (keyof BotSettingsForm)[] {
  const base = toBotSettingsForm(saved);
  const numberKeys = new Set<string>(BOT_NUMBER_FIELDS.map((f) => f.key));
  const changed: (keyof BotSettingsForm)[] = [];
  for (const key of Object.keys(base) as (keyof BotSettingsForm)[]) {
    if (numberKeys.has(key)) {
      const typed = String(form[key]).trim();
      if (typed === "" || Number(typed) !== Number(base[key])) changed.push(key);
    } else if (form[key] !== base[key]) {
      changed.push(key);
    }
  }
  return changed;
}

// So Save is enabled by a real change only.
export function botSettingsFormDirty(form: BotSettingsForm, saved: StaffBotSettings): boolean {
  return dirtyBotSettingsFields(form, saved).length > 0;
}

const FIELDS: BotSettingsField[] = [...BOT_NUMBER_FIELDS.map((f) => f.key as BotSettingsField), ...BOT_TIME_FIELDS.map((t) => t.key as BotSettingsField)];

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

// Who gets the morning summary, as the notification settings have it: the chosen director recipients, how many of
// them (active staff) have a Telegram chat linked. A message to someone without a chat is only written to the log.
export type DirectorsTelegram = { selected: number; linked: number; text: string };

export function directorsTelegramSummary(directorUserIds: readonly string[], staff: readonly NotificationStaffMember[]): DirectorsTelegram {
  const byId = new Map(staff.map((s) => [s.userId, s]));
  const active = Array.from(new Set(directorUserIds)).filter((id) => byId.get(id)?.isActive);
  const selected = active.length;
  const linked = active.filter((id) => byId.get(id)?.telegramLinked).length;
  const people = (n: number) => `${n} ${n === 1 ? "director" : "directors"}`;
  if (selected === 0) {
    return { selected, linked, text: "No directors are selected on the Recipients & delivery tab, so nobody will receive the summary." };
  }
  if (linked === 0) {
    return {
      selected,
      linked,
      text: `${people(selected)} selected, none of them has Telegram linked: the summary will be written to the log but nobody will receive it.`,
    };
  }
  return {
    selected,
    linked,
    text: linked === selected ? `${people(selected)} selected, all with Telegram linked.` : `${people(selected)} selected, ${linked} with Telegram linked.`,
  };
}
