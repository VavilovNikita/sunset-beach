"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { loadStoredPeriod, periodFromToday, saveStoredPeriod } from "@/lib/calendarRange";
import { hotelDateKey } from "@/lib/hotelDate";

// A bare visit (the sidebar's "Calendar" link, or a bare bookmark - no query params) always
// opens on today, keeping only the *width* of the period the user last chose. It used to restore
// the exact stored dates, so the calendar kept reopening on whatever 1st-of-the-month it was last
// left on and reception had to press Today every time. Prev/Next/Today, the quick-pick buttons and
// the from/to form always include both params explicitly, so an explicit navigation (and a reload
// of one) is never second-guessed here. Renders nothing; the redirect happens once, on mount.
// Density has no equivalent of this: it never touches the URL, so it can just read localStorage
// directly in BookingCalendarGrid.
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
    const target = periodFromToday(hotelDateKey(new Date()), loadStoredPeriod());
    if (target.from !== currentFrom || target.to !== currentTo) {
      router.replace(`/admin/bookings/calendar?from=${target.from}&to=${target.to}`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasExplicitParams, currentFrom, currentTo]);

  return null;
}
