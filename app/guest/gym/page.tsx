import Link from "next/link";
import { requireGuestSessionAccount } from "@/lib/guestRbac";
import { guestBackendJson } from "@/lib/guestBackendServer";
import GuestGymClient from "@/components/GuestGymClient";
import type { GymGuestInfo, GymGuestReservation } from "@/lib/types";

export const metadata = { title: "Gym booking — The Sunset Beach Resort & Spa" };

// The gym, booked from the guest's own account. Eligibility (a CHECKED_IN booking of this account)
// and every slot rule are the server's; this page only shows what it says - see GuestGymClient.
export default async function GuestGymPage() {
  await requireGuestSessionAccount();
  const [info, reservations] = await Promise.all([
    guestBackendJson<GymGuestInfo>("/guest/gym/info"),
    guestBackendJson<GymGuestReservation[]>("/guest/gym/reservations"),
  ]);

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="max-w-lg mx-auto">
        <Link href="/guest/account" className="inline-flex items-center min-h-[44px] text-sm text-cream/50 hover:text-cream/80 transition-colors">
          ← Your account
        </Link>
        <p className="eyebrow text-sea mb-2 mt-4">Sunset Beach</p>
        <h1 className="font-display italic text-3xl mb-2">Gym</h1>
        <p className="text-sm text-cream/60 mb-8">
          The gym is for one guest at a time. Book a time during your stay — free of charge. The fans and air conditioning are switched on for you
          shortly before your session.
        </p>

        <GuestGymClient info={info} initialReservations={reservations} />
      </div>
    </div>
  );
}
