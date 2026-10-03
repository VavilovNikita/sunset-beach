import { describe, expect, it } from "vitest";
import { menuCategoryTabs, resolveSelectedCategory } from "./menuCategories";

describe("menuCategoryTabs", () => {
  it("groups by category with counts, sorted by name", () => {
    const tabs = menuCategoryTabs([
      { category: "Mains" },
      { category: "Cocktails" },
      { category: "Mains" },
      { category: "Beer" },
    ]);
    expect(tabs).toEqual([
      { category: "Beer", count: 1 },
      { category: "Cocktails", count: 1 },
      { category: "Mains", count: 2 },
    ]);
  });

  it("is empty for no items", () => {
    expect(menuCategoryTabs([])).toEqual([]);
  });
});

describe("resolveSelectedCategory", () => {
  const tabs = menuCategoryTabs([{ category: "Beer" }, { category: "Mains" }]);

  it("keeps a requested category that exists", () => {
    expect(resolveSelectedCategory(tabs, "Mains")).toBe("Mains");
  });

  it("falls back to the first tab for a missing or unknown category", () => {
    expect(resolveSelectedCategory(tabs, undefined)).toBe("Beer");
    expect(resolveSelectedCategory(tabs, "Desserts")).toBe("Beer");
  });

  it("is null when there are no categories at all", () => {
    expect(resolveSelectedCategory([], "Beer")).toBeNull();
  });
});
