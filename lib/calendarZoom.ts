// Shared between the calendar page (server: decides how wide a date range to fetch) and
// BookingCalendarGrid (client: decides pixel width / drag availability / label visibility) and
// CalendarRangePersistence (client: restores the last-used month+zoom from localStorage) - one
// definition of what each zoom level means, so the three can't drift apart.
export const ZOOM_LEVELS = {
  day: { dayWidth: 88, allowDrag: true, showLabel: true, windowMonths: 1 },
  week: { dayWidth: 28, allowDrag: false, showLabel: true, windowMonths: 3 },
  month: { dayWidth: 10, allowDrag: false, showLabel: false, windowMonths: 12 },
} as const;

export type ZoomLevel = keyof typeof ZOOM_LEVELS;

export function parseZoomParam(zoom: string | undefined): ZoomLevel {
  return zoom === "week" || zoom === "month" ? zoom : "day";
}

// One storage key, one shape: {month: "YYYY-MM", zoom}. The grid writes it whenever the user
// picks a new zoom; CalendarRangePersistence reads it back only when the page was reached with
// no explicit month/zoom in the URL (a bare sidebar click), so an explicit navigation (Prev/
// Next, a zoom button, a bookmarked link) always wins over whatever was last remembered.
export const CALENDAR_RANGE_STORAGE_KEY = "sunset-beach:admin:calendar:range";

export type StoredCalendarRange = { month: string; zoom: ZoomLevel };

export function loadStoredCalendarRange(): StoredCalendarRange | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(CALENDAR_RANGE_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.month === "string" && /^\d{4}-\d{2}$/.test(parsed.month)) {
      return { month: parsed.month, zoom: parseZoomParam(parsed.zoom) };
    }
  } catch {
    // ignore malformed/legacy stored value
  }
  return null;
}

export function saveStoredCalendarRange(range: StoredCalendarRange) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CALENDAR_RANGE_STORAGE_KEY, JSON.stringify(range));
}
