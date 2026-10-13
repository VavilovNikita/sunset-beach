import { describe, expect, it } from "vitest";
import {
  automationSummary,
  buildSlots,
  clampGuestDate,
  durationOptions,
  guestDateBounds,
  hallSettingsProblem,
  hotelNow,
  isSlotBookableByStaff,
  maxDurationAt,
  shiftDate,
  slotIndexOf,
  spanOf,
  usedMinutes,
  visibleDays,
  weekDays,
} from "@/lib/gymSchedule";
import type { GymAutomationDeviceResult, GymAutomationPhase, GymReservation } from "@/lib/types";

function reservation(over: Partial<GymReservation> & Pick<GymReservation, "id" | "date" | "startTime" | "endTime">): GymReservation {
  const durationMinutes =
    (Number(over.endTime.slice(0, 2)) * 60 + Number(over.endTime.slice(3))) - (Number(over.startTime.slice(0, 2)) * 60 + Number(over.startTime.slice(3)));
  return {
    bookingId: "b1",
    guestName: "Guest",
    durationMinutes,
    status: "BOOKED",
    createdByType: "STAFF",
    createdByName: "Desk",
    automation: {},
    createdAt: "2031-06-14T00:00:00Z",
    ...over,
  };
}

function result(deviceName: string, status: GymAutomationDeviceResult["status"], extra: Partial<GymAutomationDeviceResult> = {}): GymAutomationDeviceResult {
  return { deviceName, status, attempts: 1, ...extra };
}

function phase(state: GymAutomationPhase["state"], results: GymAutomationDeviceResult[]): GymAutomationPhase {
  return { state, results };
}

describe("grid", () => {
  it("one column per slot from opening up to the last slot that fits before closing", () => {
    expect(buildSlots("06:00", "08:00", 30)).toEqual(["06:00", "06:30", "07:00", "07:30"]);
    expect(buildSlots("21:00", "22:00", 30)).toEqual(["21:00", "21:30"]);
  });

  it("places a reservation by its start and spans whole slots", () => {
    expect(slotIndexOf("07:30", "06:00", 30)).toBe(3);
    expect(spanOf(90, 30)).toBe(3);
    expect(spanOf(45, 30)).toBe(2);
  });
});

describe("the hotel's clock and weeks", () => {
  it("reads the hotel's date and time, not UTC's", () => {
    // 18:30 UTC on the 14th is 01:30 on the 15th in Bangkok.
    expect(hotelNow(new Date("2031-06-14T18:30:00Z"))).toEqual({ date: "2031-06-15", time: "01:30" });
  });

  it("a week runs Monday to Sunday and contains the date, whatever the weekday", () => {
    // 2031-06-15 is a Sunday.
    expect(weekDays("2031-06-15")).toEqual(["2031-06-09", "2031-06-10", "2031-06-11", "2031-06-12", "2031-06-13", "2031-06-14", "2031-06-15"]);
    expect(weekDays("2031-06-09")[0]).toBe("2031-06-09");
    expect(weekDays("2031-06-11")[6]).toBe("2031-06-15");
  });

  it("the day view shows one day and steps by a day, the week view steps by a week", () => {
    expect(visibleDays("2031-06-11", "day")).toEqual(["2031-06-11"]);
    expect(visibleDays("2031-06-11", "week")).toHaveLength(7);
    expect(shiftDate("2031-06-11", "day", 1)).toBe("2031-06-12");
    expect(shiftDate("2031-06-11", "week", -1)).toBe("2031-06-04");
  });

  it("staff may take the half hour that is running, not one that has ended", () => {
    const now = new Date("2031-06-15T03:10:00Z"); // 10:10 in Bangkok
    expect(isSlotBookableByStaff("2031-06-15", "10:00", 30, now)).toBe(true);
    expect(isSlotBookableByStaff("2031-06-15", "09:30", 30, now)).toBe(false);
    expect(isSlotBookableByStaff("2031-06-16", "06:00", 30, now)).toBe(true);
    expect(isSlotBookableByStaff("2031-06-14", "21:30", 30, now)).toBe(false);
  });
});

describe("how long a session can run", () => {
  const base = { date: "2031-06-16", closeTime: "22:00", step: 30, maxDuration: 120, maxDaily: 120 };

  it("is capped at 120 minutes on an empty day", () => {
    expect(maxDurationAt({ ...base, reservations: [], start: "10:00" })).toBe(120);
  });

  it("is cut short by closing time", () => {
    expect(maxDurationAt({ ...base, reservations: [], start: "21:00" })).toBe(60);
    expect(maxDurationAt({ ...base, reservations: [], start: "21:30" })).toBe(30);
  });

  it("is cut short by the next reservation, and is 0 on a taken slot", () => {
    const reservations = [reservation({ id: "r1", date: "2031-06-16", startTime: "11:00", endTime: "12:00" })];
    expect(maxDurationAt({ ...base, reservations, start: "10:00" })).toBe(60);
    expect(maxDurationAt({ ...base, reservations, start: "10:30" })).toBe(30);
    expect(maxDurationAt({ ...base, reservations, start: "11:00" })).toBe(0);
    expect(maxDurationAt({ ...base, reservations, start: "11:30" })).toBe(0);
    expect(maxDurationAt({ ...base, reservations, start: "12:00" })).toBe(120);
  });

  it("ignores cancelled reservations and the one being moved", () => {
    const cancelled = reservation({ id: "r1", date: "2031-06-16", startTime: "11:00", endTime: "12:00", status: "CANCELLED" });
    const moving = reservation({ id: "r2", date: "2031-06-16", startTime: "11:00", endTime: "12:00" });
    expect(maxDurationAt({ ...base, reservations: [cancelled], start: "10:00" })).toBe(120);
    expect(maxDurationAt({ ...base, reservations: [moving], start: "10:00", exceptId: "r2" })).toBe(120);
  });

  it("is cut short by what is left of the booking's 120 minutes that day", () => {
    const reservations = [
      reservation({ id: "r1", date: "2031-06-16", startTime: "08:00", endTime: "09:30", bookingId: "b1" }),
      reservation({ id: "r2", date: "2031-06-16", startTime: "16:00", endTime: "17:00", bookingId: "b2" }),
    ];
    expect(usedMinutes(reservations, "b1", "2031-06-16")).toBe(90);
    expect(maxDurationAt({ ...base, reservations, start: "12:00", bookingId: "b1" })).toBe(30);
    // Another booking has its own allowance, and a free hour before the 16:00 session.
    expect(maxDurationAt({ ...base, reservations, start: "12:00", bookingId: "b3" })).toBe(120);
    expect(maxDurationAt({ ...base, reservations, start: "15:00", bookingId: "b3" })).toBe(60);
  });

  it("offers the durations in steps", () => {
    expect(durationOptions(90, 30)).toEqual([30, 60, 90]);
    expect(durationOptions(0, 30)).toEqual([]);
  });
});

describe("automationSummary", () => {
  it("says the equipment is not switched on yet before the automation reaches the reservation", () => {
    const s = automationSummary({ status: "BOOKED", automation: {} });
    expect(s.tone).toBe("neutral");
    expect(s.label).toMatch(/not switched on yet/i);
  });

  it("all devices on: ok", () => {
    const s = automationSummary({ status: "BOOKED", automation: { switchOn: phase("OK", [result("Fan 1", "OK"), result("Air 1", "OK")]) } });
    expect(s).toEqual({ tone: "ok", label: "Equipment on", problems: [] });
  });

  it("some devices failed: partial, naming the devices that failed and why", () => {
    const s = automationSummary({
      status: "BOOKED",
      automation: { switchOn: phase("PARTIAL", [result("Fan 1", "OK"), result("Fan 2", "FAILED", { error: "Tuya is not responding" })]) },
    });
    expect(s.tone).toBe("warn");
    expect(s.label).toBe("Partly on — failed: Fan 2");
    expect(s.problems).toEqual(["Fan 2 — Tuya is not responding"]);
  });

  it("nothing went on: error", () => {
    const s = automationSummary({ status: "BOOKED", automation: { switchOn: phase("FAILED", [result("Fan 1", "FAILED", { error: "x" })]) } });
    expect(s.tone).toBe("bad");
  });

  it("a device still being retried is pending and is listed", () => {
    const s = automationSummary({
      status: "BOOKED",
      automation: { switchOn: phase("PENDING", [result("Fan 1", "OK"), result("Fan 2", "PENDING", { error: "Tuya is not responding" })]) },
    });
    expect(s.tone).toBe("pending");
    expect(s.problems).toEqual(["Fan 2 — Tuya is not responding (will retry)"]);
  });

  it("after the session: switched off is done, a failed switch-off is an error, a kept-on one is said so", () => {
    const on = phase("OK", [result("Fan 1", "OK")]);
    expect(automationSummary({ status: "COMPLETED", automation: { switchOn: on, switchOff: phase("OK", [result("Fan 1", "OK")]) } })).toMatchObject({
      tone: "ok",
      label: "Equipment off — done",
    });
    expect(automationSummary({ status: "COMPLETED", automation: { switchOn: on, switchOff: phase("FAILED", [result("Fan 1", "FAILED", { error: "x" })]) } }).tone).toBe("bad");
    expect(
      automationSummary({
        status: "COMPLETED",
        automation: { switchOn: on, switchOff: phase("SKIPPED", [result("Fan 1", "SKIPPED", { skipReason: "NEXT_BOOKING_SOON" })]) },
      }).label
    ).toBe("Left on for the next session");
  });

  it("a switch-on that was missed because the session was already over is a warning", () => {
    const s = automationSummary({
      status: "COMPLETED",
      automation: { switchOn: phase("SKIPPED", [result("Fan 1", "SKIPPED", { skipReason: "MISSED" })]) },
    });
    expect(s.tone).toBe("warn");
  });

  it("an earlier problem is not hidden by a later success", () => {
    const s = automationSummary({
      status: "COMPLETED",
      automation: {
        switchOn: phase("PARTIAL", [result("Fan 1", "OK"), result("Fan 2", "FAILED", { error: "x" })]),
        switchOff: phase("OK", [result("Fan 1", "OK"), result("Fan 2", "OK")]),
      },
    });
    expect(s.tone).toBe("warn");
    expect(s.problems).toHaveLength(1);
  });
});

describe("hallSettingsProblem", () => {
  const ok = { openTime: "06:00", closeTime: "22:00", leadMinutes: 30, acMode: 0, acTemp: 16, acWind: 3 };

  it("accepts the owner's defaults", () => {
    expect(hallSettingsProblem(ok)).toBeNull();
  });

  it("refuses hours that are off the grid, reversed or not times", () => {
    expect(hallSettingsProblem({ ...ok, openTime: "06:15" })).toMatch(/grid/);
    expect(hallSettingsProblem({ ...ok, openTime: "22:00", closeTime: "06:00" })).toMatch(/open before/);
    expect(hallSettingsProblem({ ...ok, closeTime: "" })).toMatch(/like 06:00/);
  });

  it("refuses a lead time or air-conditioner value outside the server's ranges", () => {
    expect(hallSettingsProblem({ ...ok, leadMinutes: 181 })).toMatch(/lead/i);
    expect(hallSettingsProblem({ ...ok, leadMinutes: -1 })).toMatch(/lead/i);
    expect(hallSettingsProblem({ ...ok, acTemp: 15 })).toMatch(/temperature/);
    expect(hallSettingsProblem({ ...ok, acTemp: 31 })).toMatch(/temperature/);
    expect(hallSettingsProblem({ ...ok, acMode: 5 })).toMatch(/mode/);
    expect(hallSettingsProblem({ ...ok, acWind: 4 })).toMatch(/fan/);
  });
});

describe("a guest's dates", () => {
  const stay = { checkIn: "2031-06-14", checkOut: "2031-06-18" };

  it("run from today to the departure day, and never before check-in", () => {
    expect(guestDateBounds(stay, "2031-06-16")).toEqual({ min: "2031-06-16", max: "2031-06-18" });
    expect(guestDateBounds(stay, "2031-06-10")).toEqual({ min: "2031-06-14", max: "2031-06-18" });
    expect(guestDateBounds(stay, "2031-06-18")).toEqual({ min: "2031-06-18", max: "2031-06-18" });
  });

  it("are empty once the stay is over", () => {
    expect(guestDateBounds(stay, "2031-06-19")).toBeNull();
  });

  it("clamp a value outside them to the nearest day", () => {
    const bounds = { min: "2031-06-16", max: "2031-06-18" };
    expect(clampGuestDate("2031-06-01", bounds)).toBe("2031-06-16");
    expect(clampGuestDate("2031-07-01", bounds)).toBe("2031-06-18");
    expect(clampGuestDate("2031-06-17", bounds)).toBe("2031-06-17");
  });
});
