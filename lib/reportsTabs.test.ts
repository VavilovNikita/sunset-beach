import { describe, expect, it } from "vitest";
import { REPORT_TABS, parseManagerSection, parseReportTab, reportsHiddenFields, reportsHref, type ReportsState } from "./reportsTabs";

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

describe("section (manager report sub-tab)", () => {
  it("falls back to the first section for nothing or an unknown key", () => {
    expect(parseManagerSection(undefined)).toBe("rooms");
    expect(parseManagerSection("nope")).toBe("rooms");
    expect(parseManagerSection("revenue")).toBe("revenue");
  });
  it("survives a tab switch and stays out of the address when not chosen", () => {
    const withSection: ReportsState = { tab: "manager", section: "accounts", date: "2026-10-01" };
    expect(reportsHref(withSection, { tab: "guests" })).toBe("/admin/reports?tab=guests&date=2026-10-01&section=accounts");
    expect(reportsHref({ tab: "manager" })).not.toContain("section");
  });
  it("is kept by the date form and the Today link", () => {
    const withSection: ReportsState = { tab: "manager", section: "revenue", date: "2026-10-01" };
    expect(reportsHiddenFields(withSection, ["date"])).toEqual([
      ["tab", "manager"],
      ["section", "revenue"],
    ]);
    expect(reportsHref(withSection, { date: undefined })).toBe("/admin/reports?tab=manager&section=revenue");
  });
  it("is carried by the other tabs' forms", () => {
    const s: ReportsState = { tab: "occupancy", section: "guests" };
    expect(reportsHiddenFields(s, ["from", "to"])).toEqual([
      ["tab", "occupancy"],
      ["section", "guests"],
    ]);
  });
});
