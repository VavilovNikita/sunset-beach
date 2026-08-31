"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadStoredCalendarRange, saveStoredCalendarRange, type ZoomLevel } from "@/lib/calendarZoom";

// Makes the calendar's chosen month/zoom survive a reload even when the page was reached with no
// query params at all (the sidebar's "Calendar" link, or a bare bookmark) - Prev/Next and the
// zoom buttons always include both params explicitly, so an explicit navigation is never
// second-guessed here, only a bare one. Renders nothing; the actual restore is a client-side
// redirect once, on mount.
export default function CalendarRangePersistence({
  hasExplicitParams,
  currentMonthKey,
  currentZoom,
}: {
  hasExplicitParams: boolean;
  currentMonthKey: string;
  currentZoom: ZoomLevel;
}) {
  const router = useRouter();

  useEffect(() => {
    if (hasExplicitParams) {
      saveStoredCalendarRange({ month: currentMonthKey, zoom: currentZoom });
      return;
    }
    const stored = loadStoredCalendarRange();
    if (stored && (stored.month !== currentMonthKey || stored.zoom !== currentZoom)) {
      router.replace(`/admin/bookings/calendar?month=${stored.month}&zoom=${stored.zoom}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasExplicitParams, currentMonthKey, currentZoom]);

  return null;
}
