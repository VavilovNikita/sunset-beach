// An arrival whose room still has another guest checked into it (TodayBoardEntry.roomOccupant). Who is in the room is
// the server's answer, and it refuses the check-in (409) - this only words the warning the desk reads first. Pure,
// tested in roomOccupant.test.ts.
import type { RoomOccupant } from "@/lib/types";

export function roomOccupantWarning(
  occupant: Pick<RoomOccupant, "guestName" | "overdueDays" | "awaitingRoom">,
  roomLabel: string | null
): string {
  const room = roomLabel ? `Room ${roomLabel}` : "The room";
  if (occupant.awaitingRoom && occupant.overdueDays === 0) {
    return `${room} is occupied: ${occupant.guestName} is still checked in and their new room isn't chosen yet. Choose it first, or move this arrival to another room.`;
  }
  const state = occupant.overdueDays > 0 ? "is still checked in, past check-out" : "is due out today and still checked in";
  return `${room} is occupied: ${occupant.guestName} ${state}. Check them out or move this arrival to another room first.`;
}
