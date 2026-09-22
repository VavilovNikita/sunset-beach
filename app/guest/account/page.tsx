import { requireGuestSessionAccount } from "@/lib/guestRbac";
import { guestBackendJson } from "@/lib/guestBackendServer";
import type { GuestBooking } from "@/lib/guestSession";
import GuestChangePasswordForm from "@/components/GuestChangePasswordForm";
import GuestSignOutButton from "@/components/GuestSignOutButton";

const STATUS_LABEL: Record<GuestBooking["status"], string> = {
  NEW: "Requested",
  CONFIRMED: "Confirmed",
  PAID: "Paid",
  CANCELLED: "Cancelled",
};

export default async function GuestAccountPage() {
  const account = await requireGuestSessionAccount();
  // Computed at read time from a plain email match, not a stored link (see GET /guest/bookings's
  // own description) - this account's history is already complete the moment its email verifies,
  // no matter how many stays it covers or when they happened.
  const bookings = await guestBackendJson<GuestBooking[]>("/guest/bookings");

  return (
    <div className="min-h-screen px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="eyebrow text-sea mb-2">Guest account</p>
            <h1 className="font-display italic text-3xl">{account.name ?? account.email}</h1>
            <p className="text-sm text-cream/50 mt-1">{account.email}</p>
          </div>
          <GuestSignOutButton />
        </div>

        <section className="mb-10">
          <h2 className="eyebrow text-cream/60 mb-4">Your bookings</h2>
          {bookings.length === 0 ? (
            <p className="text-cream/50 bg-ink2/40 border border-cream/10 rounded-xl p-6">No bookings yet under this email.</p>
          ) : (
            <ul className="space-y-3">
              {bookings.map((booking) => (
                <li key={booking.id} className="bg-ink2/60 border border-cream/10 rounded-xl p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{booking.roomName}</p>
                    <p className="text-sm text-cream/50">
                      {booking.checkIn} → {booking.checkOut}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm">{STATUS_LABEL[booking.status]}</p>
                    <p className="text-sm text-cream/50">฿{booking.totalPrice}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="eyebrow text-cream/60 mb-4">Change password</h2>
          <GuestChangePasswordForm />
        </section>
      </div>
    </div>
  );
}
