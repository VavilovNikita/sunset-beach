import { describe, expect, it } from "vitest";
import { isLongOpen, isSpaOrder, longOpenLabel, orderNumberLabel, orderRefLabel, tableBillLabel, ticketTitle, validateVoidReason } from "./posOrders";

const NOW = new Date("2026-10-03T12:00:00Z");

describe("order number labels", () => {
  it("shows the receipt number, with the id as a short reference", () => {
    expect(orderNumberLabel({ number: 1234 })).toBe("#1234");
    expect(orderRefLabel({ id: "4f6c31f1-aaaa-bbbb-cccc-571ed2000000" })).toBe("4F6C31F1");
  });

  it("names a table-less ticket by guest, else by number", () => {
    expect(ticketTitle({ number: 7, guestName: "Anna" })).toBe("Anna");
    expect(ticketTitle({ number: 7, guestName: null })).toBe("Ticket #7");
  });
});

describe("isLongOpen", () => {
  it("flags an open or sent order from a day ago or more", () => {
    expect(isLongOpen({ status: "OPEN", createdAt: "2026-10-02T12:00:00Z" }, NOW)).toBe(true);
    expect(isLongOpen({ status: "SENT", createdAt: "2026-09-01T08:00:00Z" }, NOW)).toBe(true);
  });

  it("leaves a recent order, a closed one and an unparseable date alone", () => {
    expect(isLongOpen({ status: "OPEN", createdAt: "2026-10-02T12:00:01Z" }, NOW)).toBe(false);
    expect(isLongOpen({ status: "PAID", createdAt: "2026-09-01T08:00:00Z" }, NOW)).toBe(false);
    expect(isLongOpen({ status: "OPEN", createdAt: "not a date" }, NOW)).toBe(false);
  });

  it("words the age in hours, then days", () => {
    expect(longOpenLabel("2026-10-02T10:00:00Z", NOW)).toBe("Open 26 h");
    expect(longOpenLabel("2026-09-30T11:00:00Z", NOW)).toBe("Open 3 days");
  });
});

describe("isSpaOrder", () => {
  it("is a spa order when it bills an appointment or sits on a spa table", () => {
    expect(isSpaOrder({ spaAppointmentId: "appt-1" }, null)).toBe(true);
    expect(isSpaOrder({ spaAppointmentId: null }, "SPA")).toBe(true);
    expect(isSpaOrder({ spaAppointmentId: null }, "RESTAURANT")).toBe(false);
    expect(isSpaOrder({ spaAppointmentId: null }, undefined)).toBe(false);
  });
});

describe("validateVoidReason", () => {
  it("needs a real reason", () => {
    expect(validateVoidReason("  ")).not.toBeNull();
    expect(validateVoidReason("no")).not.toBeNull();
    expect(validateVoidReason("Guest sent it back")).toBeNull();
    expect(validateVoidReason("x".repeat(501))).not.toBeNull();
  });
});

describe("tableBillLabel", () => {
  it("sums the open orders' own totals", () => {
    expect(tableBillLabel([{ total: "450.00" }, { total: "1280.00" }])).toBe("฿1,730");
  });
  it("is null for an empty table or a ฿0 bill", () => {
    expect(tableBillLabel([])).toBeNull();
    expect(tableBillLabel([{ total: "0.00" }])).toBeNull();
  });
});
