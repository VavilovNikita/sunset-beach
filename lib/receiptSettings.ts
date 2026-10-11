import type { ReceiptSettings, ReceiptSettingsInput } from "@/lib/types";

// Pure helpers for the receipt designer (/admin/settings/receipt). The server validates all of
// this again - these only exist so the form can say what's wrong before a round trip.

export const MAX_RECEIPT_TITLE = 24;
export const MAX_RECEIPT_TEXT_LINES = 6;
export const MAX_RECEIPT_TEXT_LINE_LENGTH = 48;

// The editable part of the saved settings - what PUT /settings/receipt takes.
export function toReceiptInput(settings: ReceiptSettings): ReceiptSettingsInput {
  return {
    paperWidth: settings.paperWidth,
    bodyFont: settings.bodyFont,
    receiptTitle: settings.receiptTitle,
    prebillTitle: settings.prebillTitle,
    titleSize: settings.titleSize,
    totalSize: settings.totalSize,
    totalBold: settings.totalBold,
    headerText: settings.headerText,
    headerBold: settings.headerBold,
    footerText: settings.footerText,
    showOrderNumber: settings.showOrderNumber,
    showTime: settings.showTime,
    showVatLine: settings.showVatLine,
    showPaymentMethod: settings.showPaymentMethod,
    showLogo: settings.showLogo,
    logoWidthPercent: settings.logoWidthPercent,
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

export function normaliseReceiptInput(input: ReceiptSettingsInput): ReceiptSettingsInput {
  return {
    ...input,
    receiptTitle: input.receiptTitle.trim(),
    prebillTitle: input.prebillTitle.trim(),
    headerText: normaliseText(input.headerText),
    footerText: normaliseText(input.footerText),
  };
}

export function receiptInputsEqual(a: ReceiptSettingsInput, b: ReceiptSettingsInput): boolean {
  return JSON.stringify(normaliseReceiptInput(a)) === JSON.stringify(normaliseReceiptInput(b));
}

export function checkReceiptTitle(title: string): string | null {
  const t = title.trim();
  if (t === "") return "A title is required.";
  if (t.length > MAX_RECEIPT_TITLE) return `At most ${MAX_RECEIPT_TITLE} characters.`;
  return null;
}

// Header / footer: up to 6 non-blank lines of up to 48 characters. Null when fine.
export function checkReceiptText(text: string): string | null {
  const lines = normaliseText(text) === "" ? [] : normaliseText(text).split("\n");
  if (lines.length > MAX_RECEIPT_TEXT_LINES) return `At most ${MAX_RECEIPT_TEXT_LINES} lines.`;
  if (lines.some((l) => l.length > MAX_RECEIPT_TEXT_LINE_LENGTH)) return `Each line at most ${MAX_RECEIPT_TEXT_LINE_LENGTH} characters.`;
  return null;
}

// The first thing wrong with the form, or null when it can be saved/previewed.
export function receiptInputProblem(input: ReceiptSettingsInput): string | null {
  const titleProblem = checkReceiptTitle(input.receiptTitle);
  if (titleProblem) return `Receipt title: ${titleProblem}`;
  const prebillProblem = checkReceiptTitle(input.prebillTitle);
  if (prebillProblem) return `Pre-bill title: ${prebillProblem}`;
  const header = checkReceiptText(input.headerText);
  if (header) return `Header: ${header}`;
  const footer = checkReceiptText(input.footerText);
  if (footer) return `Footer: ${footer}`;
  if (!Number.isInteger(input.logoWidthPercent) || input.logoWidthPercent < 20 || input.logoWidthPercent > 100) {
    return "Logo width: between 20 and 100 %.";
  }
  return null;
}

// Font B glyphs are 9 dots wide against Font A's 12, so a Font B character is this much narrower.
export const FONT_B_WIDTH_RATIO = 0.75;

// The preview paper is `columns` Font A characters wide; this is the printed logo's share of it.
export function logoWidthShare(logoWidthDots: number, paperWidth: ReceiptSettingsInput["paperWidth"]): number {
  const paperDots = paperWidth === "MM80" ? 576 : 384;
  return Math.min(100, Math.max(0, (logoWidthDots / paperDots) * 100));
}
