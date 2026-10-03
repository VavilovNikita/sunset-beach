import { describe, expect, it } from "vitest";
import { billTreatmentsLabel, spaBlockMark, spaBlockTitle } from "./spaAppointmentDisplay";

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
