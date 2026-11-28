import Link from "next/link";
import { roomStillHeldDisplay } from "@/lib/roomStillHeld";
import type { RoomStillHeld } from "@/lib/types";

// One line for Today, the booking page and the property map's panel: coral past check-out, amber otherwise - the same
// two colours as the warning on an arrival into an occupied room.
export default function RoomStillHeldLine({ held, as: Tag = "p", size }: { held: RoomStillHeld; as?: "p" | "span"; size: string }) {
  const { overdue, href, linkText } = roomStillHeldDisplay(held);
  return (
    <Tag className={`${size} ${overdue ? "text-coral" : "text-amber-400"}`}>
      {held.reason} ·{" "}
      <Link href={href} className="underline underline-offset-2">
        {linkText}
      </Link>
    </Tag>
  );
}
