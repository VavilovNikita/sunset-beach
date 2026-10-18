import { describe, expect, it } from "vitest";
import { REPORT_TABS, parseReportTab, reportsHiddenFields, reportsHref, type ReportsState } from "./reportsTabs";

const state: ReportsState = { tab: "occupancy", date: "2026-10-01", from: "2026-09-01", to: "2026-09-30", limit: "100" };

describe("parseReportTab", () => {
  it("defaults to the first tab for nothing or an unknown key", () => {
    expect(parseReportTab(undefined)).toBe("manager");
    expect(parseReportTab("nope")).toBe("manager");
    expect(REPORT_TABS[0].key).toBe("manager");
  });
  it("accepts every tab key", () => {
    for (const t of REPORT_TABS) expect(parseReportTab(t.key)).toBe(t.key);
  });
});

describe("reportsHref", () => {
  it("switching tabs keeps every chosen parameter", () => {
    expect(reportsHref(state, { tab: "guests" })).toBe(
      "/admin/reports?tab=guests&date=2026-10-01&from=2026-09-01&to=2026-09-30&limit=100"
    );
  });
  it("leaves out parameters nobody chose", () => {
    expect(reportsHref({ tab: "manager" })).toBe("/admin/reports?tab=manager");
  });
  it("an explicit undefined drops a parameter (the Today link)", () => {
    expect(reportsHref({ ...state, tab: "manager" }, { date: undefined })).not.toContain("date=");
  });
});

describe("reportsHiddenFields", () => {
  it("carries the tab and the other tabs' parameters, not the form's own", () => {
    expect(reportsHiddenFields(state, ["from", "to"])).toEqual([
      ["tab", "occupancy"],
      ["date", "2026-10-01"],
      ["limit", "100"],
    ]);
    expect(reportsHiddenFields(state, ["date"]).map(([n]) => n)).toEqual(["tab", "from", "to", "limit"]);
  });
});
