import { describe, expect, it } from "vitest";
import { isChargeableBookingStatus } from "./roomCharge";

// The bug this guards: a booking moved to PAID (prepaid stay, routine at a resort) used to drop
// out of the "charge to room" search entirely, even though the guest was still physically
// staying - see RoomChargeLink.tsx / bookingSearchClient.ts for where this is applied.
describe("isChargeableBookingStatus", () => {
  it("allows a prepaid, currently-staying booking (PAID)", () => {
    expect(isChargeableBookingStatus("PAID")).toBe(true);
  });

  it("allows a confirmed, currently-staying booking (CONFIRMED)", () => {
    expect(isChargeableBookingStatus("CONFIRMED")).toBe(true);
  });

  it("rejects an unconfirmed inquiry, not yet a guest (NEW)", () => {
    expect(isChargeableBookingStatus("NEW")).toBe(false);
  });

  it("rejects a cancelled booking (CANCELLED)", () => {
    expect(isChargeableBookingStatus("CANCELLED")).toBe(false);
  });
});
