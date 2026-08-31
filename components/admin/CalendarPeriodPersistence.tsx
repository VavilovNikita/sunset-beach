"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadStoredPeriod, saveStoredPeriod } from "@/lib/calendarRange";

// Makes the calendar's chosen period survive a reload even when the page was reached with no
// query params at all (the sidebar's "Calendar" link, or a bare bookmark) - Prev/Next/Today, the
// quick-pick buttons, and the from/to form always include both params explicitly, so an explicit
// navigation is never second-guessed here, only a bare one. Renders nothing; the actual restore
// is a client-side redirect once, on mount. Density has no equivalent of this: it never touches
// the URL, so it can just read localStorage directly in BookingCalendarGrid.
export default function CalendarPeriodPersistence({
  hasExplicitParams,
  currentFrom,
  currentTo,
}: {
  hasExplicitParams: boolean;
  currentFrom: string;
  currentTo: string;
}) {
  const router = useRouter();

  useEffect(() => {
    if (hasExplicitParams) {
      saveStoredPeriod({ from: currentFrom, to: currentTo });
      return;
    }
    const stored = loadStoredPeriod();
    if (stored && (stored.from !== currentFrom || stored.to !== currentTo)) {
      router.replace(`/admin/bookings/calendar?from=${stored.from}&to=${stored.to}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasExplicitParams, currentFrom, currentTo]);

  return null;
}
