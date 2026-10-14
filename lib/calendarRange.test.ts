import { describe, expect, it } from "vitest";
import { toDateKey } from "@/lib/bookings";
import { calendarHref, periodFromToday, toExclusiveFromParam } from "@/lib/calendarRange";

describe("periodFromToday", () => {
  it("opens on today, a month wide, with nothing remembered", () => {
    expect(periodFromToday("2026-10-03", null)).toEqual({ from: "2026-10-03", to: "2026-11-03" });
  });

  it("keeps the width last chosen but starts today, not on the remembered dates", () => {
    // The user last looked at September as a 30-day window - the calendar must not reopen there.
    expect(periodFromToday("2026-10-03", { from: "2026-09-01", to: "2026-10-01" })).toEqual({ from: "2026-10-03", to: "2026-11-02" });
  });

  it("ignores a remembered width outside what the calendar can show", () => {
    expect(periodFromToday("2026-10-03", { from: "2020-01-01", to: "2026-01-01" })).toEqual({ from: "2026-10-03", to: "2026-11-03" });
  });
});

describe("calendar address", () => {
  it("writes the last day on screen as `to`", () => {
    expect(calendarHref("2026-10-14", "2026-10-21")).toBe("/admin/bookings/calendar?from=2026-10-14&to=2026-10-20");
  });

  it("reads `to` back as the exclusive end the app works with", () => {
    expect(toDateKey(toExclusiveFromParam("2026-10-20"))).toBe("2026-10-21");
  });

  it("a one-day period has the same from and to", () => {
    expect(calendarHref("2026-10-14", "2026-10-15")).toBe("/admin/bookings/calendar?from=2026-10-14&to=2026-10-14");
  });
});
