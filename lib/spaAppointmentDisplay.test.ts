import { describe, expect, it } from "vitest";
import { billTreatmentsLabel, isSpaOverdue, isSpaStartInPast, spaBlockMark, spaBlockTitle } from "./spaAppointmentDisplay";
import type { SpaAppointmentStatus } from "@/lib/posTypes";

describe("billTreatmentsLabel", () => {
  it("counts the treatments it will bill", () => {
    expect(billTreatmentsLabel(1)).toBe("Bill treatment");
    expect(billTreatmentsLabel(3)).toBe("Bill 3 treatments");
  });
});

describe("spaBlockMark", () => {
  it("marks cancelled and no-show blocks, never live or completed ones", () => {
    expect(spaBlockMark("CANCELLED")).toEqual({ icon: "✕", label: "Cancelled" });
    expect(spaBlockMark("NO_SHOW")?.label).toBe("No-show");
    expect(spaBlockMark("BOOKED")).toBeNull();
    expect(spaBlockMark("COMPLETED")).toBeNull();
  });
});

describe("spaBlockTitle", () => {
  const treatments = [
    { id: "1", treatmentMenuItemId: "m1", treatmentName: "Thai massage", durationMinutes: 60, currentPrice: "900" },
    { id: "2", treatmentMenuItemId: "m2", treatmentName: "Foot scrub", durationMinutes: 30, currentPrice: "400" },
  ];

  it("names guest, room, treatments and status", () => {
    expect(spaBlockTitle({ guestName: "Jane", roomUnitLabel: "104", treatments, status: "BOOKED", cancelReason: null })).toBe(
      "Jane · Room 104 · Thai massage, Foot scrub · Booked"
    );
  });

  it("leaves the room out when none is assigned and gives the cancel reason", () => {
    expect(
      spaBlockTitle({ guestName: "Jane", roomUnitLabel: null, treatments, status: "CANCELLED", cancelReason: "Guest unwell" })
    ).toBe("Jane · Thai massage, Foot scrub · Cancelled: Guest unwell");
  });
});

describe("isSpaOverdue", () => {
  // 14:00 Bangkok on 4 Oct 2026 is 07:00Z.
  const now = new Date("2026-10-04T07:00:00Z");
  const appt = (over: Partial<{ status: SpaAppointmentStatus; date: string; startTime: string; durationMinutes: number }>) => ({
    status: "BOOKED" as SpaAppointmentStatus,
    date: "2026-10-04",
    startTime: "10:00",
    durationMinutes: 60,
    ...over,
  });

  it("flags a booked appointment that ended earlier today", () => {
    expect(isSpaOverdue(appt({}), now)).toBe(true);
  });

  it("does not flag one still running or still to come", () => {
    expect(isSpaOverdue(appt({ startTime: "13:30" }), now)).toBe(false);
    expect(isSpaOverdue(appt({ startTime: "15:00" }), now)).toBe(false);
  });

  it("flags one from an earlier day, not one from a later day", () => {
    expect(isSpaOverdue(appt({ date: "2026-10-03", startTime: "20:00" }), now)).toBe(true);
    expect(isSpaOverdue(appt({ date: "2026-10-05", startTime: "08:00" }), now)).toBe(false);
  });

  it("never flags a settled appointment", () => {
    expect(isSpaOverdue(appt({ status: "COMPLETED" }), now)).toBe(false);
    expect(isSpaOverdue(appt({ status: "NO_SHOW" }), now)).toBe(false);
  });

  it("reads the hotel clock, not UTC: 23:30 UTC is already the next day in Bangkok", () => {
    expect(isSpaOverdue(appt({ date: "2026-10-04", startTime: "01:00" }), new Date("2026-10-03T23:30:00Z"))).toBe(true);
  });
});

describe("isSpaStartInPast", () => {
  // 15:16 UTC = 22:16 in Bangkok - the case found: booking 10:30 at 22:16.
  const NOW = new Date("2026-10-04T15:16:00Z");

  it("flags an earlier time today and any earlier day", () => {
    expect(isSpaStartInPast("2026-10-04", "10:30", NOW)).toBe(true);
    expect(isSpaStartInPast("2026-10-03", "23:00", NOW)).toBe(true);
  });

  it("leaves a later time today and a later day alone", () => {
    expect(isSpaStartInPast("2026-10-04", "22:30", NOW)).toBe(false);
    expect(isSpaStartInPast("2026-10-05", "09:00", NOW)).toBe(false);
  });

  it("reads the hotel clock, not UTC", () => {
    // 18:00 UTC is 01:00 the next day in Bangkok, so a 23:00 slot on the UTC date is already over.
    expect(isSpaStartInPast("2026-10-04", "23:00", new Date("2026-10-04T18:00:00Z"))).toBe(true);
  });
});
