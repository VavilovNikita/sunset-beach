import { describe, expect, it } from "vitest";
import {
  alertFieldTab,
  botFieldTab,
  overviewFacts,
  overviewSections,
  parseSettingsTab,
  prepareSave,
  SETTINGS_TABS,
  settingsTabQuery,
  tabsWithEdits,
  tabsWithErrors,
  unsavedSummary,
} from "./notificationSettingsTabs";
import { dirtySettingsFields, toSettingsForm } from "./notifications";
import { BOT_GROUPS, dirtyBotSettingsFields, directorsTelegramSummary, toBotSettingsForm } from "./staffBotSettings";
import type { NotificationSettings, NotificationStaffMember, NotificationStatus, ShiftRequestDeciders, StaffBotSettings } from "./types";

const alerts: NotificationSettings = {
  lateEnabled: true,
  lateGraceMinutes: 10,
  minLateGraceMinutes: 5,
  absenceEnabled: true,
  absenceMinutes: 60,
  blockCreatedEnabled: true,
  blockLastDayEnabled: true,
  blockExpiredEnabled: false,
  terminalAlertsEnabled: true,
  terminalSilenceMinutes: 15,
  quietHoursEnabled: true,
  quietStart: "22:00",
  quietEnd: "07:00",
  morningTime: "09:00",
  defaultLanguage: "EN",
  lateRecipientUserIds: ["u1"],
  directorUserIds: ["u2", "u3"],
  updatedAt: "2026-10-17T03:00:00Z",
};

const bot: StaffBotSettings = {
  myShiftsEnabled: true,
  myDayEnabled: true,
  myMonthEnabled: true,
  myRequestsEnabled: true,
  botSettingsEnabled: true,
  requestsEnabled: true,
  moveRequestsEnabled: true,
  deleteRequestsEnabled: false,
  requestMinHoursBefore: 24,
  allowTodayRequests: false,
  moveWindowDays: 14,
  moveMaxDaysAhead: 60,
  reasonRequired: true,
  myShiftsDays: 14,
  fallbackToAdmin: true,
  pendingReminderEnabled: true,
  pendingReminderHours: 12,
  eveReminderEnabled: true,
  eveReminderTime: "18:00",
  eveReminderDefaultOn: false,
  rosterChangeEnabled: true,
  rosterChangeHorizonDays: 14,
  rosterChangeDelayMinutes: 10,
  engineerTasksEnabled: true,
  housekeeperBlocksEnabled: false,
  housekeeperBlocksDays: 7,
  therapistScheduleEnabled: true,
  therapistScheduleDays: 2,
  therapistMorningEnabled: false,
  therapistMorningTime: "08:00",
  therapistMorningDefaultOn: false,
  whoIsOnShiftEnabled: true,
  whoIsOnShiftForHr: true,
  summaryCommandEnabled: true,
  morningSummaryEnabled: true,
  morningSummaryTime: "08:00",
  summaryArrivals: true,
  summaryDepartures: true,
  summaryInHouse: true,
  summaryOccupancy: true,
  summaryRooms: true,
  summaryStaff: true,
  summaryRequests: true,
  updatedAt: "2026-10-19T10:00:00Z",
};

const member = (userId: string, over: Partial<NotificationStaffMember> = {}): NotificationStaffMember => ({
  userId,
  name: userId,
  role: "MANAGER",
  isActive: true,
  telegramLinked: false,
  ...over,
});

const deciders = (over: Partial<ShiftRequestDeciders> = {}): ShiftRequestDeciders => ({
  hrUserId: "hr",
  hrName: "Malee",
  onVacationToday: false,
  fallbackToAdmin: true,
  effectiveDeciders: ["Malee"],
  callerMayDecide: true,
  ...over,
});

describe("the tab in the address", () => {
  it("names a tab, and anything unknown is the Overview", () => {
    expect(parseSettingsTab("roles")).toBe("roles");
    expect(parseSettingsTab("overview")).toBe("overview");
    expect(parseSettingsTab(null)).toBe("overview");
    expect(parseSettingsTab(undefined)).toBe("overview");
    expect(parseSettingsTab("")).toBe("overview");
    expect(parseSettingsTab("Roles")).toBe("overview");
    expect(parseSettingsTab("nonsense")).toBe("overview");
    expect(parseSettingsTab(["bot", "roles"])).toBe("bot");
    expect(parseSettingsTab([])).toBe("overview");
  });

  it("has an address for every tab, and the Overview is the page itself", () => {
    expect(settingsTabQuery("overview")).toBe("");
    for (const tab of SETTINGS_TABS) expect(parseSettingsTab(settingsTabQuery(tab.id).replace("?tab=", ""))).toBe(tab.id);
    expect(SETTINGS_TABS[0].id).toBe("overview");
  });
});

describe("which tab holds a field", () => {
  it("gives every field of both forms a tab, and no tab of the Overview", () => {
    for (const key of Object.keys(toSettingsForm(alerts)) as (keyof ReturnType<typeof toSettingsForm>)[]) {
      expect(alertFieldTab(key)).not.toBe("overview");
    }
    for (const key of Object.keys(toBotSettingsForm(bot)) as (keyof ReturnType<typeof toBotSettingsForm>)[]) {
      expect(botFieldTab(key)).not.toBe("overview");
    }
  });

  it("sends each bot card to the tab of its kind", () => {
    expect(botFieldTab("myShiftsDays")).toBe("bot");
    expect(botFieldTab("rosterChangeEnabled")).toBe("bot");
    expect(botFieldTab("moveWindowDays")).toBe("requests");
    expect(botFieldTab("moveMaxDaysAhead")).toBe("requests");
    expect(botFieldTab("fallbackToAdmin")).toBe("requests");
    expect(botFieldTab("engineerTasksEnabled")).toBe("roles");
    expect(botFieldTab("housekeeperBlocksDays")).toBe("roles");
    expect(botFieldTab("therapistMorningTime")).toBe("roles");
    expect(botFieldTab("whoIsOnShiftForHr")).toBe("roles");
    expect(botFieldTab("morningSummaryTime")).toBe("summary");
    expect(botFieldTab("summaryRequests")).toBe("summary");
    expect(BOT_GROUPS.every((g) => g.master === undefined || g.toggles.some((t) => t.key === g.master))).toBe(true);
  });

  it("puts the alert fields where the settings are read", () => {
    expect(alertFieldTab("lateGraceMinutes")).toBe("attendance");
    expect(alertFieldTab("terminalSilenceMinutes")).toBe("attendance");
    expect(alertFieldTab("morningTime")).toBe("blocks");
    expect(alertFieldTab("lateRecipientUserIds")).toBe("recipients");
    expect(alertFieldTab("directorUserIds")).toBe("recipients");
    expect(alertFieldTab("quietEnd")).toBe("recipients");
    expect(alertFieldTab("defaultLanguage")).toBe("recipients");
  });
});

describe("unsaved edits and errors by tab", () => {
  it("marks the tabs of the changed fields, once each, in tab order", () => {
    const form = { ...toSettingsForm(alerts), lateGraceMinutes: "12", absenceMinutes: "90", quietStart: "23:00" };
    const botForm = { ...toBotSettingsForm(bot), moveWindowDays: "10", morningSummaryTime: "07:30", myShiftsDays: "7" };
    const tabs = tabsWithEdits(dirtySettingsFields(form, alerts), dirtyBotSettingsFields(botForm, bot));
    expect(tabs).toEqual(["attendance", "recipients", "bot", "requests", "summary"]);
    expect(unsavedSummary(["attendance", "bot"])).toBe("Unsaved changes in: Attendance alerts, Staff bot");
  });

  it("marks nothing for an untouched form, or for a number typed back to what it was", () => {
    expect(tabsWithEdits(dirtySettingsFields(toSettingsForm(alerts), alerts), dirtyBotSettingsFields(toBotSettingsForm(bot), bot))).toEqual([]);
    expect(dirtySettingsFields({ ...toSettingsForm(alerts), lateGraceMinutes: " 10 " }, alerts)).toEqual([]);
    expect(dirtyBotSettingsFields({ ...toBotSettingsForm(bot), moveWindowDays: "14" }, bot)).toEqual([]);
  });

  it("reads a recipient list as a set", () => {
    expect(dirtySettingsFields({ ...toSettingsForm(alerts), directorUserIds: ["u3", "u2"] }, alerts)).toEqual([]);
    expect(dirtySettingsFields({ ...toSettingsForm(alerts), directorUserIds: ["u3"] }, alerts)).toEqual(["directorUserIds"]);
  });

  it("marks the tabs of the fields with an error, and ignores a cleared one and a form-wide message", () => {
    expect(tabsWithErrors({ lateGraceMinutes: "x", morningTime: undefined, form: "boom" }, { moveWindowDays: "y", therapistMorningTime: "z" })).toEqual([
      "attendance",
      "requests",
      "roles",
    ]);
    expect(tabsWithErrors({ form: "No connection" }, {})).toEqual([]);
  });
});

describe("what one Save sends", () => {
  it("sends nothing when nothing changed", () => {
    expect(prepareSave(toSettingsForm(alerts), alerts, toBotSettingsForm(bot), bot)).toEqual({ ok: true, alerts: null, bot: null });
  });

  it("sends only the form that changed, whole", () => {
    const onlyBot = prepareSave(toSettingsForm(alerts), alerts, { ...toBotSettingsForm(bot), moveWindowDays: "10" }, bot);
    expect(onlyBot).toMatchObject({ ok: true, alerts: null });
    expect(onlyBot.ok && onlyBot.bot).toMatchObject({ moveWindowDays: 10, requestsEnabled: true, morningSummaryTime: "08:00" });

    const onlyAlerts = prepareSave({ ...toSettingsForm(alerts), lateEnabled: false }, alerts, toBotSettingsForm(bot), bot);
    expect(onlyAlerts).toMatchObject({ ok: true, bot: null });
    expect(onlyAlerts.ok && onlyAlerts.alerts).toMatchObject({ lateEnabled: false, lateGraceMinutes: 10, directorUserIds: ["u2", "u3"] });

    const both = prepareSave({ ...toSettingsForm(alerts), lateEnabled: false }, alerts, { ...toBotSettingsForm(bot), moveWindowDays: "10" }, bot);
    expect(both.ok && both.alerts && both.bot).toBeTruthy();
  });

  it("refuses to send anything while a changed form is wrong, and names the first tab to look at", () => {
    const result = prepareSave(
      { ...toSettingsForm(alerts), lateEnabled: false },
      alerts,
      { ...toBotSettingsForm(bot), moveWindowDays: "0", morningSummaryTime: "8am" },
      bot
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.alertErrors).toEqual({});
    expect(Object.keys(result.botErrors).sort()).toEqual(["morningSummaryTime", "moveWindowDays"]);
    expect(result.tab).toBe("requests");
  });

  it("puts a rule of the alert form on its tab, ahead of a later tab's error", () => {
    const result = prepareSave(
      { ...toSettingsForm(alerts), lateGraceMinutes: "3" },
      alerts,
      { ...toBotSettingsForm(bot), myShiftsDays: "0" },
      bot
    );
    expect(result).toMatchObject({ ok: false, tab: "attendance" });
    if (!result.ok) expect(result.alertErrors.lateGraceMinutes).toContain("At least 5 minutes");
  });

  it("does not check a form that was not touched", () => {
    // The bot form is invalid in the same breath only if it was changed; an untouched one is never the reason Save fails.
    const result = prepareSave({ ...toSettingsForm(alerts), lateEnabled: false }, alerts, toBotSettingsForm(bot), bot);
    expect(result.ok).toBe(true);
  });
});

describe("the Overview", () => {
  const directors = directorsTelegramSummary(["u2", "u3"], [member("u2", { telegramLinked: true }), member("u3")]);

  it("has a row for every message and screen, each pointing at the tab that holds its switch", () => {
    const sections = overviewSections(alerts, bot, directors);
    expect(sections.map((s) => s.title)).toEqual(["Messages", "Bot screens"]);
    const rows = sections.flatMap((s) => s.rows);
    expect(new Set(rows.map((r) => r.label)).size).toBe(rows.length);
    for (const row of rows) {
      if (row.botKey) expect(botFieldTab(row.botKey), row.label).toBe(row.tab);
    }
    expect(rows.find((r) => r.label === "Late")).toMatchObject({ on: true, tab: "attendance" });
    expect(rows.find((r) => r.label === "Room block ended, task still open")).toMatchObject({ on: false, tab: "blocks" });
    expect(rows.find((r) => r.label === "Room blocks (housekeeping)")).toMatchObject({ on: false, tab: "roles" });
    expect(rows.find((r) => r.label === "Therapist morning message")).toMatchObject({ on: false, tab: "roles" });
  });

  it("covers every alert and every screen switch of the settings", () => {
    const rows = overviewSections(alerts, bot, directors).flatMap((s) => s.rows);
    const covered = new Set(rows.map((r) => r.botKey));
    for (const key of [
      "myShiftsEnabled",
      "myDayEnabled",
      "myMonthEnabled",
      "myRequestsEnabled",
      "botSettingsEnabled",
      "requestsEnabled",
      "engineerTasksEnabled",
      "housekeeperBlocksEnabled",
      "therapistScheduleEnabled",
      "whoIsOnShiftEnabled",
      "summaryCommandEnabled",
      "morningSummaryEnabled",
      "eveReminderEnabled",
      "rosterChangeEnabled",
      "therapistMorningEnabled",
      "pendingReminderEnabled",
    ] as const) {
      expect(covered.has(key), key).toBe(true);
    }
    const alertRows = rows.filter((r) => !r.botKey).map((r) => r.label);
    expect(alertRows).toEqual([
      "Late",
      "Absent",
      "Attendance terminal not responding",
      "Room block created",
      "Room block: last day",
      "Room block ended, task still open",
    ]);
  });

  it("does not call a reminder on while shift requests are off", () => {
    const rows = overviewSections(alerts, { ...bot, requestsEnabled: false }, directors).flatMap((s) => s.rows);
    expect(rows.find((r) => r.label === "Reminder of a waiting shift request")).toMatchObject({ on: false });
    expect(rows.find((r) => r.label === "Shift requests")).toMatchObject({ on: false, detail: undefined });
  });

  it("says which kinds of request are on", () => {
    const rows = overviewSections(alerts, bot, directors).flatMap((s) => s.rows);
    expect(rows.find((r) => r.label === "Shift requests")?.detail).toBe("move");
    const neither = overviewSections(alerts, { ...bot, moveRequestsEnabled: false }, directors).flatMap((s) => s.rows);
    expect(neither.find((r) => r.label === "Shift requests")?.detail).toBe("no kind of request is on");
  });

  it("warns on the morning summary when nobody with Telegram will receive it", () => {
    const nobody = directorsTelegramSummary(["u2"], [member("u2")]);
    const rows = overviewSections(alerts, bot, nobody).flatMap((s) => s.rows);
    expect(rows.find((r) => r.label === "Morning summary")?.detail).toContain("nobody with Telegram");
    expect(overviewSections(alerts, bot, directors).flatMap((s) => s.rows).find((r) => r.label === "Morning summary")?.detail).toBe("at 08:00");
  });

  describe("facts", () => {
    const staff = [member("u1", { telegramLinked: true }), member("u2", { telegramLinked: true }), member("u3"), member("gone", { isActive: false, telegramLinked: true })];
    const ready: NotificationStatus = { telegramConfigured: true, botUsername: "sunset_bot" };
    const text = (label: string, facts = overviewFacts(alerts, staff, deciders(), ready)) => facts.find((f) => f.label === label)!;

    it("counts linked employees among the active ones only", () => {
      expect(text("Staff with Telegram linked").text).toBe("2 of 3 active employees.");
    });

    it("tells the three states of Telegram apart", () => {
      expect(text("Telegram").text).toBe("Connected as @sunset_bot.");
      expect(text("Telegram").warn).toBe(false);
      const off = overviewFacts(alerts, staff, deciders(), { telegramConfigured: false });
      expect(text("Telegram", off)).toMatchObject({ warn: true });
      expect(text("Telegram", off).text).toContain("Not configured");
      const noName = overviewFacts(alerts, staff, deciders(), { telegramConfigured: true, botUsername: null });
      expect(text("Telegram", noName).text).toContain("name is not known");
      const unread = overviewFacts(alerts, staff, deciders(), null);
      expect(text("Telegram", unread).text).toContain("could not be read");
      expect(text("Telegram", unread).text).not.toContain("Not configured");
    });

    it("says who decides and shows the leave", () => {
      expect(text("HR director").text).toBe("Malee decides.");
      const away = overviewFacts(
        alerts,
        staff,
        deciders({ onVacationToday: true, vacationFrom: "2026-10-18", vacationTo: "2026-10-25", effectiveDeciders: ["Admin"] }),
        ready
      );
      expect(text("HR director", away).text).toBe("Malee is on leave today - the administrators decide (Admin). Leave: 2026-10-18 to 2026-10-25.");
      const waiting = overviewFacts(alerts, staff, deciders({ hrName: undefined, hrUserId: undefined, effectiveDeciders: [] }), ready);
      expect(text("HR director", waiting).warn).toBe(true);
    });

    it("reports the directors and the quiet hours as the settings have them", () => {
      expect(text("Directors").text).toBe("2 directors selected, 1 with Telegram linked.");
      expect(text("Directors").warn).toBe(false);
      expect(text("Quiet hours").text).toContain("22:00 to 07:00");
      const none = overviewFacts({ ...alerts, quietHoursEnabled: false, directorUserIds: [] }, staff, deciders(), ready);
      expect(text("Quiet hours", none).text).toBe("Off.");
      expect(text("Directors", none).warn).toBe(true);
    });
  });
});
