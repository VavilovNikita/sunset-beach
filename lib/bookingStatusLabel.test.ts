import { describe, expect, it } from "vitest";
import { bookingStatusLabel, overstayText, roomPaidButOwesLine, settlementChip } from "@/lib/bookingStatusLabel";

describe("bookingStatusLabel", () => {
  it("shows PAID as Room paid and leaves the rest alone", () => {
    expect(bookingStatusLabel("PAID")).toBe("Room paid");
    expect(bookingStatusLabel("NEW")).toBe("NEW");
    expect(bookingStatusLabel("CANCELLED")).toBe("CANCELLED");
  });
});

describe("settlementChip", () => {
  it("says what is owed once the debt has fallen due, and nothing for a future unpaid booking", () => {
    expect(settlementChip({ settlement: "OWES", balanceDue: "172500.00", owes: true, status: "PAID" })).toEqual({ text: "Owes ฿172,500", tone: "owes" });
    expect(settlementChip({ settlement: "OWES", balanceDue: "7000.00", owes: false, status: "NEW" })).toBeNull();
  });
  it("shows credit with its amount, and Settled only beside Room paid", () => {
    expect(settlementChip({ settlement: "CREDIT", creditBalance: "500.00", status: "PAID" })).toEqual({ text: "Credit ฿500", tone: "credit" });
    expect(settlementChip({ settlement: "SETTLED", status: "PAID" })).toEqual({ text: "Settled", tone: "settled" });
    expect(settlementChip({ settlement: "SETTLED", status: "CONFIRMED" })).toBeNull();
  });
  it("falls back to the balance when a row has no settlement", () => {
    expect(settlementChip({ balanceDue: "300.00" })).toEqual({ text: "Owes ฿300", tone: "owes" });
    expect(settlementChip({ balanceDue: "0.00" })).toBeNull();
  });
});

describe("roomPaidButOwesLine", () => {
  it("is only for a paid room with a balance", () => {
    expect(roomPaidButOwesLine("PAID", "OWES", "172500.00")).toBe("Room is paid, but ฿172,500 is still owed (overstay / charges)");
    expect(roomPaidButOwesLine("PAID", "SETTLED", "0.00")).toBeNull();
    expect(roomPaidButOwesLine("NEW", "OWES", "100.00")).toBeNull();
  });
});

describe("overstayText", () => {
  it("is one number, with tonight said only when it is in", () => {
    expect(overstayText(49, true, "172500.00")).toBe("Overstaying 49 nights (incl. tonight) · ฿172,500 charged");
    expect(overstayText(48, false, "168000.00")).toBe("Overstaying 48 nights · ฿168,000 charged");
    expect(overstayText(1, true)).toBe("Overstaying 1 night (incl. tonight)");
  });
});
