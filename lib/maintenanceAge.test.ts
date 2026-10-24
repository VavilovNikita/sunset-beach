import { describe, expect, it } from "vitest";
import { taskOpenDays, taskOpenLabel } from "@/lib/maintenanceAge";

describe("taskOpenDays", () => {
  it("counts hotel calendar days, not 24-hour blocks", () => {
    // 23:00 Bangkok on the 10th (16:00Z) looked at 08:00 Bangkok on the 11th (01:00Z)
    expect(taskOpenDays("2026-10-10T16:00:00Z", null, new Date("2026-10-11T01:00:00Z"))).toBe(1);
    expect(taskOpenDays("2026-10-10T02:00:00Z", null, new Date("2026-10-10T10:00:00Z"))).toBe(0);
  });
  it("measures a closed task to its closing day", () => {
    expect(taskOpenDays("2026-10-01T05:00:00Z", "2026-10-04T05:00:00Z", new Date("2026-12-01T00:00:00Z"))).toBe(3);
  });
});

describe("taskOpenLabel", () => {
  it("words it", () => {
    const now = new Date("2026-10-24T05:00:00Z");
    expect(taskOpenLabel("2026-10-24T01:00:00Z", null, now)).toBe("open since today");
    expect(taskOpenLabel("2026-10-23T01:00:00Z", null, now)).toBe("open 1 day");
    expect(taskOpenLabel("2026-10-14T01:00:00Z", null, now)).toBe("open 10 days");
    expect(taskOpenLabel("2026-10-14T01:00:00Z", "2026-10-16T01:00:00Z", now)).toBe("took 2 days");
  });
});
