import { describe, expect, it } from "vitest";
import { tableClash, therapistClash, therapistDay } from "./spaAvailability";
import type { SpaAppointment } from "@/lib/posTypes";

function appt(overrides: Partial<SpaAppointment>): SpaAppointment {
  return {
    id: "a1",
    bookingId: "b1",
    guestName: "Jane",
    tableId: "t1",
    tableLabel: "Table 1",
    therapistUserId: "th1",
    therapistName: "Mai",
    therapistEmail: null,
    treatments: [],
    date: "2026-10-03",
    startTime: "10:00",
    durationMinutes: 60,
    status: "BOOKED",
    orderId: null,
    missingTreatmentNames: [],
    createdByUserId: "u1",
    cancelledByUserId: null,
    cancelReason: null,
    createdAt: "2026-10-01T00:00:00Z",
    updatedAt: "2026-10-01T00:00:00Z",
    ...overrides,
  };
}

describe("therapistClash", () => {
  it("finds an overlapping appointment of the same therapist on any table", () => {
    const day = [appt({ tableId: "other-table" })];
    expect(therapistClash(day, "th1", "10:30", 60)).toEqual({ appointmentId: "a1", guestName: "Jane", from: "10:00", to: "11:00" });
  });

  it("lets back-to-back appointments touch", () => {
    expect(therapistClash([appt({})], "th1", "11:00", 60)).toBeNull();
    expect(therapistClash([appt({})], "th1", "09:00", 60)).toBeNull();
  });

  it("counts the new treatment's own length, not only its start", () => {
    // 09:30 + 90 min runs into the 10:00 appointment even though 09:30 itself is free.
    expect(therapistClash([appt({})], "th1", "09:30", 90)).not.toBeNull();
  });

  it("ignores cancelled and no-show appointments, but a completed one still holds its slot", () => {
    expect(therapistClash([appt({ status: "CANCELLED" }), appt({ id: "a2", status: "NO_SHOW" })], "th1", "10:00", 60)).toBeNull();
    expect(therapistClash([appt({ status: "COMPLETED" })], "th1", "10:00", 60)).not.toBeNull();
  });

  it("ignores other therapists", () => {
    expect(therapistClash([appt({ therapistUserId: "th2" })], "th1", "10:00", 60)).toBeNull();
  });
});

describe("tableClash", () => {
  it("checks the same table only", () => {
    expect(tableClash([appt({})], "t1", "10:30", 30)?.guestName).toBe("Jane");
    expect(tableClash([appt({})], "t2", "10:30", 30)).toBeNull();
  });
});

describe("therapistDay", () => {
  it("lists the therapist's held slots in time order", () => {
    const day = [
      appt({ id: "x", startTime: "14:00", durationMinutes: 90 }),
      appt({}),
      appt({ id: "y", status: "CANCELLED", startTime: "12:00" }),
    ];
    expect(therapistDay(day, "th1")).toEqual([
      { from: "10:00", to: "11:00" },
      { from: "14:00", to: "15:30" },
    ]);
  });
});
