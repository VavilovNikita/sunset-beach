import Link from "next/link";
import { requireGuestSessionAccount } from "@/lib/guestRbac";
import { guestBackendJson } from "@/lib/guestBackendServer";
import type { GuestBooking } from "@/lib/guestSession";
import GuestRoomServiceClient from "@/components/GuestRoomServiceClient";

// Room-service ordering, gated on physically being at the hotel right now - see
// GuestRoomServiceClient's own comment for the full picture. Bookings are filtered to
// occupancyStatus === "CHECKED_IN" here, server-side, purely so the screen doesn't even offer a
// room that can't order - the actual gate is re-checked by the backend on every write regardless.
export default async function GuestRoomServicePage() {
  await requireGuestSessionAccount();
  const bookings = await guestBackendJson<GuestBooking[]>("/guest/bookings");
  const checkedIn = bookings.filter((b) => b.occupancyStatus === "CHECKED_IN");

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="max-w-lg mx-auto">
        <Link href="/guest/account" className="text-sm text-cream/50 hover:text-cream/80 transition-colors">
          ← Your account
        </Link>
        <p className="eyebrow text-sea mb-2 mt-6">Sunset Beach</p>
        <h1 className="font-display italic text-3xl mb-8">Room service</h1>

        <GuestRoomServiceClient bookings={checkedIn} />
      </div>
    </div>
  );
}
