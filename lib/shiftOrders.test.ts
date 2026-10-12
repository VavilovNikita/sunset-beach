import { describe, expect, it } from "vitest";
import { splitUnsettledOrders } from "@/lib/shiftOrders";
import type { Order } from "@/lib/posTypes";

function order(id: string, openedByUserId: string): Order {
  return { id, openedByUserId } as Order;
}

describe("splitUnsettledOrders", () => {
  it("blocks only on the shift cashier's own open orders; the rest are warnings", () => {
    const mine = order("a", "cashier-1");
    const theirs = order("b", "waiter-7");
    const alsoMine = order("c", "cashier-1");
    expect(splitUnsettledOrders([mine, theirs, alsoMine], "cashier-1")).toEqual({
      blocking: [mine, alsoMine],
      others: [theirs],
    });
  });

  it("blocks nothing when nobody else's orders are the cashier's", () => {
    expect(splitUnsettledOrders([order("b", "waiter-7")], "cashier-1")).toEqual({ blocking: [], others: [order("b", "waiter-7")] });
  });

  it("treats every order as someone else's until the shift is known", () => {
    expect(splitUnsettledOrders([order("a", "cashier-1")], undefined).blocking).toEqual([]);
  });
});
