import { describe, expect, it } from "vitest";
import { prefillFromGuest, validateStaffBookingForm, type StaffBookingFormFields } from "@/lib/staffBookingForm";

const valid: StaffBookingFormFields = {
  guestName: "Anna Smith",
  guestEmail: "",
  guestPhone: "",
  checkIn: "2026-10-05",
  checkOut: "2026-10-07",
  channel: "WALK_IN",
  adults: "2",
  children: "0",
};

describe("validateStaffBookingForm", () => {
  it("accepts a complete walk-in with no contact details", () => {
    expect(validateStaffBookingForm(valid)).toEqual({});
  });

  it("requires a channel, in English, on the channel field", () => {
    expect(validateStaffBookingForm({ ...valid, channel: "" })).toEqual({ channel: "Choose how this booking came in." });
  });

  it("puts each problem on its own field", () => {
    const errors = validateStaffBookingForm({
      ...valid,
      guestName: " A ",
      guestEmail: "anna-at-example",
      guestPhone: "123",
      adults: "",
    });
    expect(Object.keys(errors).sort()).toEqual(["adults", "guestEmail", "guestName", "guestPhone"]);
  });

  it("rejects a check-out on or before check-in", () => {
    expect(validateStaffBookingForm({ ...valid, checkOut: "2026-10-05" }).checkOut).toBe("Check-out must be after check-in.");
  });

  it("asks for a date that's missing rather than comparing it", () => {
    expect(validateStaffBookingForm({ ...valid, checkIn: "" })).toEqual({ checkIn: "Choose a check-in date." });
  });

  it("files a bad children count under children, not adults", () => {
    expect(validateStaffBookingForm({ ...valid, children: "-1" })).toEqual({ children: "Children must be 0 or more." });
  });
});

describe("prefillFromGuest", () => {
  it("copies the card's contact details into the booking snapshot, blank for what it lacks", () => {
    expect(prefillFromGuest({ name: "Anna Smith", email: "anna@example.com", phone: null })).toEqual({
      guestName: "Anna Smith",
      guestEmail: "anna@example.com",
      guestPhone: "",
    });
  });
});
