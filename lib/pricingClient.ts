// Shared client-side calls for GET/PATCH /pricing/{roomId} - used by the Rates & availability grid
// (RatesAvailabilityGrid.tsx). Routed through adminRequest so a failed load shows as an error on
// that room type's row, not as a month of plausible-looking base prices: the raw fetch this
// replaced (PricingManager.tsx) had no res.ok check, so a backend failure rendered as an empty
// calendar indistinguishable from "nothing set".
import { adminJsonInit, adminRequest } from "@/lib/adminFetch";
import type { PricingResponse } from "@/lib/types";

export type FetchPricingResult = { ok: true; pricing: PricingResponse } | { ok: false; error: string };
export type SetPriceRangeResult = { ok: true; updated: number } | { ok: false; error: string };

export async function fetchPricing(roomId: string, month: string): Promise<FetchPricingResult> {
  const result = await adminRequest<PricingResponse>(`/pricing/${roomId}?month=${month}`, undefined, "Could not load prices.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, pricing: { basePrice: result.data.basePrice, days: result.data.days ?? [] } };
}

// `from` and `to` are both inclusive (one RatePlan row per night in [from, to]); a single night is
// from === to. MANAGER+ on the backend.
export async function setPriceRange(roomId: string, from: string, to: string, price: number): Promise<SetPriceRangeResult> {
  const result = await adminRequest<{ ok: boolean; updated: number }>(
    `/pricing/${roomId}`,
    adminJsonInit("PATCH", { from, to, price }),
    "Could not save prices."
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, updated: result.data.updated };
}
