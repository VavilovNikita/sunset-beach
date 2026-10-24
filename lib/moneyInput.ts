// Money typed into a form field. A browser's own <input type="number"> prints and parses decimals in the
// browser's locale ("7000,00" in a Russian one), which does not match the rest of the interface (and the API) -
// so amounts are plain text fields that take either separator and always show a dot.
export function normalizeMoneyInput(raw: string): string {
  const cleaned = raw.replace(/[\s ]/g, "").replace(",", ".").replace(/[^0-9.]/g, "");
  const dot = cleaned.indexOf(".");
  if (dot === -1) return cleaned;
  // One decimal point only; anything after a second one is dropped.
  return cleaned.slice(0, dot + 1) + cleaned.slice(dot + 1).replace(/\./g, "");
}
