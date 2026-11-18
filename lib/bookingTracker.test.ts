import { describe, expect, it } from "vitest";
import {
  addMonths,
  axisTicks,
  barLayout,
  defaultSeason,
  DEFAULT_CHART_BOX,
  lineLayout,
  monthLabel,
  monthsBetween,
  niceMax,
  normalizeBaht,
  notesDirty,
  notesError,
  notesFormFrom,
  notesPatch,
  parseTargetsForm,
  parseTrackerParams,
  polylinePoints,
  targetsDirty,
  targetsFormFrom,
  trackerQuery,
  validateTrackerParams,
} from "./bookingTracker";

describe("defaultSeason", () => {
  it("is the November-April season that contains today", () => {
    expect(defaultSeason("2026-11-18")).toEqual({ from: "2026-11", to: "2027-04" });
    expect(defaultSeason("2026-12-31")).toEqual({ from: "2026-11", to: "2027-04" });
    expect(defaultSeason("2027-01-01")).toEqual({ from: "2026-11", to: "2027-04" });
    expect(defaultSeason("2027-04-30")).toEqual({ from: "2026-11", to: "2027-04" });
  });
  it("is the coming season from May to October", () => {
    expect(defaultSeason("2027-05-01")).toEqual({ from: "2027-11", to: "2028-04" });
    expect(defaultSeason("2027-10-31")).toEqual({ from: "2027-11", to: "2028-04" });
  });
});

describe("month arithmetic", () => {
  it("adds across a year end and lists a range inclusively", () => {
    expect(addMonths("2026-11", 5)).toBe("2027-04");
    expect(addMonths("2026-01", -1)).toBe("2025-12");
    expect(monthsBetween("2026-11", "2027-02")).toEqual(["2026-11", "2026-12", "2027-01", "2027-02"]);
  });
  it("labels a month", () => {
    expect(monthLabel("2026-11")).toBe("Nov 2026");
    expect(monthLabel("nonsense")).toBe("nonsense");
  });
});

describe("validateTrackerParams", () => {
  it("accepts nothing (the default season) and a good range", () => {
    expect(validateTrackerParams("", "", "")).toEqual({ ok: true, params: {} });
    expect(validateTrackerParams("2026-11", "2027-04", "")).toEqual({ ok: true, params: { fromMonth: "2026-11", toMonth: "2027-04" } });
    expect(validateTrackerParams("2026-11", "2027-04", "2027-01")).toEqual({
      ok: true,
      params: { fromMonth: "2026-11", toMonth: "2027-04", stayMonth: "2027-01" },
    });
  });
  it("refuses one end alone, a backwards range, more than 12 months and a stay month outside", () => {
    expect(validateTrackerParams("2026-11", "", "").ok).toBe(false);
    expect(validateTrackerParams("", "2026-11", "").ok).toBe(false);
    expect(validateTrackerParams("2027-04", "2026-11", "").ok).toBe(false);
    expect(validateTrackerParams("2026-01", "2027-01", "").ok).toBe(false); // 13 months
    expect(validateTrackerParams("2026-01", "2026-12", "").ok).toBe(true); // exactly 12
    expect(validateTrackerParams("2026-11", "2027-04", "2027-05").ok).toBe(false);
    expect(validateTrackerParams("2026-11", "2027-04", "2026-10").ok).toBe(false);
    expect(validateTrackerParams("", "", "2027-01").ok).toBe(false);
    expect(validateTrackerParams("2026-13", "2027-01", "").ok).toBe(false);
  });
});

describe("parseTrackerParams / trackerQuery", () => {
  it("falls back to the default for a hand-edited address", () => {
    expect(parseTrackerParams({ fromMonth: "2026-11" })).toEqual({});
    expect(parseTrackerParams({ fromMonth: "x", toMonth: "y" })).toEqual({});
    expect(parseTrackerParams({ fromMonth: "2026-11", toMonth: "2027-04", stayMonth: "2028-01" })).toEqual({});
  });
  it("keeps a valid one", () => {
    expect(parseTrackerParams({ fromMonth: "2026-11", toMonth: "2027-04", stayMonth: "2026-12" })).toEqual({
      fromMonth: "2026-11",
      toMonth: "2027-04",
      stayMonth: "2026-12",
    });
  });
  it("sends only what was chosen", () => {
    expect(trackerQuery({})).toBe("");
    expect(trackerQuery({ fromMonth: "2026-11", toMonth: "2027-04", stayMonth: "2026-12" })).toBe("fromMonth=2026-11&toMonth=2027-04&stayMonth=2026-12");
  });
});

const saved = { targetRoomNights: 120 as number | null, baselineRoomNights: 90 as number | null, baselineNetRevenue: "250000.50" as string | null };

describe("targets form", () => {
  it("starts from what is saved, empty for nothing", () => {
    expect(targetsFormFrom(saved)).toEqual({ target: "120", baselineNights: "90", baselineNet: "250000.50" });
    expect(targetsFormFrom({ targetRoomNights: null, baselineRoomNights: null, baselineNetRevenue: null })).toEqual({
      target: "",
      baselineNights: "",
      baselineNet: "",
    });
  });

  it("parses whole numbers and amounts, an empty field is cleared", () => {
    expect(parseTargetsForm({ target: " 100 ", baselineNights: "", baselineNet: "1,234.5" })).toEqual({
      ok: true,
      input: { targetRoomNights: 100, baselineRoomNights: null, baselineNetRevenue: "1234.5" },
    });
  });

  it("says which field is wrong", () => {
    const bad = parseTargetsForm({ target: "-1", baselineNights: "1.5", baselineNet: "1.234" });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.errors).sort()).toEqual(["baselineNet", "baselineNights", "target"]);
    expect(parseTargetsForm({ target: "100001", baselineNights: "", baselineNet: "" }).ok).toBe(false);
  });

  it("normalizeBaht keeps the typed digits - no number conversion", () => {
    expect(normalizeBaht("250000.50")).toBe("250000.50");
    expect(normalizeBaht("  ")).toBeNull();
    expect(normalizeBaht("12.")).toBeUndefined();
    expect(normalizeBaht("1e5")).toBeUndefined();
    expect(normalizeBaht("0.1")).toBe("0.1");
  });

  it("is dirty only when the saved values differ", () => {
    expect(targetsDirty(saved, targetsFormFrom(saved))).toBe(false);
    expect(targetsDirty(saved, { target: "120", baselineNights: "90", baselineNet: "250000.5" })).toBe(false); // same amount
    expect(targetsDirty(saved, { target: "121", baselineNights: "90", baselineNet: "250000.50" })).toBe(true);
    expect(targetsDirty(saved, { target: "", baselineNights: "90", baselineNet: "250000.50" })).toBe(true);
    expect(targetsDirty(saved, { target: "120", baselineNights: "90", baselineNet: "250000.51" })).toBe(true);
    expect(targetsDirty(saved, { target: "abc", baselineNights: "90", baselineNet: "250000.50" })).toBe(true); // let the save say why
    const empty = { targetRoomNights: null, baselineRoomNights: null, baselineNetRevenue: null };
    expect(targetsDirty(empty, { target: "", baselineNights: " ", baselineNet: "" })).toBe(false);
  });
});

const snap = { reason: "Slow pickup", nextAction: null as string | null, owner: "Nok", dueDate: "2026-12-04" as string | null };

describe("snapshot notes", () => {
  it("starts from the saved text", () => {
    expect(notesFormFrom(snap)).toEqual({ reason: "Slow pickup", nextAction: "", owner: "Nok", dueDate: "2026-12-04" });
  });

  it("sends only what changed, trimmed, and clears an emptied field with null", () => {
    expect(notesPatch(snap, notesFormFrom(snap))).toEqual({});
    expect(notesPatch(snap, { ...notesFormFrom(snap), reason: "  Slow pickup  " })).toEqual({});
    expect(notesPatch(snap, { ...notesFormFrom(snap), nextAction: " Call agents " })).toEqual({ nextAction: "Call agents" });
    expect(notesPatch(snap, { ...notesFormFrom(snap), owner: "", dueDate: "" })).toEqual({ owner: null, dueDate: null });
    expect(notesPatch(snap, { ...notesFormFrom(snap), dueDate: "2026-12-11" })).toEqual({ dueDate: "2026-12-11" });
  });

  it("is dirty exactly when there is something to send", () => {
    expect(notesDirty(snap, notesFormFrom(snap))).toBe(false);
    expect(notesDirty(snap, { ...notesFormFrom(snap), owner: "Mai" })).toBe(true);
  });

  it("refuses a note over the server's limit before asking", () => {
    expect(notesError({ reason: "x".repeat(500), nextAction: "", owner: "", dueDate: "" })).toBeNull();
    expect(notesError({ reason: "x".repeat(501), nextAction: "", owner: "", dueDate: "" })).toMatch(/Reason/);
    expect(notesError({ reason: "", nextAction: "x".repeat(501), owner: "", dueDate: "" })).toMatch(/Next action/);
    expect(notesError({ reason: "", nextAction: "", owner: "x".repeat(121), dueDate: "" })).toMatch(/Owner/);
  });
});

describe("chart geometry", () => {
  it("rounds the axis top to a friendly number", () => {
    expect(niceMax(0)).toBe(1);
    expect(niceMax(7)).toBe(10);
    expect(niceMax(10)).toBe(10);
    expect(niceMax(11)).toBe(20);
    expect(niceMax(21)).toBe(25);
    expect(niceMax(26)).toBe(50);
    expect(niceMax(51)).toBe(100);
    expect(niceMax(5097.71)).toBe(10000);
    expect(axisTicks(100)).toEqual([0, 25, 50, 75, 100]);
  });

  it("draws bars from the baseline, proportionally, from the server's decimal strings too", () => {
    const { top, bars } = barLayout(["50", 100, "0", "garbage"]);
    expect(top).toBe(100);
    const b = DEFAULT_CHART_BOX;
    const plotH = b.height - b.top - b.bottom;
    expect(bars).toHaveLength(4);
    expect(bars[1].height).toBeCloseTo(plotH);
    expect(bars[0].height).toBeCloseTo(plotH / 2);
    expect(bars[2].height).toBe(0);
    expect(bars[3].height).toBe(0);
    for (const bar of bars) expect(bar.y + bar.height).toBeCloseTo(b.top + plotH); // all stand on the same line
    expect(bars[0].x).toBeLessThan(bars[1].x);
  });

  it("draws an all-zero chart flat rather than dividing by zero", () => {
    const { top, bars } = barLayout([0, 0, 0]);
    expect(top).toBe(1);
    expect(bars.every((x) => x.height === 0)).toBe(true);
    expect(lineLayout([]).points).toEqual([]);
  });

  it("spreads line points across the plot, ends on the edges", () => {
    const { points } = lineLayout([0, 10, 5]);
    const b = DEFAULT_CHART_BOX;
    expect(points[0].x).toBe(b.left);
    expect(points[2].x).toBe(b.width - b.right);
    expect(points[1].y).toBeLessThan(points[0].y);
    expect(lineLayout([3]).points[0].x).toBeCloseTo(b.left + (b.width - b.left - b.right) / 2);
    expect(polylinePoints([{ x: 1.04, y: 2 }, { x: 3, y: 4.26 }])).toBe("1,2 3,4.3");
  });
});

import { formatBahtCents, formatCount, formatSigned, formatSignedBaht } from "./bookingTracker";

describe("display formats", () => {
  it("keeps the cents of the server's amount", () => {
    expect(formatBahtCents("25440.48")).toBe("฿25,440.48");
    expect(formatBahtCents("250000.50")).toBe("฿250,000.50");
    expect(formatBahtCents("0.00")).toBe("฿0.00");
    expect(formatBahtCents(null)).toBe("—");
  });
  it("shows a dash for a figure the server could not compute, and signs a difference", () => {
    expect(formatCount(null)).toBe("—");
    expect(formatCount(12345)).toBe("12,345");
    expect(formatSigned(4)).toBe("+4");
    expect(formatSigned(-2)).toBe("−2");
    expect(formatSigned(0)).toBe("0");
    expect(formatSigned(null)).toBe("—");
    expect(formatSignedBaht("1200.50")).toBe("+฿1,200.50");
    expect(formatSignedBaht("-300.00")).toBe("−฿300.00");
    expect(formatSignedBaht("0.00")).toBe("฿0.00");
  });
});
