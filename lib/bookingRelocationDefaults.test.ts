import { describe, expect, it } from "vitest";
import { defaultRelocationDate, relocationDateBounds } from "./bookingRelocationDefaults";

describe("defaultRelocationDate", () => {
  it("is today when today is inside the stay", () => {
    expect(defaultRelocationDate("2026-10-12", "2026-10-10", "2026-10-15")).toBe("2026-10-12");
  });

  it("is today on the first night: a guest arriving today can be moved from their first night", () => {
    expect(defaultRelocationDate("2026-10-10", "2026-10-10", "2026-10-15")).toBe("2026-10-10");
  });

  it("is the check-in day for a stay that has not started", () => {
    expect(defaultRelocationDate("2026-10-01", "2026-10-10", "2026-10-15")).toBe("2026-10-10");
  });

  it("is the last night for a stay that is nearly over", () => {
    expect(defaultRelocationDate("2026-10-20", "2026-10-10", "2026-10-15")).toBe("2026-10-14");
  });

  it("is the only night of a one-night stay", () => {
    expect(defaultRelocationDate("2026-10-10", "2026-10-10", "2026-10-11")).toBe("2026-10-10");
  });
});

describe("relocationDateBounds", () => {
  it("lets a manager pick any night of the stay, including nights already past", () => {
    expect(relocationDateBounds("2026-10-12", "2026-10-10", "2026-10-15", true)).toEqual({ min: "2026-10-10", max: "2026-10-14" });
  });

  it("starts a cashier's range at today", () => {
    expect(relocationDateBounds("2026-10-12", "2026-10-10", "2026-10-15", false)).toEqual({ min: "2026-10-12", max: "2026-10-14" });
  });

  it("never starts before the stay, for a stay still ahead", () => {
    expect(relocationDateBounds("2026-10-01", "2026-10-10", "2026-10-15", false)).toEqual({ min: "2026-10-10", max: "2026-10-14" });
  });

  it("does not run past the last night when the stay is over", () => {
    expect(relocationDateBounds("2026-10-30", "2026-10-10", "2026-10-15", false)).toEqual({ min: "2026-10-14", max: "2026-10-14" });
  });
});
