import type { PrintLayout, PrintLayoutDocument, PrintLayoutInput } from "@/lib/types";

// Pure helpers for the print-layout designer (/admin/settings/print-layouts). The server validates
// all of this again - these only exist so the form can say what's wrong before a round trip.

export const MAX_PRINT_TITLE = 24;
export const MAX_PRINT_TEXT_LINES = 6;
export const MAX_PRINT_TEXT_LINE_LENGTH = 48;

export const PRINT_DOCUMENTS: { type: PrintLayoutDocument; label: string }[] = [
  { type: "RECEIPT", label: "Guest receipt" },
  { type: "PREBILL", label: "Pre-bill" },
  { type: "KITCHEN_TICKET", label: "Kitchen ticket" },
  { type: "BAR_TICKET", label: "Bar ticket" },
  { type: "Z_REPORT", label: "Z-report" },
];

// Which controls a document has. Mirrors what the backend's renderer reads for it
// (PrintLayoutInput's description in openapi.yaml) - a control for a field the document ignores
// would be a switch that does nothing. Title, size of the title, paper width and font apply to all.
export type PrintControls = {
  headerFooter: boolean;
  logo: boolean;
  time: boolean;
  timeLabel: string;
  orderLines: boolean; // location + order number (+ their sizes)
  itemSize: boolean;
  waiter: boolean;
  itemNotes: boolean;
  vat: boolean;
  payment: boolean;
  total: boolean;
};

const NONE: PrintControls = {
  headerFooter: false, logo: false, time: false, timeLabel: "Date and time", orderLines: false, itemSize: false,
  waiter: false, itemNotes: false, vat: false, payment: false, total: false,
};

export const PRINT_CONTROLS: Record<PrintLayoutDocument, PrintControls> = {
  RECEIPT: { ...NONE, headerFooter: true, logo: true, time: true, orderLines: true, itemSize: true, vat: true, payment: true, total: true },
  PREBILL: { ...NONE, headerFooter: true, logo: true, time: true, orderLines: true, itemSize: true, vat: true, total: true },
  KITCHEN_TICKET: { ...NONE, time: true, orderLines: true, itemSize: true, waiter: true, itemNotes: true },
  BAR_TICKET: { ...NONE, time: true, orderLines: true, itemSize: true, waiter: true, itemNotes: true },
  Z_REPORT: { ...NONE, headerFooter: true, time: true, timeLabel: "“Closed” time line" },
};

// The editable part of a saved layout - what PUT takes.
export function toPrintLayoutInput(layout: PrintLayout): PrintLayoutInput {
  return {
    paperWidth: layout.paperWidth,
    bodyFont: layout.bodyFont,
    title: layout.title,
    titleSize: layout.titleSize,
    headerText: layout.headerText,
    headerBold: layout.headerBold,
    footerText: layout.footerText,
    showLogo: layout.showLogo,
    logoWidthPercent: layout.logoWidthPercent,
    showTime: layout.showTime,
    itemSize: layout.itemSize,
    showLocation: layout.showLocation,
    locationSize: layout.locationSize,
    showOrderNumber: layout.showOrderNumber,
    showWaiter: layout.showWaiter,
    showItemNotes: layout.showItemNotes,
    showVatLine: layout.showVatLine,
    showPaymentMethod: layout.showPaymentMethod,
    totalSize: layout.totalSize,
    totalBold: layout.totalBold,
  };
}

// The server drops blank lines and trims each line before storing, so "dirty" compares the
// normalised text - a stray blank line shouldn't make an already-saved form look unsaved.
function normaliseText(text: string): string {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l !== "")
    .join("\n");
}

export function normalisePrintLayoutInput(input: PrintLayoutInput): PrintLayoutInput {
  return {
    ...input,
    title: input.title.trim(),
    headerText: normaliseText(input.headerText),
    footerText: normaliseText(input.footerText),
  };
}

export function printLayoutInputsEqual(a: PrintLayoutInput, b: PrintLayoutInput): boolean {
  return JSON.stringify(normalisePrintLayoutInput(a)) === JSON.stringify(normalisePrintLayoutInput(b));
}

export function checkPrintTitle(title: string): string | null {
  const t = title.trim();
  if (t === "") return "A title is required.";
  if (t.length > MAX_PRINT_TITLE) return `At most ${MAX_PRINT_TITLE} characters.`;
  return null;
}

// Header / footer: up to 6 non-blank lines of up to 48 characters. Null when fine.
export function checkPrintText(text: string): string | null {
  const normalised = normaliseText(text);
  const lines = normalised === "" ? [] : normalised.split("\n");
  if (lines.length > MAX_PRINT_TEXT_LINES) return `At most ${MAX_PRINT_TEXT_LINES} lines.`;
  if (lines.some((l) => l.length > MAX_PRINT_TEXT_LINE_LENGTH)) return `Each line at most ${MAX_PRINT_TEXT_LINE_LENGTH} characters.`;
  return null;
}

// The first thing wrong with the form, or null when it can be saved/previewed.
export function printLayoutProblem(input: PrintLayoutInput): string | null {
  const title = checkPrintTitle(input.title);
  if (title) return `Title: ${title}`;
  const header = checkPrintText(input.headerText);
  if (header) return `Header: ${header}`;
  const footer = checkPrintText(input.footerText);
  if (footer) return `Footer: ${footer}`;
  if (!Number.isInteger(input.logoWidthPercent) || input.logoWidthPercent < 20 || input.logoWidthPercent > 100) {
    return "Logo width: between 20 and 100 %.";
  }
  return null;
}

// Font B glyphs are 9 dots wide against Font A's 12, so a Font B character is this much narrower.
export const FONT_B_WIDTH_RATIO = 0.75;

// The preview paper is `columns` Font A characters wide; this is the printed logo's share of it.
export function logoWidthShare(logoWidthDots: number, paperWidth: PrintLayoutInput["paperWidth"]): number {
  const paperDots = paperWidth === "MM80" ? 576 : 384;
  return Math.min(100, Math.max(0, (logoWidthDots / paperDots) * 100));
}
