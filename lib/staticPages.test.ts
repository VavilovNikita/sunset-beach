import { describe, expect, it } from "vitest";
import { isOutsideApp } from "./staticPages";

describe("isOutsideApp", () => {
  it("is true for the manual and anything under it", () => {
    expect(isOutsideApp("/manual")).toBe(true);
    expect(isOutsideApp("/manual/")).toBe(true);
    expect(isOutsideApp("/manual/th/")).toBe(true);
    expect(isOutsideApp("/manual/en/#folio")).toBe(true);
  });
  it("is false for app pages, including ones that merely start with the same letters", () => {
    expect(isOutsideApp("/admin/today")).toBe(false);
    expect(isOutsideApp("/manuals")).toBe(false);
    expect(isOutsideApp("/")).toBe(false);
  });
});
