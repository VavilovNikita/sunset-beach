import { describe, expect, it } from "vitest";
import {
  blockFunctionLabel,
  defaultLogFilters,
  filterStaff,
  formatCountdown,
  languageLabel,
  linkAvailability,
  logFiltersError,
  logQueryString,
  secondsLeft,
  settingsFormDirty,
  settingsServerError,
  toSettingsForm,
  toggleId,
  validateSettingsForm,
} from "./notifications";
import type { NotificationSettings, NotificationStaffMember, NotificationStatus } from "./types";

const settings = (patch: Partial<NotificationSettings> = {}): NotificationSettings => ({
  lateEnabled: true,
  lateGraceMinutes: 10,
  minLateGraceMinutes: 5,
  absenceEnabled: true,
  absenceMinutes: 60,
  blockCreatedEnabled: true,
  blockLastDayEnabled: true,
  blockExpiredEnabled: true,
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
  ...patch,
});

const member = (patch: Partial<NotificationStaffMember> = {}): NotificationStaffMember => ({
  userId: "u1",
  name: "Somchai",
  role: "WAITER",
  isActive: true,
  telegramLinked: false,
  ...patch,
});

describe("validateSettingsForm", () => {
  it("accepts what the server sent back and turns the numbers into numbers", () => {
    const result = validateSettingsForm(toSettingsForm(settings()), 5);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.input.lateGraceMinutes).toBe(10);
      expect(result.input.directorUserIds).toEqual(["u2", "u3"]);
      expect(result.input).not.toHaveProperty("minLateGraceMinutes");
      expect(result.input).not.toHaveProperty("updatedAt");
    }
  });

  it("refuses a grace below the terminal poll interval, beside the grace field", () => {
    const form = { ...toSettingsForm(settings()), lateGraceMinutes: "4" };
    const result = validateSettingsForm(form, 5);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.lateGraceMinutes).toMatch(/at least 5 minutes/i);
  });

  it("accepts exactly the floor", () => {
    expect(validateSettingsForm({ ...toSettingsForm(settings()), lateGraceMinutes: "5" }, 5).ok).toBe(true);
  });

  it("refuses an absence threshold shorter than the grace", () => {
    const form = { ...toSettingsForm(settings()), lateGraceMinutes: "30", absenceMinutes: "20" };
    const result = validateSettingsForm(form, 5);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.absenceMinutes).toMatch(/not shorter/i);
  });

  it("rejects text, decimals and out-of-range numbers", () => {
    for (const bad of ["", "ten", "1.5", "-3", "0", "241"]) {
      const result = validateSettingsForm({ ...toSettingsForm(settings()), lateGraceMinutes: bad }, 5);
      expect(result.ok, bad).toBe(false);
    }
  });

  it("refuses quiet hours that start and end together, but only while they are on", () => {
    const same = { ...toSettingsForm(settings()), quietStart: "22:00", quietEnd: "22:00" };
    const on = validateSettingsForm(same, 5);
    expect(on.ok).toBe(false);
    if (!on.ok) expect(on.errors.quietEnd).toBeDefined();
    expect(validateSettingsForm({ ...same, quietHoursEnabled: false }, 5).ok).toBe(true);
  });

  it("allows quiet hours across midnight", () => {
    expect(validateSettingsForm({ ...toSettingsForm(settings()), quietStart: "23:30", quietEnd: "06:15" }, 5).ok).toBe(true);
  });

  it("refuses a time that is not HH:mm", () => {
    for (const bad of ["", "9:00", "24:00", "09:60", "nine"]) {
      const result = validateSettingsForm({ ...toSettingsForm(settings()), morningTime: bad }, 5);
      expect(result.ok, bad).toBe(false);
    }
  });

  it("reports every problem at once, each under its own field", () => {
    const form = { ...toSettingsForm(settings()), lateGraceMinutes: "x", terminalSilenceMinutes: "0", morningTime: "" };
    const result = validateSettingsForm(form, 5);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(Object.keys(result.errors).sort()).toEqual(["lateGraceMinutes", "morningTime", "terminalSilenceMinutes"]);
  });
});

describe("settingsFormDirty", () => {
  it("is false for the saved values, whatever the recipient order", () => {
    const saved = settings();
    expect(settingsFormDirty(toSettingsForm(saved), saved)).toBe(false);
    expect(settingsFormDirty({ ...toSettingsForm(saved), directorUserIds: ["u3", "u2"] }, saved)).toBe(false);
  });

  it("is true for any real change", () => {
    const saved = settings();
    expect(settingsFormDirty({ ...toSettingsForm(saved), lateGraceMinutes: "11" }, saved)).toBe(true);
    expect(settingsFormDirty({ ...toSettingsForm(saved), lateEnabled: false }, saved)).toBe(true);
    expect(settingsFormDirty({ ...toSettingsForm(saved), defaultLanguage: "RU" }, saved)).toBe(true);
    expect(settingsFormDirty({ ...toSettingsForm(saved), directorUserIds: ["u2"] }, saved)).toBe(true);
    expect(settingsFormDirty({ ...toSettingsForm(saved), quietEnd: "07:30" }, saved)).toBe(true);
  });

  it("treats a number typed with spaces as unchanged, and a blank one as a change", () => {
    const saved = settings();
    expect(settingsFormDirty({ ...toSettingsForm(saved), lateGraceMinutes: " 10 " }, saved)).toBe(false);
    expect(settingsFormDirty({ ...toSettingsForm(saved), lateGraceMinutes: "" }, saved)).toBe(true);
  });
});

describe("settingsServerError", () => {
  it("puts a 400 on the field the server names", () => {
    const body = { error: { formErrors: [], fieldErrors: { lateGraceMinutes: ["Must be at least 5 minutes"] } } };
    expect(settingsServerError(400, "x", body)).toEqual({ field: "lateGraceMinutes", message: "Must be at least 5 minutes" });
  });

  it("falls back to the form for anything else", () => {
    expect(settingsServerError(500, "Server error", null)).toEqual({ field: "form", message: "Server error" });
    expect(settingsServerError(400, "Bad", { error: { fieldErrors: { somethingNew: ["x"] } } })).toEqual({ field: "form", message: "Bad" });
  });
});

describe("toggleId", () => {
  it("adds and removes without mutating", () => {
    const ids = ["a"];
    expect(toggleId(ids, "b")).toEqual(["a", "b"]);
    expect(toggleId(["a", "b"], "a")).toEqual(["b"]);
    expect(ids).toEqual(["a"]);
  });
});

describe("linkAvailability", () => {
  const ready: NotificationStatus = { telegramConfigured: true, botUsername: "sunset_bot", telegramRoute: "DIRECT", telegramProxyConfigured: false, consecutiveFailures: 0 };

  it("allows an active employee when the bot is known", () => {
    expect(linkAvailability(member(), ready).allowed).toBe(true);
  });

  it("says why not", () => {
    expect(linkAvailability(member(), { telegramConfigured: false, telegramRoute: "DIRECT", telegramProxyConfigured: false, consecutiveFailures: 0 })).toMatchObject({ allowed: false, reason: expect.stringMatching(/not configured/i) });
    expect(linkAvailability(member(), { telegramConfigured: true, botUsername: null, telegramRoute: "DIRECT", telegramProxyConfigured: false, consecutiveFailures: 0 })).toMatchObject({ allowed: false, reason: expect.stringMatching(/name is not known/i) });
    expect(linkAvailability(member({ isActive: false }), ready)).toMatchObject({ allowed: false, reason: expect.stringMatching(/deactivated/i) });
  });
});

describe("filterStaff", () => {
  const staff = [member({ userId: "1", name: "Somchai" }), member({ userId: "2", name: "Pim", telegramLinked: true }), member({ userId: "3", name: "Somsak" })];

  it("matches names ignoring case and outer spaces", () => {
    expect(filterStaff(staff, "  SOM ", false).map((m) => m.userId)).toEqual(["1", "3"]);
  });

  it("can show only those still to link", () => {
    expect(filterStaff(staff, "", true).map((m) => m.userId)).toEqual(["1", "3"]);
  });
});

describe("link code countdown", () => {
  const expires = "2026-10-17T03:15:00Z";
  const at = (iso: string) => new Date(iso).getTime();

  it("counts down and never goes negative", () => {
    expect(secondsLeft(expires, at("2026-10-17T03:00:00Z"))).toBe(900);
    expect(secondsLeft(expires, at("2026-10-17T03:14:59.500Z"))).toBe(1);
    expect(secondsLeft(expires, at("2026-10-17T03:15:00Z"))).toBe(0);
    expect(secondsLeft(expires, at("2026-10-17T04:00:00Z"))).toBe(0);
    expect(secondsLeft("garbage", 0)).toBe(0);
  });

  it("formats minutes and seconds", () => {
    expect(formatCountdown(900)).toBe("15:00");
    expect(formatCountdown(65)).toBe("1:05");
    expect(formatCountdown(0)).toBe("0:00");
  });
});

describe("log filters", () => {
  it("default to the last seven hotel days", () => {
    // 20:30 UTC on the 16th is 03:30 on the 17th in Bangkok.
    expect(defaultLogFilters(new Date("2026-10-16T20:30:00Z"))).toEqual({ from: "2026-10-11", to: "2026-10-17", type: "", deliveryStatus: "" });
  });

  it("builds the query without empty filters", () => {
    expect(logQueryString({ from: "2026-10-11", to: "", type: "", deliveryStatus: "" })).toBe("from=2026-10-11&limit=200");
    expect(logQueryString({ from: "2026-10-11", to: "2026-10-17", type: "LATE", deliveryStatus: "NO_CHANNEL" }, 50)).toBe(
      "from=2026-10-11&to=2026-10-17&type=LATE&deliveryStatus=NO_CHANNEL&limit=50"
    );
  });

  it("notices a backwards range", () => {
    expect(logFiltersError({ from: "2026-10-17", to: "2026-10-11", type: "", deliveryStatus: "" })).toMatch(/on or before/);
    expect(logFiltersError({ from: "2026-10-11", to: "2026-10-11", type: "", deliveryStatus: "" })).toBeNull();
    expect(logFiltersError({ from: "", to: "2026-10-11", type: "", deliveryStatus: "" })).toBeNull();
  });
});

describe("labels", () => {
  it("names a block with no function as the directors' matter", () => {
    expect(blockFunctionLabel("HOUSEKEEPER")).toBe("Housekeeper");
    expect(blockFunctionLabel(undefined)).toMatch(/directors/);
  });

  it("shows the inherited default language as such", () => {
    expect(languageLabel("RU")).toBe("Русский");
    expect(languageLabel(undefined, "EN")).toBe("Default (English)");
    expect(languageLabel(undefined)).toBe("Default");
  });
});
