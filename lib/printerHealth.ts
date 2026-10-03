// The printers screen's online/offline indicator. The backend has no heartbeat to a printer - the
// only contact is delivering a print job - so this reads the two timestamps the print queue
// already yields (Printer.lastSentAt / lastFailedAt, see lib/posTypes.ts) and says what they
// support, no more: a printer whose newest attempt failed is "not answering"; one that last
// printed fine is "online" as of that print, and after a quiet day only "quiet" - nothing has
// tested it since. Test print is the way to get a fresh answer.
import type { Printer } from "@/lib/posTypes";
import { formatTimestamp } from "@/lib/formatDate";

export type PrinterHealthState = "online" | "offline" | "quiet" | "unknown";

export type PrinterHealth = { state: PrinterHealthState; label: string };

// Past this, a last successful print says little about now (a printer can be unplugged overnight).
export const PRINTER_QUIET_AFTER_MS = 24 * 60 * 60 * 1000;

export function printerHealth(printer: Pick<Printer, "lastSentAt" | "lastFailedAt">, now: Date): PrinterHealth {
  const sent = printer.lastSentAt ? Date.parse(printer.lastSentAt) : null;
  const failed = printer.lastFailedAt ? Date.parse(printer.lastFailedAt) : null;

  if (failed !== null && (sent === null || failed > sent)) {
    const lastPrinted = printer.lastSentAt ? `; last printed ${formatTimestamp(printer.lastSentAt)}` : "";
    return { state: "offline", label: `Not answering — last attempt failed ${formatTimestamp(printer.lastFailedAt!)}${lastPrinted}` };
  }
  if (sent === null) {
    return { state: "unknown", label: "Never printed — use Test print to check it" };
  }
  if (now.getTime() - sent > PRINTER_QUIET_AFTER_MS) {
    return { state: "quiet", label: `Last printed ${formatTimestamp(printer.lastSentAt!)} — nothing since` };
  }
  return { state: "online", label: `Online — last printed ${formatTimestamp(printer.lastSentAt!)}` };
}
