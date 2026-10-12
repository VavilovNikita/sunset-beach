// One order line holds 1 to 99 of an item - the backend's rule (OrderItemInput.quantity, and the
// merged total when the same item is added again). The screens stop at it so a tap can't ask for
// more; the server still refuses anything over (400) and is the authority.
export const MAX_LINE_QUANTITY = 99;

// Whether one more can be added to a line already holding `quantity`.
export function canAddOne(quantity: number): boolean {
  return quantity < MAX_LINE_QUANTITY;
}

// Clamps a typed or stepped quantity into 1..99 (a non-number becomes 1).
export function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_LINE_QUANTITY, Math.max(1, Math.trunc(value)));
}
