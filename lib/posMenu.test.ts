import { describe, expect, it } from "vitest";
import { menuForOrder } from "@/lib/posMenu";
import type { MenuItem } from "@/lib/posTypes";

function item(id: string, department: MenuItem["department"], isAvailable = true): MenuItem {
  return { id, name: id, description: null, category: "Any", price: "100.00", department, isAvailable } as unknown as MenuItem;
}

const menu = [item("massage", "SPA"), item("pad-thai", "KITCHEN"), item("beer", "BAR"), item("sold-out", "KITCHEN", false)];

describe("menuForOrder", () => {
  it("never offers a spa treatment on a restaurant or bar table", () => {
    expect(menuForOrder(menu, "RESTAURANT").map((m) => m.id)).toEqual(["pad-thai", "beer"]);
    expect(menuForOrder(menu, "BAR").map((m) => m.id)).toEqual(["pad-thai", "beer"]);
    expect(menuForOrder(menu, "POOL").map((m) => m.id)).toEqual(["pad-thai", "beer"]);
  });

  it("offers only treatments on a spa table", () => {
    expect(menuForOrder(menu, "SPA").map((m) => m.id)).toEqual(["massage"]);
  });

  it("keeps the whole available menu when there is no table to decide by", () => {
    expect(menuForOrder(menu, null).map((m) => m.id)).toEqual(["massage", "pad-thai", "beer"]);
  });
});
