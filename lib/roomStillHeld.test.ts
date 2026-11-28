import { describe, expect, it } from "vitest";
import { roomStillHeldDisplay } from "./roomStillHeld";

describe("roomStillHeldDisplay", () => {
  it("marks a guest past check-out and links to their booking", () => {
    expect(roomStillHeldDisplay({ bookingId: "b1", state: "PAST_CHECK_OUT" })).toEqual({
      overdue: true,
      href: "/admin/bookings/b1",
      linkText: "Open their booking",
    });
  });

  it("does not call a guest due out today overdue", () => {
    expect(roomStillHeldDisplay({ bookingId: "b1", state: "DUE_OUT_TODAY" })).toEqual({
      overdue: false,
      href: "/admin/bookings/b1",
      linkText: "Open their booking",
    });
  });

  it("sends a waiting guest to the room picker", () => {
    expect(roomStillHeldDisplay({ bookingId: "b1", state: "AWAITING_ROOM" })).toEqual({
      overdue: false,
      href: "/admin/bookings/b1#choose-room",
      linkText: "Choose their room",
    });
  });
});
