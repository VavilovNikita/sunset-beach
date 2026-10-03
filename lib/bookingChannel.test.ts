import { describe, expect, it } from "vitest";
import { BOOKING_CHANNELS, bookingOriginNote } from "@/lib/bookingChannel";

describe("bookingOriginNote", () => {
  it("says a booking came in through SiteMinder, with the OTA name and reference", () => {
    expect(bookingOriginNote({ externalReference: "SM-12345", externalChannel: "Booking.com" })).toBe(
      "via SiteMinder (Booking.com), ref SM-12345"
    );
  });

  it("is null for a booking that didn't come from SiteMinder", () => {
    expect(bookingOriginNote({ externalReference: null, externalChannel: null })).toBeNull();
  });
});

describe("BOOKING_CHANNELS", () => {
  it("never offers SiteMinder as a channel staff can pick", () => {
    expect(BOOKING_CHANNELS.map((c) => c.toUpperCase())).not.toContain("SITEMINDER");
  });
});
