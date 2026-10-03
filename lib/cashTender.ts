// The cash-close dialog's arithmetic: what the guest handed over vs. the server's order total,
// and the change to give back. Worked in whole satang (integers) so ฿0.10 + ฿0.20 never shows as
// ฿0.30000000000000004.
//
// The frontend's money rule is "never display an amount computed on the client". This is the one
// narrow case where that can't apply as written: the change is a fact about the notes in the
// cashier's hand, not a price - the total it's measured against is the server's own Order.total,
// and the tendered figure is typed by the cashier. Nothing computed here is charged or stored:
// the close request sends only the typed amount (`amountTendered`), the server re-checks it
// against the total, charges exactly Order.total, and records tendered + change in the audit log.
export function parseBahtToSatang(input: string): number | null {
  const trimmed = input.trim().replace(/,/g, "");
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(trimmed)) return null;
  const [whole, fraction = ""] = trimmed.split(".");
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
}

export type CashTender =
  | { ok: true; tendered: string; change: string } // both as plain decimal strings, e.g. "500.00"
  | { ok: false; reason: "invalid" | "insufficient"; short?: string };

export function cashTender(orderTotal: string, tenderedInput: string): CashTender {
  const total = parseBahtToSatang(orderTotal);
  const tendered = parseBahtToSatang(tenderedInput);
  if (total === null || tendered === null) return { ok: false, reason: "invalid" };
  if (tendered < total) return { ok: false, reason: "insufficient", short: satangToDecimal(total - tendered) };
  return { ok: true, tendered: satangToDecimal(tendered), change: satangToDecimal(tendered - total) };
}

export function satangToDecimal(satang: number): string {
  return `${Math.floor(satang / 100)}.${String(satang % 100).padStart(2, "0")}`;
}
