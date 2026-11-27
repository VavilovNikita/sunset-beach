import { describe, expect, it } from "vitest";
import { livePunches, punchTimes, replacedVersions, sameTimes, validateTimes } from "./attendanceDay";
import type { AttendancePunch } from "./types";

function punch(punchAt: string, extra: Partial<AttendancePunch> = {}): AttendancePunch {
  return { id: punchAt, punchAt, ...extra } as AttendancePunch;
}

describe("punchTimes", () => {
  it("reads hotel time off the offset-carrying string, whatever the browser's zone", () => {
    expect(punchTimes([punch("2026-10-05T09:00:00+07:00"), punch("2026-10-05T17:30:00+07:00")])).toEqual(["09:00", "17:30"]);
    // The same instants written in UTC still read as Bangkok wall-clock.
    expect(punchTimes([punch("2026-10-05T02:00:00Z")])).toEqual(["09:00"]);
  });
});

describe("validateTimes", () => {
  it("accepts increasing times and an empty day", () => {
    expect(validateTimes(["09:00", "17:00"])).toBeNull();
    expect(validateTimes([])).toBeNull();
  });
  it("rejects a blank row, a repeat and an out-of-order pair", () => {
    expect(validateTimes(["09:00", ""])).not.toBeNull();
    expect(validateTimes(["09:00", "09:00"])).not.toBeNull();
    expect(validateTimes(["17:00", "09:00"])).not.toBeNull();
  });
});

describe("sameTimes", () => {
  it("compares in order", () => {
    expect(sameTimes(["09:00", "17:00"], ["09:00", "17:00"])).toBe(true);
    expect(sameTimes(["09:00"], ["09:00", "17:00"])).toBe(false);
  });
});

describe("replacedVersions", () => {
  it("groups voided punches by the correction that replaced them, oldest first", () => {
    const history = [
      punch("2026-10-05T09:00:00+07:00", { voidedAt: "2026-10-06T01:00:00Z", voidedByEmail: "a@x", voidReason: "first fix" }),
      punch("2026-10-05T17:00:00+07:00", { voidedAt: "2026-10-06T01:00:00Z", voidedByEmail: "a@x", voidReason: "first fix" }),
      punch("2026-10-05T10:00:00+07:00", { voidedAt: "2026-10-06T02:00:00Z", voidedByEmail: "b@x", voidReason: "second fix" }),
      punch("2026-10-05T09:00:00+07:00"),
    ];
    expect(replacedVersions(history)).toEqual([
      { id: "2026-10-06T01:00:00Z", correctedAt: "2026-10-06T01:00:00Z", correctedByEmail: "a@x", reason: "first fix", times: ["09:00", "17:00"] },
      { id: "2026-10-06T02:00:00Z", correctedAt: "2026-10-06T02:00:00Z", correctedByEmail: "b@x", reason: "second fix", times: ["10:00"] },
    ]);
    expect(livePunches(history)).toHaveLength(1);
  });

  it("keeps a correction of an empty day, which voided nothing", () => {
    const added = { correctionId: "c1", createdAt: "2026-11-27T11:11:36Z", recordedByEmail: "m@x", note: "forgot the card" };
    const history = [punch("2026-11-05T09:00:00+07:00", added), punch("2026-11-05T18:00:00+07:00", added)];
    expect(replacedVersions(history)).toEqual([
      { id: "c1", correctedAt: "2026-11-27T11:11:36Z", correctedByEmail: "m@x", reason: "forgot the card", times: [] },
    ]);
  });

  it("ties what a later correction voided to it, not to the one that recorded those punches", () => {
    const history = [
      punch("2026-11-05T09:00:00+07:00", {
        correctionId: "c1",
        createdAt: "2026-11-27T11:00:00Z",
        note: "added",
        voidedAt: "2026-11-27T12:00:00Z",
        voidedByCorrectionId: "c2",
        voidReason: "was ten",
        voidedByEmail: "b@x",
      }),
      punch("2026-11-05T10:00:00+07:00", { correctionId: "c2", createdAt: "2026-11-27T12:00:00Z", note: "was ten" }),
    ];
    expect(replacedVersions(history).map((v) => [v.id, v.reason, v.times])).toEqual([
      ["c1", "added", []],
      ["c2", "was ten", ["09:00"]],
    ]);
  });
});
