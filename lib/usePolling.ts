"use client";

import { useEffect, useRef } from "react";

// Shared by OrderBoard/OrderTicket/ShiftPanel — same "just refetch on an
// interval" idiom RoomBookingPanel already uses for a single fetch-on-change,
// generalized to a repeating timer. No WebSocket on the backend and no
// state library in this repo, so polling is the plain option that fits.
export function usePolling(callback: () => void, intervalMs: number, enabled = true) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    function tick() {
      if (document.visibilityState === "visible") callbackRef.current();
    }

    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}
