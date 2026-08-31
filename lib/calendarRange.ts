// Shared between the calendar page (server: fetches exactly the chosen [from, to) and validates
// it against the same cap the backend enforces) and CalendarPeriodControls/BookingCalendarGrid
// (client: navigate the period, remember period + density across reloads). Period and density are
// deliberately two independent concerns with two independent storage keys - changing one must
// never touch the other, and neither should be able to silently overwrite the other's last-saved
// value.

// Mirrors BookingCalendarService.MAX_CALENDAR_RANGE_DAYS / DateRangeUtil.MAX_RANGE_DAYS on the
// backend (sunset repo). Not fetched from the API - there's no endpoint that exposes it - so this
// is duplicated by hand; if the backend constant ever changes, update this one too. Used to
// reject an oversized range client-side, before it ever reaches the network, with the same
// explanation the backend would give if this constant drifted and a request got through anyway.
export const MAX_CALENDAR_RANGE_DAYS = 366;

export const MIN_DAY_WIDTH_PX = 8;
export const MAX_DAY_WIDTH_PX = 120;
// Comfortably above DRAG_THRESHOLD_PX (44, see lib/calendarLayout.ts) so a first-time visitor
// (nothing in localStorage yet) lands with drag-editing and drag-to-create both already on -
// the least surprising default given that's what every zoom level used to default to before
// density existed.
export const DEFAULT_DAY_WIDTH_PX = 88;

export type StoredPeriod = { from: string; to: string };

const PERIOD_STORAGE_KEY = "sunset-beach:admin:calendar:range";
const DENSITY_STORAGE_KEY = "sunset-beach:admin:calendar:density";

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

export function loadStoredPeriod(): StoredPeriod | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(PERIOD_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    // Also rejects the pre-redesign {month, zoom} shape this key used to hold - a stale value in
    // the old shape is treated as absent rather than crashing anything downstream.
    if (typeof parsed?.from === "string" && typeof parsed?.to === "string" && DATE_KEY_RE.test(parsed.from) && DATE_KEY_RE.test(parsed.to)) {
      return { from: parsed.from, to: parsed.to };
    }
  } catch {
    // ignore malformed/legacy stored value
  }
  return null;
}

export function saveStoredPeriod(period: StoredPeriod) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PERIOD_STORAGE_KEY, JSON.stringify(period));
}

export function loadStoredDensity(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(DENSITY_STORAGE_KEY);
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < MIN_DAY_WIDTH_PX || n > MAX_DAY_WIDTH_PX) return null;
  return n;
}

export function saveStoredDensity(dayWidth: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DENSITY_STORAGE_KEY, String(dayWidth));
}
