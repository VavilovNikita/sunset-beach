import { describe, expect, it } from "vitest";
import { bookingRequestBody, guestFormDefaults } from "./bookingGuestForm";

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.set(key, value);
  return data;
}

describe("guestFormDefaults", () => {
  it("prefills name and email for a logged-in guest", () => {
    expect(guestFormDefaults({ name: "Anna Smith", email: "anna@example.com" })).toEqual({
      guestName: "Anna Smith",
      guestEmail: "anna@example.com",
    });
  });

  it("never produces a phone default — a guest account has no phone", () => {
    expect(Object.keys(guestFormDefaults({ name: "Anna", email: "anna@example.com" }))).not.toContain("guestPhone");
  });

  it("falls back to an empty name when the account has none", () => {
    expect(guestFormDefaults({ name: null, email: "anna@example.com" })).toEqual({
      guestName: "",
      guestEmail: "anna@example.com",
    });
  });

  it("leaves everything empty for an anonymous visitor", () => {
    expect(guestFormDefaults(null)).toEqual({ guestName: "", guestEmail: "" });
    expect(guestFormDefaults(undefined)).toEqual({ guestName: "", guestEmail: "" });
  });
});

describe("bookingRequestBody", () => {
  it("sends what the guest typed over the prefill, not the account's values", () => {
    const defaults = guestFormDefaults({ name: "Anna Smith", email: "anna@example.com" });
    const submitted = form({
      guestName: "Ben Jones",
      guestEmail: "ben@example.com",
      guestPhone: "+66 81 234 5678",
    });

    const body = bookingRequestBody("room-1", "2026-10-01", "2026-10-03", submitted);

    expect(body).toEqual({
      roomId: "room-1",
      checkIn: "2026-10-01",
      checkOut: "2026-10-03",
      guestName: "Ben Jones",
      guestEmail: "ben@example.com",
      guestPhone: "+66 81 234 5678",
    });
    expect(body.guestName).not.toBe(defaults.guestName);
    expect(body.guestEmail).not.toBe(defaults.guestEmail);
  });
});
