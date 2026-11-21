// The one way an amount of baht is shown. Same rule as the backend's PriceFormat.baht: satang only when there are some,
// and then always two digits - "฿8,000", "฿8,000.50" (never "฿8,000.5"). Formatting only: the amount is the server's.
// A negative amount is "−฿500" (a real minus sign, like the rest of the interface).
export function formatBaht(amount: string | number | null | undefined): string {
  const value = amount == null ? 0 : typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(value)) return "฿0";
  const cents = Math.round(Math.abs(value) * 100);
  const whole = Math.floor(cents / 100);
  const satang = cents % 100;
  const digits = whole.toLocaleString("en-US") + (satang === 0 ? "" : `.${String(satang).padStart(2, "0")}`);
  return `${value < 0 && cents !== 0 ? "−" : ""}฿${digits}`;
}
