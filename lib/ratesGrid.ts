// Pure logic behind the Rates & availability grid (/admin/rates, RatesAvailabilityGrid.tsx): which
// month and view the URL asks for, the day columns of a month, and what one room-type x date cell
// shows. Both numbers in a cell come from the server as-is - price from GET /pricing/{roomId},
// rooms left from GET /availability/{roomId}'s availableCount - nothing here computes a price or a
// remainder, only decides how to present them.
import type { AvailabilityDay, PricingDay } from "@/lib/types";

export type RatesView = "rates" | "availability";

const MONTH_RE = /^(\d{4})-(\d{2})$/;

// Migrated blocks were assigned an arbitrary room and reason by the backend migration - staff need
// to spot and re-verify these rather than trust them. Marked purely by this reason-text prefix.
export const AUTO_MIGRATED_PREFIX = "Auto-migrated from legacy block count";
export function isAutoMigrated(reason: string | null | undefined): boolean {
  return !!reason && reason.startsWith(AUTO_MIGRATED_PREFIX);
}

// A missing or malformed ?month falls back to the hotel's current month (todayKey is the hotel
// date, lib/hotelDate.ts), never a half-parsed one.
export function parseMonthParam(raw: string | undefined, todayKey: string): string {
  const m = raw ? MONTH_RE.exec(raw) : null;
  if (m && Number(m[2]) >= 1 && Number(m[2]) <= 12) return raw!;
  return todayKey.slice(0, 7);
}

export function parseViewParam(raw: string | undefined): RatesView {
  return raw === "availability" ? "availability" : "rates";
}

export function shiftMonth(month: string, delta: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function monthDateKeys(month: string): string[] {
  const [y, m] = month.split("-").map(Number);
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return Array.from({ length: daysInMonth }, (_, i) => `${month}-${String(i + 1).padStart(2, "0")}`);
}

// 0 = Sunday, matching Date#getUTCDay - the grid shades weekends (Sat/Sun) in the header.
export function weekdayOf(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export type RateCell = {
  date: string;
  price: number | null;
  isOverride: boolean;
  available: number | null;
  total: number | null;
  // At least one unit blocked that day by an auto-migrated block nobody has re-checked yet.
  needsReview: boolean;
};

export function buildRateCells(
  dates: string[],
  pricingDays: PricingDay[] | null,
  availabilityDays: AvailabilityDay[] | null
): RateCell[] {
  const priceByDate = new Map((pricingDays ?? []).map((d) => [d.date, d]));
  const availByDate = new Map((availabilityDays ?? []).map((d) => [d.date, d]));
  return dates.map((date) => {
    const p = priceByDate.get(date);
    const a = availByDate.get(date);
    return {
      date,
      price: p ? p.price : null,
      isOverride: p ? p.isOverride : false,
      available: a ? a.availableCount : null,
      total: a ? a.unitCount : null,
      needsReview: a ? a.units.some((u) => u.isBlocked && isAutoMigrated(u.blockReason)) : false,
    };
  });
}

// Colour meaning follows the app-wide palette (CLAUDE.md "Colour meanings"): sea = free, coral =
// needs intervention. "oversold" (negative remainder - more stays/blocks than active rooms) is the
// one that needs a person; "soldOut" is an ordinary full night, shown dim, not alarming.
export type AvailabilityTone = "none" | "oversold" | "soldOut" | "partial" | "open";

export function availabilityTone(available: number | null, total: number | null): AvailabilityTone {
  if (available === null || total === null) return "none";
  if (available < 0) return "oversold";
  if (total === 0) return "none";
  if (available === 0) return "soldOut";
  if (available < total) return "partial";
  return "open";
}

// What a staff member typed into a price box, as the number PATCH /pricing/{roomId} will accept
// (strictly positive), or null when it isn't one. The server re-validates; this only decides
// whether to send.
export function parsePriceInput(raw: string): number | null {
  const trimmed = raw.trim().replace(/,/g, "");
  if (!/^\d+(\.\d+)?$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) && value > 0 ? value : null;
}

// The range form's own check before it sends - both dates present and from <= to (inclusive range,
// one night is from === to). The backend enforces the same rule and the 366-day cap.
export function validatePriceRange(from: string, to: string): string | null {
  if (!from || !to) return "Pick both dates.";
  if (from > to) return "“From” must be on or before “To”.";
  return null;
}
