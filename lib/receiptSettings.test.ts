import { describe, expect, it } from "vitest";
import {
  checkReceiptText,
  checkReceiptTitle,
  logoWidthShare,
  receiptInputProblem,
  receiptInputsEqual,
  toReceiptInput,
} from "./receiptSettings";
import type { ReceiptSettings } from "./types";

const saved: ReceiptSettings = {
  paperWidth: "MM80",
  bodyFont: "A",
  receiptTitle: "GUEST RECEIPT",
  prebillTitle: "PRE-BILL",
  titleSize: 1,
  totalSize: 1,
  totalBold: false,
  headerText: "",
  headerBold: true,
  footerText: "",
  showOrderNumber: true,
  showTime: true,
  showVatLine: true,
  showPaymentMethod: true,
  showLogo: false,
  logoWidthPercent: 60,
  hasLogo: false,
  updatedAt: "2026-10-11T10:00:00Z",
};

describe("toReceiptInput", () => {
  it("drops what the server owns, so a PUT body never carries hasLogo/updatedAt", () => {
    const input = toReceiptInput(saved);
    expect(input).not.toHaveProperty("hasLogo");
    expect(input).not.toHaveProperty("updatedAt");
    expect(input.receiptTitle).toBe("GUEST RECEIPT");
  });
});

describe("receiptInputsEqual", () => {
  it("ignores blank lines and padding the server strips on save", () => {
    const a = { ...toReceiptInput(saved), headerText: "Sunset Beach\n12 Beach Rd", receiptTitle: "GUEST RECEIPT" };
    const b = { ...a, headerText: "  Sunset Beach \n\n12 Beach Rd\n", receiptTitle: " GUEST RECEIPT " };
    expect(receiptInputsEqual(a, b)).toBe(true);
  });
  it("sees a real change", () => {
    expect(receiptInputsEqual(toReceiptInput(saved), { ...toReceiptInput(saved), bodyFont: "B" })).toBe(false);
  });
});

describe("checkReceiptTitle", () => {
  it.each([
    ["", "required"],
    ["   ", "required"],
    ["X".repeat(25), "24"],
  ])("rejects %j", (title, mention) => {
    expect(checkReceiptTitle(title)).toContain(mention);
  });
  it("accepts 1 to 24 characters", () => {
    expect(checkReceiptTitle("A")).toBeNull();
    expect(checkReceiptTitle("X".repeat(24))).toBeNull();
  });
});

describe("checkReceiptText", () => {
  it("accepts empty and up to six lines", () => {
    expect(checkReceiptText("")).toBeNull();
    expect(checkReceiptText("1\n2\n3\n4\n5\n6")).toBeNull();
  });
  it("doesn't count blank lines", () => {
    expect(checkReceiptText("1\n\n\n2\n\n3\n4\n5\n6\n")).toBeNull();
  });
  it("rejects a seventh line and a line over 48 characters", () => {
    expect(checkReceiptText("1\n2\n3\n4\n5\n6\n7")).toContain("6 lines");
    expect(checkReceiptText("X".repeat(49))).toContain("48");
    expect(checkReceiptText("X".repeat(48))).toBeNull();
  });
});

describe("receiptInputProblem", () => {
  it("is null for the seeded settings", () => {
    expect(receiptInputProblem(toReceiptInput(saved))).toBeNull();
  });
  it("names the field", () => {
    expect(receiptInputProblem({ ...toReceiptInput(saved), prebillTitle: "" })).toMatch(/^Pre-bill title/);
    expect(receiptInputProblem({ ...toReceiptInput(saved), footerText: "X".repeat(60) })).toMatch(/^Footer/);
    expect(receiptInputProblem({ ...toReceiptInput(saved), logoWidthPercent: 5 })).toMatch(/^Logo width/);
  });
});

describe("logoWidthShare", () => {
  it("is the logo's share of the roll's dot width", () => {
    expect(logoWidthShare(288, "MM80")).toBe(50);
    expect(logoWidthShare(192, "MM58")).toBe(50);
  });
});
