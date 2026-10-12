import { describe, expect, it } from "vitest";
import { addToCart, cartItemCount, cartToItems, removeFromCart, removeOneFromCart } from "@/lib/guestCart";

describe("guest cart", () => {
  it("adds a new line, then raises its quantity", () => {
    let cart = addToCart([], "beer");
    cart = addToCart(cart, "beer");
    cart = addToCart(cart, "soup");
    expect(cart).toEqual([
      { menuItemId: "beer", quantity: 2 },
      { menuItemId: "soup", quantity: 1 },
    ]);
    expect(cartItemCount(cart)).toBe(3);
  });

  it("stops a line at 99", () => {
    const full = [{ menuItemId: "beer", quantity: 99 }];
    expect(addToCart(full, "beer")).toBe(full);
  });

  it("takes one off a line and drops the line at zero", () => {
    const cart = [
      { menuItemId: "beer", quantity: 2 },
      { menuItemId: "soup", quantity: 1 },
    ];
    expect(removeOneFromCart(cart, "beer")).toEqual([
      { menuItemId: "beer", quantity: 1 },
      { menuItemId: "soup", quantity: 1 },
    ]);
    expect(removeOneFromCart(cart, "soup")).toEqual([{ menuItemId: "beer", quantity: 2 }]);
  });

  it("removes a whole line", () => {
    expect(removeFromCart([{ menuItemId: "beer", quantity: 5 }], "beer")).toEqual([]);
  });

  it("sends ids and quantities only", () => {
    expect(cartToItems([{ menuItemId: "beer", quantity: 3 }])).toEqual([{ menuItemId: "beer", quantity: 3 }]);
  });
});
