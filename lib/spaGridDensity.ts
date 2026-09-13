// Column-width density for the spa schedule grid - same concern BookingCalendarGrid's own
// lib/calendarRange.ts already solved for day-width, given its own key and its own bounds: a
// slot column and a day column are different units (see lib/spaGridLayout.ts's own comment on
// why the two grids don't share layout math), so the two grids don't share a storage key either -
// changing one grid's zoom must never silently change the other's.
export const MIN_COL_WIDTH_PX = 40;
export const MAX_COL_WIDTH_PX = 120;
export const DEFAULT_COL_WIDTH_PX = 64;

const DENSITY_STORAGE_KEY = "sunset-beach:admin:spa-grid:density";

export function loadStoredSpaGridDensity(): number | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(DENSITY_STORAGE_KEY);
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < MIN_COL_WIDTH_PX || n > MAX_COL_WIDTH_PX) return null;
  return n;
}

export function saveStoredSpaGridDensity(colWidth: number) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(DENSITY_STORAGE_KEY, String(colWidth));
}
