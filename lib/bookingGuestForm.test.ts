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
      adults: "2",
      children: "1",
    });

    const body = bookingRequestBody("room-1", "2026-10-01", "2026-10-03", submitted);

    expect(body).toEqual({
      roomId: "room-1",
      checkIn: "2026-10-01",
      checkOut: "2026-10-03",
      guestName: "Ben Jones",
      guestEmail: "ben@example.com",
      guestPhone: "+66 81 234 5678",
      adults: 2,
      children: 1,
    });
    expect(body.guestName).not.toBe(defaults.guestName);
    expect(body.guestEmail).not.toBe(defaults.guestEmail);
  });

  it("sends 0 children when the field is left blank", () => {
    const body = bookingRequestBody(
      "room-1",
      "2026-10-01",
      "2026-10-03",
      form({ guestName: "Ben", guestEmail: "ben@example.com", guestPhone: "+66 81 234 5678", adults: "1", children: "" })
    );

    expect(body.adults).toBe(1);
    expect(body.children).toBe(0);
  });
});

describe("party limits", () => {
  it("adults start at 1 and never exceed the room's capacity", async () => {
    const { DEFAULT_ADULTS, clampAdults } = await import("./bookingGuestForm");
    expect(DEFAULT_ADULTS).toBe(1);
    expect(clampAdults(0, 3)).toBe(1);
    expect(clampAdults(5, 3)).toBe(3);
    expect(clampAdults(Number.NaN, 3)).toBe(1);
  });

  it("children fill only what the adults leave", async () => {
    const { clampChildren, maxChildren } = await import("./bookingGuestForm");
    expect(maxChildren(3, 2)).toBe(1);
    expect(maxChildren(2, 2)).toBe(0);
    expect(clampChildren(4, 3, 2)).toBe(1);
    expect(clampChildren(-1, 3, 1)).toBe(0);
  });
});
