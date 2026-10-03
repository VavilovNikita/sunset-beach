import { describe, expect, it } from "vitest";
import { needsCancellationConfirm, validateCancellationReason } from "@/lib/bookingStatusChange";

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
