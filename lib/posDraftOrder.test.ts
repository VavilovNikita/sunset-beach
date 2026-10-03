import { describe, expect, it } from "vitest";
import { draftOrderBody, draftOrderHref, parseDraftTarget } from "@/lib/posDraftOrder";

describe("draftOrderHref / parseDraftTarget", () => {
  it("round-trips a table", () => {
    expect(draftOrderHref("/pos/orders", { tableId: "t1" })).toBe("/pos/orders/new?tableId=t1");
    expect(parseDraftTarget({ tableId: "t1" })).toEqual({ tableId: "t1", guestName: null });
  });

  it("round-trips a walk-up ticket name, trimmed", () => {
    expect(draftOrderHref("/admin/pos/orders", { guestName: "  Anna  " })).toBe("/admin/pos/orders/new?guestName=Anna");
    expect(parseDraftTarget({ guestName: "  Anna " })).toEqual({ tableId: null, guestName: "Anna" });
  });

  it("an unnamed, table-less ticket is just /new", () => {
    expect(draftOrderHref("/pos/orders", {})).toBe("/pos/orders/new");
    expect(parseDraftTarget({ guestName: "   " })).toEqual({ tableId: null, guestName: null });
  });
});

describe("draftOrderBody", () => {
  it("creates the order with its first line in the same request", () => {
    expect(draftOrderBody({ tableId: "t1", guestName: null }, { menuItemId: "m1", quantity: 2, note: "" })).toEqual({
      tableId: "t1",
      items: [{ menuItemId: "m1", quantity: 2, note: null }],
    });
  });
});
