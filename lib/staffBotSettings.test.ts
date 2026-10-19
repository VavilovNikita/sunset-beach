import { describe, expect, it } from "vitest";
import { BOT_NUMBER_FIELDS, botSettingsFormDirty, botSettingsServerError, toBotSettingsForm, validateBotSettingsForm } from "./staffBotSettings";
import type { StaffBotSettings } from "./types";

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
  updatedAt: "2026-10-19T10:00:00Z",
};

describe("the bot settings form", () => {
  it("round-trips the saved settings and sends them as numbers", () => {
    const { updatedAt: _ignored, ...asInput } = saved;
    expect(validateBotSettingsForm(toBotSettingsForm(saved))).toEqual({ ok: true, input: asInput });
  });

  it("checks every number against the server's range, beside its own field", () => {
    const form = toBotSettingsForm(saved);
    const bad = { ...form, requestMinHoursBefore: "721", moveWindowDays: "0", myShiftsDays: "61", pendingReminderHours: "x", rosterChangeHorizonDays: "91", rosterChangeDelayMinutes: "" };
    const result = validateBotSettingsForm(bad);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(
        ["moveWindowDays", "myShiftsDays", "pendingReminderHours", "requestMinHoursBefore", "rosterChangeDelayMinutes", "rosterChangeHorizonDays"].sort()
      );
      expect(result.errors.requestMinHoursBefore).toBe("A whole number from 0 to 720.");
    }
  });

  it("allows the edges of every range", () => {
    for (const f of BOT_NUMBER_FIELDS) {
      for (const edge of [f.min, f.max]) {
        const result = validateBotSettingsForm({ ...toBotSettingsForm(saved), [f.key]: String(edge) });
        expect(result.ok, `${f.key}=${edge}`).toBe(true);
      }
    }
  });

  it("wants the evening time as HH:mm", () => {
    expect(validateBotSettingsForm({ ...toBotSettingsForm(saved), eveReminderTime: "6pm" })).toEqual({ ok: false, errors: { eveReminderTime: "A time like 18:00." } });
    expect(validateBotSettingsForm({ ...toBotSettingsForm(saved), eveReminderTime: "07:30" }).ok).toBe(true);
  });

  it("enables Save only for a real change, comparing numbers as numbers", () => {
    const form = toBotSettingsForm(saved);
    expect(botSettingsFormDirty(form, saved)).toBe(false);
    expect(botSettingsFormDirty({ ...form, requestMinHoursBefore: " 24 " }, saved)).toBe(false);
    expect(botSettingsFormDirty({ ...form, requestMinHoursBefore: "36" }, saved)).toBe(true);
    expect(botSettingsFormDirty({ ...form, requestMinHoursBefore: "" }, saved)).toBe(true);
    expect(botSettingsFormDirty({ ...form, allowTodayRequests: true }, saved)).toBe(true);
    expect(botSettingsFormDirty({ ...form, eveReminderTime: "19:00" }, saved)).toBe(true);
  });

  it("puts a server 400 on the field it names, anything else on the form", () => {
    const body = { error: { fieldErrors: { moveWindowDays: ["must be between 1 and 90"] } } };
    expect(botSettingsServerError(400, "Validation failed", body)).toEqual({ field: "moveWindowDays", message: "must be between 1 and 90" });
    expect(botSettingsServerError(400, "Must be a time like 18:00", { error: { fieldErrors: { eveReminderTime: ["Must be a time like 18:00"] } } }).field).toBe("eveReminderTime");
    expect(botSettingsServerError(500, "Could not save the bot settings.", null)).toEqual({ field: "form", message: "Could not save the bot settings." });
    expect(botSettingsServerError(403, "Forbidden", { error: "Forbidden" }).field).toBe("form");
  });
});
