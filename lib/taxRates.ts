// The two rates the booking tracker takes out of room prices (which include them): VAT and the service charge. Percent, at
// most two decimals, 0 to 99.99 - the same limits the server enforces on PUT /settings/vat and /settings/service-charge.
// Typed as text and sent as a number; the server answers with its own two-decimal string. Pure, tested in taxRates.test.ts.

export type RateParse = { ok: true; rate: number } | { ok: false; error: string };

export function parseRate(text: string, label: string): RateParse {
  const t = text.trim().replace(",", ".");
  if (!/^\d{1,2}(\.\d{1,2})?$/.test(t)) {
    return { ok: false, error: `${label} must be a percentage from 0 to 99.99 with at most two decimals.` };
  }
  return { ok: true, rate: Number(t) };
}

// The rate as the server stores it ("10.00") against what is typed ("10", "10.0"): the same percentage is not a change.
export function rateChanged(saved: string, typed: string): boolean {
  const parsed = parseRate(typed, "");
  if (!parsed.ok) return true;
  return Math.round(parsed.rate * 100) !== Math.round(Number(saved) * 100);
}
