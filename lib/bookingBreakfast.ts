import type { BreakfastRate } from "@/lib/types";

// Breakfast as front desk records it on a booking: guests per night and the rate they are sold at (250 or 350 baht).
// The booking tracker deducts it from the package; nothing here is charged or computed - the rates are the hotel's two
// fixed prices (backend BreakfastRate) and are only shown. Pure, tested in bookingBreakfast.test.ts.

export const BREAKFAST_RATES: BreakfastRate[] = [250, 350];

// Typed as strings (an emptied field is "", i.e. none).
export type BreakfastForm = { guests: string; rate: string };

export function breakfastFormFrom(b: { breakfastGuests?: number | null; breakfastRate?: BreakfastRate | null }): BreakfastForm {
  return {
    guests: b.breakfastGuests ? String(b.breakfastGuests) : "",
    rate: b.breakfastGuests && b.breakfastRate ? String(b.breakfastRate) : "",
  };
}

export type BreakfastParse =
  | { ok: true; breakfastGuests: number | null; breakfastRate: BreakfastRate | null }
  | { ok: false; error: string };

// Nothing or 0 guests is "no breakfast": both fields are cleared, whatever rate was left selected. More than 0 needs a
// rate and no more than the party (adults + children) - the server refuses both too.
export function parseBreakfast(form: BreakfastForm, party: number): BreakfastParse {
  const text = form.guests.trim();
  if (text === "") return { ok: true, breakfastGuests: null, breakfastRate: null };
  const guests = Number(text);
  if (!Number.isInteger(guests) || guests < 0 || guests > 50) {
    return { ok: false, error: "Breakfast guests must be a whole number, 0 or more." };
  }
  if (guests === 0) return { ok: true, breakfastGuests: null, breakfastRate: null };
  const rate = Number(form.rate);
  if (!BREAKFAST_RATES.includes(rate as BreakfastRate)) return { ok: false, error: "Choose the breakfast rate." };
  if (guests > party) return { ok: false, error: `More breakfast guests than the party (${party}).` };
  return { ok: true, breakfastGuests: guests, breakfastRate: rate as BreakfastRate };
}

// "2 guests at ฿350 a night", or null when none is recorded.
export function formatBreakfast(b: { breakfastGuests?: number | null; breakfastRate?: BreakfastRate | null }): string | null {
  if (!b.breakfastGuests || !b.breakfastRate) return null;
  return `${b.breakfastGuests} guest${b.breakfastGuests === 1 ? "" : "s"} at ฿${b.breakfastRate} a night`;
}
