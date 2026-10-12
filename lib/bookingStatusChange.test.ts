import { describe, expect, it } from "vitest";
import {
  needsCancellationConfirm,
  needsPaymentDialog,
  paidPaymentInput,
  validateCancellationReason,
  validatePaidPayment,
} from "@/lib/bookingStatusChange";

describe("needsCancellationConfirm", () => {
  it("asks only when the booking is moving into CANCELLED", () => {
    expect(needsCancellationConfirm("CONFIRMED", "CANCELLED")).toBe(true);
    expect(needsCancellationConfirm("PAID", "CANCELLED")).toBe(true);
    expect(needsCancellationConfirm("CANCELLED", "CANCELLED")).toBe(false);
    expect(needsCancellationConfirm("NEW", "CONFIRMED")).toBe(false);
  });
});

describe("validateCancellationReason", () => {
  it("requires a real reason", () => {
    expect(validateCancellationReason("   ")).toBe("Say why the booking is being cancelled.");
    expect(validateCancellationReason("no")).toBe("Say why the booking is being cancelled.");
    expect(validateCancellationReason("Guest's flight was cancelled")).toBeNull();
  });

  it("caps the length at what the API accepts", () => {
    expect(validateCancellationReason("x".repeat(501))).toBe("Keep the reason under 500 characters.");
  });
});

describe("needsPaymentDialog", () => {
  it("asks for a payment when a booking becomes PAID while money is owed", () => {
    expect(needsPaymentDialog("NEW", "PAID", "4500.00")).toBe(true);
    expect(needsPaymentDialog("CONFIRMED", "PAID", "120.50")).toBe(true);
    // A cancelled booking being reinstated straight to PAID owes the room again - the server says how much.
    expect(needsPaymentDialog("CANCELLED", "PAID", "4500.00")).toBe(true);
  });

  it("does not ask when nothing is owed, when it is already PAID, or for any other change", () => {
    expect(needsPaymentDialog("NEW", "PAID", "0.00")).toBe(false);
    expect(needsPaymentDialog("NEW", "PAID", null)).toBe(false);
    expect(needsPaymentDialog("PAID", "PAID", "100.00")).toBe(false);
    expect(needsPaymentDialog("NEW", "CONFIRMED", "100.00")).toBe(false);
    expect(needsPaymentDialog("CONFIRMED", "CANCELLED", "100.00")).toBe(false);
  });
});

describe("validatePaidPayment", () => {
  it("requires a method to be chosen", () => {
    expect(validatePaidPayment("", "100.00")).toBe("Choose how the guest paid.");
  });

  it("requires a positive amount", () => {
    expect(validatePaidPayment("CASH", "")).toBe("Enter the amount collected.");
    expect(validatePaidPayment("CASH", "0")).toBe("Enter the amount collected.");
    expect(validatePaidPayment("CASH", "-5")).toBe("Enter the amount collected.");
    expect(validatePaidPayment("CASH", "abc")).toBe("Enter the amount collected.");
  });

  it("accepts a method and a positive amount", () => {
    expect(validatePaidPayment("CARD", "4500.00")).toBeNull();
  });
});

describe("paidPaymentInput", () => {
  it("sends the amount as typed, trimmed", () => {
    expect(paidPaymentInput("OTHER", " 4500.00 ")).toEqual({ method: "OTHER", amount: "4500.00" });
  });
});
