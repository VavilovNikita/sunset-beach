import { MAX_LINE_QUANTITY } from "@/lib/orderQuantity";
import type { OrderItemInput } from "@/lib/posTypes";

// The QR order's cart: what the guest has picked but not sent yet. Lives only in the page's state -
// nothing reaches the kitchen until the guest confirms with one button, and until then any line can
// be taken back out. Pure functions over a plain list so the rules are tested (lib/guestCart.test.ts).
// No total on purpose: a price shown to a guest comes from the server, and the order's own total
// after sending is the figure that counts.
export type CartLine = { menuItemId: string; quantity: number };

// One more of an item: a new line, or +1 on its existing line. A line stops at 99 (the backend's
// per-line limit); asking for more leaves the cart as it was.
export function addToCart(cart: CartLine[], menuItemId: string): CartLine[] {
  const existing = cart.find((l) => l.menuItemId === menuItemId);
  if (!existing) return [...cart, { menuItemId, quantity: 1 }];
  if (existing.quantity >= MAX_LINE_QUANTITY) return cart;
  return cart.map((l) => (l === existing ? { ...l, quantity: l.quantity + 1 } : l));
}

// One fewer; a line that reaches zero is removed.
export function removeOneFromCart(cart: CartLine[], menuItemId: string): CartLine[] {
  return cart.flatMap((l) => (l.menuItemId !== menuItemId ? [l] : l.quantity > 1 ? [{ ...l, quantity: l.quantity - 1 }] : []));
}

export function removeFromCart(cart: CartLine[], menuItemId: string): CartLine[] {
  return cart.filter((l) => l.menuItemId !== menuItemId);
}

export function cartItemCount(cart: CartLine[]): number {
  return cart.reduce((sum, l) => sum + l.quantity, 0);
}

// The request body for POST /public/orders/{id}/items: ids and quantities only - the server prices.
export function cartToItems(cart: CartLine[]): OrderItemInput[] {
  return cart.map((l) => ({ menuItemId: l.menuItemId, quantity: l.quantity }));
}
