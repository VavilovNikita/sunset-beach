import { useLayoutEffect, useRef, type MutableRefObject } from "react";
import { pressMoved, releasedUnseen, type DragPoint, type DragPress } from "@/lib/dragPress";

// The end of a pointer drag on a grid, heard on the window. The handlers used to sit on the bars and cells, with the
// pointer captured by the dragged bar - but a bar dragged into another row is drawn there as a new element, the capture
// goes with the old one, and a release outside the grid then reached nothing: the bar stayed as a ghost until Escape.
// The window hears the release wherever it happens (outside the browser window too, while the button was pressed
// inside), a cancelled pointer, and a drag whose release will never come (the window lost focus, or a move arrives with
// no button down). `lostpointercapture` is deliberately not an end: it is what the row change itself fires.
export function useDragListeners(
  active: boolean,
  press: MutableRefObject<DragPress | null>,
  handlers: {
    onMove: (point: DragPoint) => void;
    // `moved`: the pointer travelled - a release that did not is a click, not a drag.
    onUp: (point: DragPoint, moved: boolean) => void;
    onAbort: (moved: boolean) => void;
  }
) {
  const latest = useRef(handlers);
  latest.current = handlers;
  // The furthest the pointer got: dragging out and back to the start is still a drag.
  const travelled = useRef(false);

  // A layout effect: the listeners are there before the browser can deliver the release of a very quick drag.
  useLayoutEffect(() => {
    if (!active) return;
    travelled.current = false;
    const mine = (e: PointerEvent) => press.current === null || e.pointerId === press.current.pointerId;
    const note = (e: PointerEvent) => {
      if (press.current && pressMoved(press.current, e)) travelled.current = true;
    };
    const move = (e: PointerEvent) => {
      if (!mine(e)) return;
      note(e);
      if (releasedUnseen(e)) latest.current.onAbort(travelled.current);
      else latest.current.onMove(e);
    };
    const up = (e: PointerEvent) => {
      if (!mine(e)) return;
      note(e);
      latest.current.onUp(e, travelled.current);
    };
    const cancel = (e: PointerEvent) => {
      if (mine(e)) latest.current.onAbort(travelled.current);
    };
    const blur = () => latest.current.onAbort(travelled.current);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", cancel);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", cancel);
      window.removeEventListener("blur", blur);
    };
  }, [active, press]);
}
