"use client";

import { useEffect, useRef } from "react";

// Shared by OrderBoard/OrderTicket/ShiftPanel — same "just refetch on an
// interval" idiom RoomBookingPanel already uses for a single fetch-on-change,
// generalized to a repeating timer. No WebSocket on the backend and no
// state library in this repo, so polling is the plain option that fits.
//
// The timer alone is not enough on a phone: a hidden tab's timers are throttled or frozen, and a
// page restored from the back/forward cache has its old state and no tick for a while. So the
// callback also runs the moment the page comes back - tab visible again, window focused, or a
// bfcache restore (`pageshow` with `persisted`) - which is what stops a table that got an order
// meanwhile from still showing as free after "Back" or an app switch. Two of those events usually
// fire together; only the first within MIN_GAP_MS runs.
const MIN_GAP_MS = 300;

export function usePolling(callback: () => void, intervalMs: number, enabled = true) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    let lastRun = 0;
    function run() {
      if (document.visibilityState !== "visible") return;
      const now = Date.now();
      if (now - lastRun < MIN_GAP_MS) return;
      lastRun = now;
      callbackRef.current();
    }

    function onReturn() {
      run();
    }
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) run();
    }

    const id = setInterval(run, intervalMs);
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [intervalMs, enabled]);
}
