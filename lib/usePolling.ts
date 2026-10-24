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

// intervalMs 0 means no timer at all - only the "page came back" refetch (the Lighting board: a controller on a
// wireless link is asked when someone looks, not on a schedule).
//
// A tick (or a "page came back" run) is skipped while the previous call is still waiting for its answer, when the
// callback returns its promise: a slow server must not pile up identical requests behind each other.
// Floor for any request-per-tick poll of a live screen (orders, maps): nothing on the floor changes faster than this
// is worth asking for, and the page-came-back run already covers the "I just looked at it again" case.
export const MIN_POLL_INTERVAL_MS = 5000;

export function usePolling(callback: () => void | Promise<unknown>, intervalMs: number, enabled = true) {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    if (!enabled) return;

    let lastRun = 0;
    let inFlight = false;
    function run() {
      if (document.visibilityState !== "visible") return;
      if (inFlight) return;
      const now = Date.now();
      if (now - lastRun < MIN_GAP_MS) return;
      lastRun = now;
      const result = callbackRef.current();
      if (result && typeof (result as Promise<unknown>).then === "function") {
        inFlight = true;
        (result as Promise<unknown>).then(
          () => {
            inFlight = false;
          },
          () => {
            inFlight = false;
          },
        );
      }
    }

    function onReturn() {
      run();
    }
    function onPageShow(e: PageTransitionEvent) {
      if (e.persisted) run();
    }

    const id = intervalMs > 0 ? setInterval(run, intervalMs) : undefined;
    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      if (id !== undefined) clearInterval(id);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, [intervalMs, enabled]);
}
