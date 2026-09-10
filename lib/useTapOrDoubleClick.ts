"use client";

import { useRef } from "react";

// Shared "open on tap or double-click" gesture, extracted from BookingCalendarGrid.tsx so the spa
// grid can reuse the exact same interaction instead of a second hand-rolled version. A native
// "click" event carries no pointerType of its own, so a ref set on pointerdown is the only way an
// onClick/onDoubleClick pair can tell a touch tap from a mouse click: touch opens on a single tap
// (double-tap is unreliable on a touch device and triggers page zoom), mouse requires a
// double-click so a single click can still start a drag (resize/move) without also opening
// whatever this gesture opens. One ref per grid, not per item - only one pointer interaction is
// ever in flight at a time, so `note` (called from every item's own onPointerDown) and `bind`
// (building each item's own onClick/onDoubleClick pair) safely share it.
export function useTapOrDoubleClick() {
  const lastPointerTypeRef = useRef<string>("mouse");

  function note(e: React.PointerEvent) {
    lastPointerTypeRef.current = e.pointerType;
  }

  function bind(onOpen: () => void) {
    return {
      onClick: () => {
        if (lastPointerTypeRef.current === "touch") onOpen();
      },
      onDoubleClick: () => {
        if (lastPointerTypeRef.current !== "touch") onOpen();
      },
    };
  }

  return { note, bind };
}
