// Where a grid drag was pressed, and the two questions asked about the pointer since. Pure, tested in
// dragPress.test.ts; the listeners are in useDragListeners.ts.
export type DragPoint = { clientX: number; clientY: number };
export type DragPress = { pointerId: number; clientX: number; clientY: number };

// A hand that shakes a few pixels on a click has not dragged anything.
export const DRAG_SLOP_PX = 4;

export function pressMoved(press: DragPoint, now: DragPoint): boolean {
  return Math.hypot(now.clientX - press.clientX, now.clientY - press.clientY) > DRAG_SLOP_PX;
}

// A mouse moving with no button down: it was released somewhere the page never heard of. Not for touch or pen, whose
// moves are reported differently.
export function releasedUnseen(e: { pointerType: string; buttons: number }): boolean {
  return e.pointerType === "mouse" && e.buttons === 0;
}
