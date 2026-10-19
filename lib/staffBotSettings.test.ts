import { describe, expect, it } from "vitest";
import {
  BOT_GROUPS,
  BOT_NUMBER_FIELDS,
  BOT_TIME_FIELDS,
  botSettingsFormDirty,
  botSettingsServerError,
  directorsTelegramSummary,
  toBotSettingsForm,
  validateBotSettingsForm,
} from "./staffBotSettings";
import type { NotificationStaffMember, StaffBotSettings } from "./types";

const saved: StaffBotSettings = {
  myShiftsEnabled: true,
  myDayEnabled: true,
  myMonthEnabled: true,
  myRequestsEnabled: true,
  botSettingsEnabled: true,
  requestsEnabled: true,
  moveRequestsEnabled: true,
  deleteRequestsEnabled: true,
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
  housekeeperBlocksEnabled: true,
  housekeeperBlocksDays: 7,
  therapistScheduleEnabled: true,
  therapistScheduleDays: 2,
  therapistMorningEnabled: true,
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

describe("the bot settings form", () => {
  it("round-trips the saved settings and sends them as numbers", () => {
    const { updatedAt: _ignored, ...asInput } = saved;
    expect(validateBotSettingsForm(toBotSettingsForm(saved))).toEqual({ ok: true, input: asInput });
  });

  it("checks every number against the server's range, beside its own field", () => {
    const form = toBotSettingsForm(saved);
    const bad = {
      ...form,
      requestMinHoursBefore: "721",
      moveWindowDays: "0",
      moveMaxDaysAhead: "181",
      myShiftsDays: "61",
      pendingReminderHours: "x",
      rosterChangeHorizonDays: "91",
      rosterChangeDelayMinutes: "",
      housekeeperBlocksDays: "61",
      therapistScheduleDays: "15",
    };
    const result = validateBotSettingsForm(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(
        [
          "housekeeperBlocksDays",
          "moveMaxDaysAhead",
          "moveWindowDays",
          "myShiftsDays",
          "pendingReminderHours",
          "requestMinHoursBefore",
          "rosterChangeDelayMinutes",
          "rosterChangeHorizonDays",
          "therapistScheduleDays",
        ].sort()
      );
      expect(result.errors.requestMinHoursBefore).toBe("A whole number from 0 to 720.");
    }
  });

  it("allows the edges of every range", () => {
    for (const f of BOT_NUMBER_FIELDS) {
      for (const edge of [f.min, f.max]) {
        // The two move limits are tied (horizon >= window): move the partner out of the way for the edge being tried.
        const partner = f.key === "moveWindowDays" ? { moveMaxDaysAhead: "180" } : f.key === "moveMaxDaysAhead" ? { moveWindowDays: "1" } : {};
        const result = validateBotSettingsForm({ ...toBotSettingsForm(saved), ...partner, [f.key]: String(edge) });
        expect(result.ok, `${f.key}=${edge}`).toBe(true);
      }
    }
  });

  it("keeps the move horizon at least as long as the buttons' window, beside the horizon field", () => {
    const form = toBotSettingsForm(saved);
    expect(validateBotSettingsForm({ ...form, moveWindowDays: "30", moveMaxDaysAhead: "20" })).toEqual({
      ok: false,
      errors: { moveMaxDaysAhead: "Not less than the move window (30 days)." },
    });
    expect(validateBotSettingsForm({ ...form, moveWindowDays: "30", moveMaxDaysAhead: "30" }).ok).toBe(true);
    // A malformed window is reported on the window, not turned into a second, confusing message on the horizon.
    const both = validateBotSettingsForm({ ...form, moveWindowDays: "x", moveMaxDaysAhead: "20" });
    expect(both.ok).toBe(false);
    if (!both.ok) expect(Object.keys(both.errors)).toEqual(["moveWindowDays"]);
  });

  it("attributes the server's 400 on the horizon to its own field", () => {
    const body = { error: { fieldErrors: { moveMaxDaysAhead: ["Must be at least the number of nearest days shown as buttons (14)"] } } };
    expect(botSettingsServerError(400, "Validation failed", body)).toEqual({
      field: "moveMaxDaysAhead",
      message: "Must be at least the number of nearest days shown as buttons (14)",
    });
  });

  it("wants every time as HH:mm, each message beside its own time", () => {
    expect(validateBotSettingsForm({ ...toBotSettingsForm(saved), eveReminderTime: "6pm" })).toEqual({ ok: false, errors: { eveReminderTime: "A time like 18:00." } });
    expect(validateBotSettingsForm({ ...toBotSettingsForm(saved), eveReminderTime: "07:30" }).ok).toBe(true);
    expect(validateBotSettingsForm({ ...toBotSettingsForm(saved), morningSummaryTime: "25:00", therapistMorningTime: "later" })).toEqual({
      ok: false,
      errors: { morningSummaryTime: "A time like 08:00.", therapistMorningTime: "A time like 08:00." },
    });
    for (const t of BOT_TIME_FIELDS) expect(validateBotSettingsForm({ ...toBotSettingsForm(saved), [t.key]: "23:59" }).ok).toBe(true);
  });

  it("shows every setting of the server exactly once, in the group of the screen it belongs to", () => {
    const shown = BOT_GROUPS.flatMap((g) => [...g.toggles.map((t) => t.key as string), ...g.numbers, ...g.times]);
    const { updatedAt: _ignored, ...settings } = saved;
    expect([...shown].sort()).toEqual(Object.keys(settings).sort());
    expect(new Set(shown).size).toBe(shown.length);
    expect(BOT_GROUPS.map((g) => g.id)).toEqual(["personal", "requests", "engineer", "housekeeping", "spa", "managers", "summary"]);
  });

  it("enables Save only for a real change, comparing numbers as numbers", () => {
    const form = toBotSettingsForm(saved);
    expect(botSettingsFormDirty(form, saved)).toBe(false);
    expect(botSettingsFormDirty({ ...form, requestMinHoursBefore: " 24 " }, saved)).toBe(false);
    expect(botSettingsFormDirty({ ...form, requestMinHoursBefore: "36" }, saved)).toBe(true);
    expect(botSettingsFormDirty({ ...form, requestMinHoursBefore: "" }, saved)).toBe(true);
    expect(botSettingsFormDirty({ ...form, allowTodayRequests: true }, saved)).toBe(true);
    expect(botSettingsFormDirty({ ...form, eveReminderTime: "19:00" }, saved)).toBe(true);
    expect(botSettingsFormDirty({ ...form, summaryRooms: false }, saved)).toBe(true);
    expect(botSettingsFormDirty({ ...form, therapistScheduleDays: " 2 " }, saved)).toBe(false);
    expect(botSettingsFormDirty({ ...form, morningSummaryTime: "09:00" }, saved)).toBe(true);
  });

  it("tells how many of the chosen directors can actually receive the morning summary", () => {
    expect(directorsTelegramSummary([], [member("a")])).toMatchObject({ selected: 0, linked: 0 });
    expect(directorsTelegramSummary([], [member("a")]).text).toContain("nobody will receive");
    const none = directorsTelegramSummary(["a", "b"], [member("a"), member("b")]);
    expect(none).toMatchObject({ selected: 2, linked: 0 });
    expect(none.text).toBe("2 directors selected, none of them has Telegram linked: the summary will be written to the log but nobody will receive it.");
    expect(directorsTelegramSummary(["a", "b", "a"], [member("a", { telegramLinked: true }), member("b")]).text).toBe("2 directors selected, 1 with Telegram linked.");
    expect(directorsTelegramSummary(["a"], [member("a", { telegramLinked: true })]).text).toBe("1 director selected, all with Telegram linked.");
    // Someone deactivated or no longer in the list is not a recipient: the server skips them.
    expect(directorsTelegramSummary(["a", "gone"], [member("a", { isActive: false, telegramLinked: true })])).toMatchObject({ selected: 0, linked: 0 });
  });

  it("puts a server 400 on the field it names, anything else on the form", () => {
    const body = { error: { fieldErrors: { moveWindowDays: ["must be between 1 and 90"] } } };
    expect(botSettingsServerError(400, "Validation failed", body)).toEqual({ field: "moveWindowDays", message: "must be between 1 and 90" });
    expect(botSettingsServerError(400, "Must be a time like 18:00", { error: { fieldErrors: { eveReminderTime: ["Must be a time like 18:00"] } } }).field).toBe("eveReminderTime");
    expect(botSettingsServerError(400, "Validation failed", { error: { fieldErrors: { morningSummaryTime: ["Must be a time like 08:00"] } } })).toEqual({
      field: "morningSummaryTime",
      message: "Must be a time like 08:00",
    });
    expect(botSettingsServerError(400, "Validation failed", { error: { fieldErrors: { housekeeperBlocksDays: ["must be between 1 and 60"] } } }).field).toBe("housekeeperBlocksDays");
    expect(botSettingsServerError(500, "Could not save the bot settings.", null)).toEqual({ field: "form", message: "Could not save the bot settings." });
    expect(botSettingsServerError(403, "Forbidden", { error: "Forbidden" }).field).toBe("form");
  });
});
