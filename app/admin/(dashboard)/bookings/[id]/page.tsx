import Link from "next/link";
import { notFound } from "next/navigation";
import { backendJson } from "@/lib/backendServer";
import { BackendError } from "@/lib/backend";
import { requireRoleAtLeast, hasRoleAtLeast } from "@/lib/rbac";
import BookingStatusForm from "@/components/admin/BookingStatusForm";
import BookingScheduleForm from "@/components/admin/BookingScheduleForm";
import FolioPaymentPanel from "@/components/admin/FolioPaymentPanel";
import type { AuditLogPage, Booking, RoomUnit } from "@/lib/types";
import type { BookingPosOrder, Folio, FolioPayment } from "@/lib/posTypes";

export default async function AdminBookingDetailPage({ params }: { params: { id: string } }) {
  // GET /bookings/{id} is CASHIER+ on the backend — guard the whole page
  // rather than let a WAITER's fetch below throw an uncaught 403.
  const user = await requireRoleAtLeast("CASHIER", "/admin/pos");

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

  // PATCH /bookings/{id}/schedule is CASHIER+, but GET /room-units (the only
  // way to list which rooms exist to pick from) is MANAGER+ — a CASHIER can
  // change dates/assign/unassign but can't browse options above a manager's
  // shoulder. canEditSchedule gates the write; canListUnits gates whether we
  // even attempt the read, so BookingScheduleForm can tell "nothing to
  // assign" apart from "you're not allowed to see the list."
  const canEditSchedule = !!user && hasRoleAtLeast(user.role, "CASHIER");
  const canListUnits = !!user && hasRoleAtLeast(user.role, "MANAGER");
  const roomUnits = canListUnits
    ? await backendJson<RoomUnit[]>(`/room-units?roomId=${booking.roomId}`, { auth: true }).catch(() => [])
    : [];
  const assignableUnits = roomUnits.filter((u) => u.isActive);

  // GET /audit-log is MANAGER+, same gate as GET /room-units above (canListUnits) - reused here
  // rather than a second identically-scoped check.
  const auditLog = canListUnits
    ? await backendJson<AuditLogPage>(`/audit-log?entityType=BOOKING&entityId=${booking.id}&pageSize=50`, { auth: true }).catch(
        () => null
      )
    : null;

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

  // Only fetched when the folio itself loaded - without a known roomChargesTotal there's no safe
  // "amount owed" to cap a new payment at, so FolioPaymentPanel isn't rendered either way.
  const folioPayments = folio
    ? await backendJson<FolioPayment[]>(`/bookings/${params.id}/folio-payments`, { auth: true }).catch(() => [])
    : [];

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
            <span className="text-cream/40">Total:</span> ฿{Number(booking.totalPrice).toLocaleString("en-US")}
          </p>
          <p>
            <span className="text-cream/40">Booked on:</span> {booking.createdAt.slice(0, 10)}
          </p>
        </div>

        <div className="space-y-6">
          <BookingScheduleForm
            booking={booking}
            units={assignableUnits}
            canEdit={canEditSchedule}
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
              <FolioPaymentPanel bookingId={booking.id} outstanding={folio.roomChargesTotal} payments={folioPayments} />
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

      {auditLog && (
        <div className="mt-10 pt-10 border-t border-cream/10">
          <p className="eyebrow text-cream/50 mb-3">History</p>
          {auditLog.items.length === 0 ? (
            <p className="text-sm text-cream/40">No recorded actions on this booking yet.</p>
          ) : (
            <div className="space-y-2">
              {auditLog.items.map((entry) => (
                <div key={entry.id} className="bg-ink2/40 border border-cream/10 rounded-xl p-4 text-sm">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <span className="text-cream/70">{entry.summary}</span>
                    <span className="text-xs text-cream/40 shrink-0">
                      {entry.createdAt.slice(0, 19).replace("T", " ")} UTC
                    </span>
                  </div>
                  <p className="text-xs text-cream/40 mt-2">
                    {entry.actorEmail} ({entry.actorRole})
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
