import Link from "next/link";
import { notFound } from "next/navigation";
import { backendJson } from "@/lib/backendServer";
import { BackendError } from "@/lib/backend";
import { getSessionUser, hasRoleAtLeast } from "@/lib/rbac";
import BookingStatusForm from "@/components/admin/BookingStatusForm";
import BookingRoomUnitAssign from "@/components/admin/BookingRoomUnitAssign";
import type { Booking, RoomUnit } from "@/lib/types";
import type { BookingPosOrder, Folio } from "@/lib/posTypes";

export default async function AdminBookingDetailPage({ params }: { params: { id: string } }) {
  let booking: Booking;
  try {
    booking = await backendJson<Booking>(`/bookings/${params.id}`, { auth: true });
  } catch (e) {
    if (e instanceof BackendError && e.status === 404) notFound();
    throw e;
  }

  // /bookings/{id}/pos-orders already resolves item names server-side, so
  // this section doesn't need a /menu fetch to join menuItemId -> name.
  const posOrders = await backendJson<BookingPosOrder[]>(`/bookings/${params.id}/pos-orders`, {
    auth: true,
  }).catch(() => []);

  const user = await getSessionUser();
  // PUT /bookings/{id}/room-unit is CASHIER+, but GET /room-units (the only
  // way to list which rooms exist to pick from) is MANAGER+ — a CASHIER can
  // assign/unassign but can't browse options above a manager's shoulder.
  // canAssign gates the write; canListUnits gates whether we even attempt
  // the read, so BookingRoomUnitAssign can tell "nothing to assign" apart
  // from "you're not allowed to see the list."
  const canAssign = !!user && hasRoleAtLeast(user.role, "CASHIER");
  const canListUnits = !!user && hasRoleAtLeast(user.role, "MANAGER");
  const roomUnits = canListUnits
    ? await backendJson<RoomUnit[]>(`/room-units?roomId=${booking.roomId}`, { auth: true }).catch(() => [])
    : [];
  const assignableUnits = roomUnits.filter((u) => u.isActive);

  // Read-only — this doesn't write anything back to paymentNote or the
  // booking status. It's what front desk reads off at checkout, so a failed
  // fetch has to say so explicitly rather than rendering as if there were
  // simply nothing to show (see folioFailed below) — `roomChargeCount: 0`
  // is a legitimate, successfully-loaded answer and must look different
  // from "we don't know".
  let folio: Folio | null = null;
  let folioFailed = false;
  try {
    folio = await backendJson<Folio>(`/bookings/${params.id}/folio`, { auth: true });
  } catch {
    folioFailed = true;
  }

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Reservation</p>
      <h1 className="font-display italic text-3xl mb-8">{booking.guestName}</h1>

      <div className="grid md:grid-cols-2 gap-8">
        <div className="space-y-2 text-sm">
          <p>
            <span className="text-cream/40">Room:</span> {booking.room.name}
          </p>
          <p>
            <span className="text-cream/40">Email:</span> {booking.guestEmail}
          </p>
          <p>
            <span className="text-cream/40">Phone:</span> {booking.guestPhone}
          </p>
          <p>
            <span className="text-cream/40">Check-in:</span> {booking.checkIn.slice(0, 10)}
          </p>
          <p>
            <span className="text-cream/40">Check-out:</span> {booking.checkOut.slice(0, 10)}
          </p>
          <p>
            <span className="text-cream/40">Total:</span> ฿{Number(booking.totalPrice).toLocaleString("en-US")}
          </p>
          <p>
            <span className="text-cream/40">Booked on:</span> {booking.createdAt.slice(0, 10)}
          </p>
        </div>

        <div className="space-y-6">
          <BookingRoomUnitAssign
            bookingId={booking.id}
            units={assignableUnits}
            currentRoomUnit={booking.roomUnit}
            canAssign={canAssign}
            canListUnits={canListUnits}
          />
          <BookingStatusForm
            bookingId={booking.id}
            currentStatus={booking.status}
            currentPaymentNote={booking.paymentNote}
            folio={folio}
          />
        </div>
      </div>

      {folioFailed ? (
        <div className="mt-10 pt-10 border-t border-cream/10">
          <p className="eyebrow text-cream/50 mb-3">Folio</p>
          <div className="bg-coral/10 border border-coral/30 rounded-xl p-6">
            <p className="text-coral text-sm font-medium">
              Couldn&rsquo;t load the amount due — verify the total manually (room + any POS room charges) before
              checkout.
            </p>
          </div>
        </div>
      ) : (
        folio && (
          <div className="mt-10 pt-10 border-t border-cream/10">
            <p className="eyebrow text-cream/50 mb-3">Folio</p>
            <div className="bg-ink2/40 border border-cream/10 rounded-xl p-6">
              <div className="space-y-1 text-sm text-cream/60">
                <div className="flex items-center justify-between">
                  <span>Room</span>
                  <span>฿{Number(folio.roomTotal).toLocaleString("en-US")}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Room charges ({folio.roomChargeCount})</span>
                  <span>฿{Number(folio.roomChargesTotal).toLocaleString("en-US")}</span>
                </div>
              </div>
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-cream/10">
                <span className="font-display italic text-lg text-cream">Total due</span>
                <span className="font-display italic text-4xl text-coral">
                  ฿{Number(folio.folioTotal).toLocaleString("en-US")}
                </span>
              </div>
            </div>
          </div>
        )
      )}

      {posOrders.length > 0 && (
        <div className="mt-10 pt-10 border-t border-cream/10">
          <p className="eyebrow text-cream/50 mb-3">Room charges</p>
          <div className="space-y-2">
            {posOrders.map((po) => (
              <Link
                key={po.orderId}
                href={`/admin/pos/orders/${po.orderId}`}
                className="flex items-center justify-between gap-4 bg-ink2/40 border border-cream/10 rounded-xl p-4 text-sm hover:bg-cream/5 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-cream/70 truncate">
                    {po.items.map((i) => `${i.quantity}× ${i.name}`).join(", ")}
                  </p>
                  <p className="text-xs text-cream/40">{po.paidAt.slice(0, 10)}</p>
                </div>
                <span className="text-cream shrink-0">฿{Number(po.amount).toLocaleString("en-US")}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
