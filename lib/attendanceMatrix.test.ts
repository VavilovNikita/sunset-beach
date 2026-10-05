import { describe, expect, it } from "vitest";
import { attendanceCell, hotelToday, totalWorkedMinutes } from "./attendanceMatrix";
import type { AttendanceDaySummary } from "./types";

function punch(iso: string) {
  return { punchAt: iso } as AttendanceDaySummary["punches"][number];
}
function day(date: string, punches: string[], planned = false): AttendanceDaySummary {
  return {
    date,
    shiftCode: planned ? ({ code: "7" } as AttendanceDaySummary["shiftCode"]) : null,
    plannedIntervals: [],
    punches: punches.map(punch),
    workedMinutes: null,
    incomplete: punches.length % 2 !== 0,
  };
}

describe("attendanceCell", () => {
  it("pairs punches and shows hotel-local times", () => {
    const cell = attendanceCell(day("2026-10-02", ["2026-10-02T07:02:00+07:00", "2026-10-02T16:07:00+07:00"]), "2026-10-05");
    expect(cell).toEqual({ lines: ["07:02–16:07"], tone: "ok" });
  });

  it("a split shift is two lines", () => {
    const cell = attendanceCell(
      day("2026-10-02", ["2026-10-02T08:00:00+07:00", "2026-10-02T12:00:00+07:00", "2026-10-02T16:00:00+07:00", "2026-10-02T21:00:00+07:00"]),
      "2026-10-05"
    );
    expect(cell.lines).toEqual(["08:00–12:00", "16:00–21:00"]);
  });

  it("a lone punch on a past day is incomplete, today it is just still in the house", () => {
    const past = attendanceCell(day("2026-10-02", ["2026-10-02T09:00:00+07:00"]), "2026-10-05");
    expect(past).toEqual({ lines: ["09:00–?"], tone: "incomplete" });
    const today = attendanceCell(day("2026-10-05", ["2026-10-05T09:00:00+07:00"]), "2026-10-05");
    expect(today).toEqual({ lines: ["09:00–…"], tone: "ok" });
  });

  it("a scheduled day with no punches is missed only once it is over", () => {
    expect(attendanceCell(day("2026-10-04", [], true), "2026-10-05").tone).toBe("missed");
    expect(attendanceCell(day("2026-10-05", [], true), "2026-10-05").tone).toBe("empty");
    expect(attendanceCell(day("2026-10-20", [], true), "2026-10-05").tone).toBe("empty");
  });

  it("an unscheduled day with no punches is empty", () => {
    expect(attendanceCell(day("2026-10-04", []), "2026-10-05").tone).toBe("empty");
  });
});

describe("helpers", () => {
  it("hotelToday uses Bangkok's calendar day", () => {
    expect(hotelToday(new Date("2026-10-04T18:30:00Z"))).toBe("2026-10-05");
  });
  it("totalWorkedMinutes ignores days without a figure", () => {
    expect(totalWorkedMinutes([{ ...day("a", []), workedMinutes: 60 }, day("b", []), { ...day("c", []), workedMinutes: 30 }])).toBe(90);
  });
});
