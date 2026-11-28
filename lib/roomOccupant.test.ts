import { describe, expect, it } from "vitest";
import { roomOccupantWarning } from "./roomOccupant";

describe("roomOccupantWarning", () => {
  it("names the overstaying guest and the room", () => {
    expect(roomOccupantWarning({ guestName: "Late Leaver", overdueDays: 3 }, "T-202")).toBe(
      "Room T-202 is occupied: Late Leaver is still checked in, past check-out. Check them out or move this arrival to another room first."
    );
  });

  it("says a guest due out today is not overdue", () => {
    expect(roomOccupantWarning({ guestName: "Due Out", overdueDays: 0 }, "101")).toContain("Due Out is due out today and still checked in");
  });

  it("asks for the new room, not a check-out, when the guest is only waiting for it", () => {
    const text = roomOccupantWarning({ guestName: "Mover", overdueDays: 0, awaitingRoom: true }, "101");
    expect(text).toContain("new room isn't chosen yet");
    expect(text).not.toContain("Check them out");
  });

  it("works without a room label", () => {
    expect(roomOccupantWarning({ guestName: "A", overdueDays: 1 }, null)).toMatch(/^The room is occupied/);
  });
});
