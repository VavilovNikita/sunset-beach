import { describe, expect, it } from "vitest";
import {
  AC_TEMP_MAX,
  AC_TEMP_MIN,
  acCommand,
  clampTemp,
  defaultTypeForCategory,
  describeCommand,
  initialAcSetting,
  lastCommandCaption,
  lastKnownOn,
  moveId,
  sameSetting,
} from "./gym";
import type { GymAcCommand } from "./types";

const COMMAND: GymAcCommand = { power: 1, mode: 0, temp: 24, wind: 2, sentAt: "2026-10-13T07:05:00+07:00", sentBy: "Nok" };

describe("clampTemp", () => {
  it("keeps a temperature inside what the unit accepts", () => {
    expect(clampTemp(10)).toBe(AC_TEMP_MIN);
    expect(clampTemp(99)).toBe(AC_TEMP_MAX);
    expect(clampTemp(23.6)).toBe(24);
    expect(clampTemp(NaN)).toBe(24);
  });
});

describe("initialAcSetting", () => {
  it("starts from the last command that was sent", () => {
    expect(initialAcSetting({ lastCommand: COMMAND })).toEqual({ mode: 0, temp: 24, wind: 2 });
    expect(initialAcSetting({ lastCommand: { ...COMMAND, power: 0, mode: 3, temp: 18, wind: 1 } })).toEqual({ mode: 3, temp: 18, wind: 1 });
  });

  it("starts from a default when nothing was sent, without pretending to know the unit", () => {
    expect(initialAcSetting({ lastCommand: null })).toEqual({ mode: 0, temp: 24, wind: 0 });
    expect(initialAcSetting({})).toEqual({ mode: 0, temp: 24, wind: 0 });
  });
});

describe("acCommand", () => {
  it("carries the whole setting, also when switching off", () => {
    expect(acCommand(0, { mode: 1, temp: 20, wind: 3 })).toEqual({ power: 0, mode: 1, temp: 20, wind: 3 });
    expect(acCommand(1, { mode: 2, temp: 50, wind: 0 })).toEqual({ power: 1, mode: 2, temp: AC_TEMP_MAX, wind: 0 });
  });
});

describe("lastKnownOn / sameSetting", () => {
  it("is on only when the last command switched it on", () => {
    expect(lastKnownOn({ lastCommand: COMMAND })).toBe(true);
    expect(lastKnownOn({ lastCommand: { ...COMMAND, power: 0 } })).toBe(false);
    expect(lastKnownOn({ lastCommand: null })).toBe(false);
  });

  it("compares the three settings", () => {
    expect(sameSetting({ mode: 0, temp: 24, wind: 0 }, { mode: 0, temp: 24, wind: 0 })).toBe(true);
    expect(sameSetting({ mode: 0, temp: 24, wind: 0 }, { mode: 0, temp: 25, wind: 0 })).toBe(false);
  });
});

describe("describeCommand / lastCommandCaption", () => {
  it("says what was sent in words", () => {
    expect(describeCommand(COMMAND)).toBe("on, cool, 24°, fan 2");
    expect(describeCommand({ ...COMMAND, wind: 0 })).toBe("on, cool, 24°, fan auto");
    expect(describeCommand({ ...COMMAND, power: 0 })).toBe("off");
  });

  it("names when and by whom, in hotel time", () => {
    expect(lastCommandCaption(COMMAND)).toBe("last command: on, cool, 24°, fan 2 (13 Oct 2026, 07:05, Nok)");
  });

  it("says plainly that nothing was sent yet", () => {
    expect(lastCommandCaption(null)).toBe("last command: none sent yet");
  });
});

describe("moveId", () => {
  it("swaps with the neighbour", () => {
    expect(moveId(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveId(["a", "b", "c"], "b", 1)).toEqual(["a", "c", "b"]);
  });

  it("leaves the list alone at the ends or for an unknown id", () => {
    expect(moveId(["a", "b"], "a", -1)).toEqual(["a", "b"]);
    expect(moveId(["a", "b"], "b", 1)).toEqual(["a", "b"]);
    expect(moveId(["a", "b"], "x", 1)).toEqual(["a", "b"]);
  });
});

describe("defaultTypeForCategory", () => {
  it("maps the categories seen on the project", () => {
    expect(defaultTypeForCategory("kg")).toBe("RELAY");
    expect(defaultTypeForCategory("qt")).toBe("AC_IR");
    expect(defaultTypeForCategory("wnykq")).toBeNull();
    expect(defaultTypeForCategory("wxkg")).toBeNull();
  });
});
