import { describe, expect, it } from "vitest";
import {
  PRINT_CONTROLS,
  PRINT_DOCUMENTS,
  checkPrintText,
  checkPrintTitle,
  logoWidthShare,
  printLayoutInputsEqual,
  printLayoutProblem,
  toPrintLayoutInput,
} from "./printLayout";
import type { PrintLayout } from "./types";

const saved: PrintLayout = {
  documentType: "RECEIPT",
  paperWidth: "MM80",
  bodyFont: "A",
  title: "GUEST RECEIPT",
  titleSize: 1,
  headerText: "",
  headerBold: true,
  footerText: "",
  showLogo: false,
  logoWidthPercent: 60,
  showTime: true,
  itemSize: 1,
  showLocation: true,
  locationSize: 1,
  showOrderNumber: true,
  showWaiter: true,
  showItemNotes: true,
  showVatLine: true,
  showPaymentMethod: true,
  totalSize: 1,
  totalBold: false,
  updatedAt: "2026-10-11T10:00:00Z",
};

describe("toPrintLayoutInput", () => {
  it("drops what the server owns, so a PUT body never carries documentType/updatedAt", () => {
    const input = toPrintLayoutInput(saved);
    expect(input).not.toHaveProperty("documentType");
    expect(input).not.toHaveProperty("updatedAt");
    expect(input.title).toBe("GUEST RECEIPT");
  });
});

describe("printLayoutInputsEqual", () => {
  it("ignores blank lines and padding the server strips on save", () => {
    const a = { ...toPrintLayoutInput(saved), headerText: "Sunset Beach\n12 Beach Rd" };
    const b = { ...a, headerText: "  Sunset Beach \n\n12 Beach Rd\n", title: " GUEST RECEIPT " };
    expect(printLayoutInputsEqual(a, b)).toBe(true);
  });
  it("sees a real change", () => {
    expect(printLayoutInputsEqual(toPrintLayoutInput(saved), { ...toPrintLayoutInput(saved), bodyFont: "B" })).toBe(false);
  });
});

describe("checkPrintTitle", () => {
  it.each([
    ["", "required"],
    ["   ", "required"],
    ["X".repeat(25), "24"],
  ])("rejects %j", (title, mention) => {
    expect(checkPrintTitle(title)).toContain(mention);
  });
  it("accepts 1 to 24 characters", () => {
    expect(checkPrintTitle("A")).toBeNull();
    expect(checkPrintTitle("X".repeat(24))).toBeNull();
  });
});

describe("checkPrintText", () => {
  it("accepts empty and up to six lines, not counting blank ones", () => {
    expect(checkPrintText("")).toBeNull();
    expect(checkPrintText("1\n2\n3\n4\n5\n6")).toBeNull();
    expect(checkPrintText("1\n\n\n2\n\n3\n4\n5\n6\n")).toBeNull();
  });
  it("rejects a seventh line and a line over 48 characters", () => {
    expect(checkPrintText("1\n2\n3\n4\n5\n6\n7")).toContain("6 lines");
    expect(checkPrintText("X".repeat(49))).toContain("48");
    expect(checkPrintText("X".repeat(48))).toBeNull();
  });
});

describe("printLayoutProblem", () => {
  it("is null for the seeded settings", () => {
    expect(printLayoutProblem(toPrintLayoutInput(saved))).toBeNull();
  });
  it("names the field", () => {
    expect(printLayoutProblem({ ...toPrintLayoutInput(saved), title: "" })).toMatch(/^Title/);
    expect(printLayoutProblem({ ...toPrintLayoutInput(saved), footerText: "X".repeat(60) })).toMatch(/^Footer/);
    expect(printLayoutProblem({ ...toPrintLayoutInput(saved), logoWidthPercent: 5 })).toMatch(/^Logo width/);
  });
});

describe("PRINT_CONTROLS", () => {
  it("has an entry for every document in the tab order", () => {
    for (const d of PRINT_DOCUMENTS) expect(PRINT_CONTROLS[d.type]).toBeDefined();
    expect(PRINT_DOCUMENTS.map((d) => d.type)).toEqual(["RECEIPT", "PREBILL", "KITCHEN_TICKET", "BAR_TICKET", "Z_REPORT"]);
  });
  it("offers each document only the controls the backend reads for it", () => {
    // Only the guest-facing documents print the logo.
    expect(Object.values(PRINT_CONTROLS).filter((c) => c.logo).length).toBe(2);
    expect(PRINT_CONTROLS.RECEIPT.payment).toBe(true);
    expect(PRINT_CONTROLS.PREBILL.payment).toBe(false); // a pre-bill has no payment yet
    expect(PRINT_CONTROLS.KITCHEN_TICKET.waiter && PRINT_CONTROLS.BAR_TICKET.itemNotes).toBe(true);
    expect(PRINT_CONTROLS.KITCHEN_TICKET.vat || PRINT_CONTROLS.KITCHEN_TICKET.total).toBe(false); // tickets carry no prices
    expect(PRINT_CONTROLS.Z_REPORT.orderLines || PRINT_CONTROLS.Z_REPORT.itemSize).toBe(false);
  });
});

describe("logoWidthShare", () => {
  it("is the logo's share of the roll's dot width", () => {
    expect(logoWidthShare(288, "MM80")).toBe(50);
    expect(logoWidthShare(192, "MM58")).toBe(50);
  });
});
