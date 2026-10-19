import {
  dirtySettingsFields,
  validateSettingsForm,
  type SettingsFieldErrors,
  type SettingsForm,
} from "@/lib/notifications";
import { decidersSummary } from "@/lib/shiftRequests";
import {
  BOT_GROUPS,
  dirtyBotSettingsFields,
  directorsTelegramSummary,
  validateBotSettingsForm,
  type BotGroupId,
  type BotSettingsFieldErrors,
  type BotSettingsForm,
  type BotToggleKey,
  type DirectorsTelegram,
} from "@/lib/staffBotSettings";
import type {
  NotificationSettings,
  NotificationSettingsUpdateInput,
  NotificationStaffMember,
  NotificationStatus,
  ShiftRequestDeciders,
  StaffBotSettings,
  StaffBotSettingsUpdateInput,
} from "@/lib/types";

// Pure logic of the notification settings page (ADMIN): which tab the address names, which tabs hold unsaved
// edits or errors, what a Save has to send, and the rows of the Overview. The page keeps both settings forms in one
// state and one Save, so "which of the two PUTs, and where to look when one is refused" is decided here, tested,
// not in the component.

export type SettingsTabId = "overview" | "attendance" | "blocks" | "recipients" | "bot" | "requests" | "roles" | "summary";

export const SETTINGS_TABS: { id: SettingsTabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "attendance", label: "Attendance alerts" },
  { id: "blocks", label: "Room blocks" },
  { id: "recipients", label: "Recipients & delivery" },
  { id: "bot", label: "Staff bot" },
  { id: "requests", label: "Shift requests & HR" },
  { id: "roles", label: "Role screens" },
  { id: "summary", label: "Morning summary" },
];

const TAB_IDS = new Set<string>(SETTINGS_TABS.map((t) => t.id));

export function settingsTabLabel(id: SettingsTabId): string {
  return SETTINGS_TABS.find((t) => t.id === id)!.label;
}

// `?tab=` of the address. Anything unknown, empty or repeated is the Overview (a link someone typed or an old one
// must still open the page).
export function parseSettingsTab(value: string | string[] | null | undefined): SettingsTabId {
  const one = Array.isArray(value) ? value[0] : value;
  return one && TAB_IDS.has(one) ? (one as SettingsTabId) : "overview";
}

// The query string of a tab's address: the Overview is the page itself, so it has none.
export function settingsTabQuery(id: SettingsTabId): string {
  return id === "overview" ? "" : `?tab=${id}`;
}

// ---- which tab holds which field ---------------------------------------------------------------

const ALERT_FIELD_TAB: Record<keyof SettingsForm, SettingsTabId> = {
  lateEnabled: "attendance",
  lateGraceMinutes: "attendance",
  absenceEnabled: "attendance",
  absenceMinutes: "attendance",
  terminalAlertsEnabled: "attendance",
  terminalSilenceMinutes: "attendance",
  blockCreatedEnabled: "blocks",
  blockLastDayEnabled: "blocks",
  blockExpiredEnabled: "blocks",
  morningTime: "blocks",
  lateRecipientUserIds: "recipients",
  directorUserIds: "recipients",
  quietHoursEnabled: "recipients",
  quietStart: "recipients",
  quietEnd: "recipients",
  defaultLanguage: "recipients",
};

export function alertFieldTab(field: keyof SettingsForm): SettingsTabId {
  return ALERT_FIELD_TAB[field];
}

export const BOT_GROUP_TAB: Record<BotGroupId, SettingsTabId> = {
  personal: "bot",
  requests: "requests",
  engineer: "roles",
  housekeeping: "roles",
  spa: "roles",
  managers: "roles",
  summary: "summary",
};

export function botFieldTab(field: keyof BotSettingsForm): SettingsTabId {
  for (const group of BOT_GROUPS) {
    const keys: string[] = [...group.toggles.map((t) => t.key as string), ...group.numbers, ...group.times];
    if (keys.includes(field)) return BOT_GROUP_TAB[group.id];
  }
  return "bot";
}

function inTabOrder(tabs: Set<SettingsTabId>): SettingsTabId[] {
  return SETTINGS_TABS.map((t) => t.id).filter((id) => tabs.has(id));
}

// Tabs holding an edit that is not saved yet (they get the dot).
export function tabsWithEdits(alertFields: readonly (keyof SettingsForm)[], botFields: readonly (keyof BotSettingsForm)[]): SettingsTabId[] {
  return inTabOrder(new Set([...alertFields.map(alertFieldTab), ...botFields.map(botFieldTab)]));
}

// Tabs holding a field that has an error message ("form" is a message for the whole form, not for a field).
export function tabsWithErrors(alertErrors: SettingsFieldErrors, botErrors: BotSettingsFieldErrors): SettingsTabId[] {
  const tabs = new Set<SettingsTabId>();
  for (const [key, message] of Object.entries(alertErrors)) if (message && key !== "form") tabs.add(alertFieldTab(key as keyof SettingsForm));
  for (const [key, message] of Object.entries(botErrors)) if (message && key !== "form") tabs.add(botFieldTab(key as keyof BotSettingsForm));
  return inTabOrder(tabs);
}

// "Unsaved changes in: Attendance alerts, Staff bot"
export function unsavedSummary(tabs: readonly SettingsTabId[]): string {
  return `Unsaved changes in: ${tabs.map(settingsTabLabel).join(", ")}`;
}

// ---- Save --------------------------------------------------------------------------------------

export type PreparedSave =
  | { ok: true; alerts: NotificationSettingsUpdateInput | null; bot: StaffBotSettingsUpdateInput | null }
  | { ok: false; alertErrors: SettingsFieldErrors; botErrors: BotSettingsFieldErrors; tab: SettingsTabId };

// What one Save sends: only a form that changed, each whole (both PUTs replace every field), and nothing at all until
// every changed form passes the client-side checks - half a Save because the other half was typed wrongly would
// leave the page in a state nobody asked for. `tab` is the first tab with an error.
export function prepareSave(
  alertForm: SettingsForm,
  alertSaved: NotificationSettings,
  botForm: BotSettingsForm,
  botSaved: StaffBotSettings
): PreparedSave {
  const alertsChanged = dirtySettingsFields(alertForm, alertSaved).length > 0;
  const botChanged = dirtyBotSettingsFields(botForm, botSaved).length > 0;
  const alerts = alertsChanged ? validateSettingsForm(alertForm, alertSaved.minLateGraceMinutes) : null;
  const bot = botChanged ? validateBotSettingsForm(botForm) : null;

  const alertErrors = alerts && !alerts.ok ? alerts.errors : {};
  const botErrors = bot && !bot.ok ? bot.errors : {};
  const tab = tabsWithErrors(alertErrors, botErrors)[0];
  if (tab) return { ok: false, alertErrors, botErrors, tab };
  return { ok: true, alerts: alerts && alerts.ok ? alerts.input : null, bot: bot && bot.ok ? bot.input : null };
}

// ---- Overview ----------------------------------------------------------------------------------

export type OverviewRow = {
  label: string;
  // The bot switch behind the row (none for the alert settings); the tab must be the one that holds it.
  botKey?: BotToggleKey;
  on: boolean;
  detail?: string;
  tab: SettingsTabId;
};

export type OverviewSection = { title: string; rows: OverviewRow[] };

// One row per message the bot can send and per screen it offers, read from the two settings as the server holds
// them. A row says what the *switch* says; it does not claim the message will arrive (Telegram may be off, nobody
// may be on shift) - the facts above the table say that.
export function overviewSections(settings: NotificationSettings, bot: StaffBotSettings, directors: DirectorsTelegram): OverviewSection[] {
  const requests = bot.requestsEnabled;
  const summaryDetail = bot.morningSummaryEnabled && directors.linked === 0 ? `at ${bot.morningSummaryTime} - nobody with Telegram will receive it` : `at ${bot.morningSummaryTime}`;
  return [
    {
      title: "Messages",
      rows: [
        { label: "Late", on: settings.lateEnabled, detail: `${settings.lateGraceMinutes} min after the planned start`, tab: "attendance" },
        { label: "Absent", on: settings.absenceEnabled, detail: `${settings.absenceMinutes} min after the planned start`, tab: "attendance" },
        { label: "Attendance terminal not responding", on: settings.terminalAlertsEnabled, detail: `after ${settings.terminalSilenceMinutes} min`, tab: "attendance" },
        { label: "Room block created", on: settings.blockCreatedEnabled, tab: "blocks" },
        { label: "Room block: last day", on: settings.blockLastDayEnabled, detail: `at ${settings.morningTime}`, tab: "blocks" },
        { label: "Room block ended, task still open", on: settings.blockExpiredEnabled, detail: `at ${settings.morningTime}`, tab: "blocks" },
        { label: "Schedule changed by a manager", botKey: "rosterChangeEnabled", on: bot.rosterChangeEnabled, detail: `${bot.rosterChangeDelayMinutes} min after the last change`, tab: "bot" },
        { label: "Evening reminder", botKey: "eveReminderEnabled", on: bot.eveReminderEnabled, detail: `at ${bot.eveReminderTime}`, tab: "bot" },
        { label: "Reminder of a waiting shift request", botKey: "pendingReminderEnabled", on: requests && bot.pendingReminderEnabled, detail: requests ? `after ${bot.pendingReminderHours} h` : "requests are off", tab: "requests" },
        { label: "Therapist morning message", botKey: "therapistMorningEnabled", on: bot.therapistMorningEnabled, detail: `from ${bot.therapistMorningTime}`, tab: "roles" },
        { label: "Morning summary", botKey: "morningSummaryEnabled", on: bot.morningSummaryEnabled, detail: summaryDetail, tab: "summary" },
      ],
    },
    {
      title: "Bot screens",
      rows: [
        { label: "My shifts", botKey: "myShiftsEnabled", on: bot.myShiftsEnabled, tab: "bot" },
        { label: "My day", botKey: "myDayEnabled", on: bot.myDayEnabled, tab: "bot" },
        { label: "My month", botKey: "myMonthEnabled", on: bot.myMonthEnabled, tab: "bot" },
        { label: "My requests", botKey: "myRequestsEnabled", on: bot.myRequestsEnabled, tab: "bot" },
        { label: "Settings", botKey: "botSettingsEnabled", on: bot.botSettingsEnabled, tab: "bot" },
        { label: "Shift requests", botKey: "requestsEnabled", on: requests, detail: requests ? requestKinds(bot) : undefined, tab: "requests" },
        { label: "Tasks (engineer)", botKey: "engineerTasksEnabled", on: bot.engineerTasksEnabled, tab: "roles" },
        { label: "Room blocks (housekeeping)", botKey: "housekeeperBlocksEnabled", on: bot.housekeeperBlocksEnabled, tab: "roles" },
        { label: "My procedures (therapist)", botKey: "therapistScheduleEnabled", on: bot.therapistScheduleEnabled, tab: "roles" },
        { label: "Who is on shift", botKey: "whoIsOnShiftEnabled", on: bot.whoIsOnShiftEnabled, tab: "roles" },
        { label: "Summary (on request)", botKey: "summaryCommandEnabled", on: bot.summaryCommandEnabled, tab: "roles" },
      ],
    },
  ];
}

function requestKinds(bot: StaffBotSettings): string {
  const kinds = [bot.moveRequestsEnabled ? "move" : null, bot.deleteRequestsEnabled ? "day off" : null].filter(Boolean);
  return kinds.length > 0 ? kinds.join(" and ") : "no kind of request is on";
}

export type OverviewFact = { label: string; text: string; warn: boolean };

// The way out to Telegram, from `telegramRoute` + `telegramProxyConfigured` of GET /notifications/status. Through the
// hotel proxy: said plainly. Direct although a proxy is set: the server gave up on it after repeated failed polls and
// keeps probing, so the proxy is down - a warning. Direct without a proxy is the ordinary case and says nothing; so
// does an unconfigured Telegram (there is no route yet).
export function telegramRouteFact(status: NotificationStatus | null): OverviewFact | null {
  if (status === null || !status.telegramConfigured) return null;
  if (status.telegramRoute === "PROXY") return { label: "Telegram route", text: "Telegram via hotel proxy", warn: false };
  if (status.telegramProxyConfigured) return { label: "Telegram route", text: "Telegram direct: hotel proxy not answering", warn: true };
  return null;
}

// The facts above the table, only from what the five endpoints already answer.
export function overviewFacts(
  settings: NotificationSettings,
  staff: readonly NotificationStaffMember[],
  deciders: ShiftRequestDeciders,
  status: NotificationStatus | null,
  directors: DirectorsTelegram = directorsTelegramSummary(settings.directorUserIds, staff)
): OverviewFact[] {
  const active = staff.filter((m) => m.isActive);
  const linked = active.filter((m) => m.telegramLinked).length;

  let telegram: OverviewFact;
  if (status === null) telegram = { label: "Telegram", text: "The status could not be read - reload the page.", warn: true };
  else if (!status.telegramConfigured) telegram = { label: "Telegram", text: "Not configured on the server: nothing is sent.", warn: true };
  else if (!status.botUsername) telegram = { label: "Telegram", text: "Configured, the bot's name is not known yet.", warn: true };
  else telegram = { label: "Telegram", text: `Connected as @${status.botUsername}.`, warn: false };

  const everyoneLinked = active.length > 0 && linked === active.length;
  const hrLeave = deciders.vacationFrom || deciders.vacationTo ? ` Leave: ${deciders.vacationFrom ?? "…"} to ${deciders.vacationTo ?? "…"}.` : "";

  const route = telegramRouteFact(status);

  return [
    telegram,
    ...(route ? [route] : []),
    { label: "Staff with Telegram linked", text: `${linked} of ${active.length} active employees.`, warn: active.length > 0 && !everyoneLinked && linked === 0 },
    { label: "HR director", text: `${decidersSummary(deciders)}${hrLeave}`, warn: deciders.effectiveDeciders.length === 0 },
    { label: "Directors", text: directors.text, warn: directors.selected === 0 || directors.linked === 0 },
    {
      label: "Quiet hours",
      text: settings.quietHoursEnabled ? `${settings.quietStart} to ${settings.quietEnd} (hotel time): messages wait until they end.` : "Off.",
      warn: false,
    },
  ];
}
