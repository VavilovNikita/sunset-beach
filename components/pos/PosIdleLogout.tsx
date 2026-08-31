"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

const IDLE_LIMIT_MS = 30 * 60 * 1000; // 30 minutes

// Secondary safety net, not the primary fix for shared-device attribution (see PosTopBar's
// comment for the actual fix — making manual switch-user cheap). This only guards against a
// phone left logged in and unattended on a table: it does nothing for two people actively
// trading a phone back and forth all shift, since "active" is exactly the state this doesn't
// trigger on. Renders nothing.
export default function PosIdleLogout() {
  const router = useRouter();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function logoutForInactivity() {
      fetch("/api/session/logout", { method: "POST" })
        .catch(() => {})
        .finally(() => {
          router.push("/admin/login?callbackUrl=/pos");
          router.refresh();
        });
    }

    function resetTimer() {
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(logoutForInactivity, IDLE_LIMIT_MS);
    }

    const windowEvents: (keyof WindowEventMap)[] = ["pointerdown", "keydown", "touchstart"];
    windowEvents.forEach((event) => window.addEventListener(event, resetTimer));
    // visibilitychange fires on document, not window - returning to a backgrounded tab counts
    // as activity too, so a phone that was merely asleep (not idle in the hand) doesn't get
    // logged out the moment it wakes up.
    document.addEventListener("visibilitychange", resetTimer);
    resetTimer();

    return () => {
      windowEvents.forEach((event) => window.removeEventListener(event, resetTimer));
      document.removeEventListener("visibilitychange", resetTimer);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
