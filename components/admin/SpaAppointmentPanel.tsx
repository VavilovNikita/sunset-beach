"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateSpaAppointmentStatus } from "@/lib/spaClient";
import { billSpaAppointment } from "@/lib/spaOrderClient";
import type { SpaAppointment, SpaAppointmentStatus } from "@/lib/posTypes";

// Side panel for one appointment clicked on the grid - same shell as BookingCardPanel.tsx (no
// dimming backdrop, so the grid stays visible while working this appointment; click-outside
// closes). Only BOOKED offers status actions - CANCELLED/NO_SHOW/COMPLETED are end states (see
// SpaAppointmentStatus's own backend description).
//
// The billing door lives here too, not on the grid cell itself - reception is already looking at
// this panel to work the appointment, and it's the one place that knows whether an order is
// already linked. BOOKED or COMPLETED with no orderId offers "Bill this treatment" (opens one via
// lib/spaOrderClient.ts, sending spaAppointmentId explicitly); any status with an orderId offers
// a link to reach it. Not offered for CANCELLED/NO_SHOW with no order - nothing to bill.
export default function SpaAppointmentPanel({
  appointment,
  onClose,
  onUpdated,
}: {
  appointment: SpaAppointment;
  onClose: () => void;
  onUpdated: () => void;
}) {
  const router = useRouter();
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [billing, setBilling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function setStatus(status: SpaAppointmentStatus, reason?: string) {
    setSaving(true);
    setError(null);
    const result = await updateSpaAppointmentStatus(appointment.id, { status, cancelReason: reason });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onUpdated();
  }

  async function handleBill() {
    setBilling(true);
    setError(null);
    const result = await billSpaAppointment(appointment);
    setBilling(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push(`/admin/pos/orders/${result.orderId}`);
  }

  const isBooked = appointment.status === "BOOKED";
  const canBill = appointment.status === "BOOKED" || appointment.status === "COMPLETED";

  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      <div className="absolute inset-0 pointer-events-auto" onClick={onClose} />
      <div
        className="absolute top-0 right-0 bottom-0 w-full sm:w-[400px] bg-ink2 border-l border-cream/15 shadow-2xl pointer-events-auto overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-cream/10 flex items-center justify-between sticky top-0 bg-ink2 z-10">
          <p className="eyebrow text-sea">{appointment.status}</p>
          <button onClick={onClose} className="text-cream/50 hover:text-cream transition-colors text-xl leading-none">
            ×
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <h2 className="font-display italic text-2xl mb-1">{appointment.guestName}</h2>
            <p className="text-sm text-cream/60">{appointment.treatmentName}</p>
          </div>

          <div className="space-y-1 text-sm">
            <p>
              <span className="text-cream/40">Table:</span> {appointment.tableLabel}
            </p>
            <p>
              <span className="text-cream/40">Time:</span> {appointment.date} · {appointment.startTime} ({appointment.durationMinutes} min)
            </p>
            <p>
              <span className="text-cream/40">Therapist:</span> {appointment.therapistEmail}
            </p>
          </div>

          {appointment.orderId ? (
            <Link
              href={`/admin/pos/orders/${appointment.orderId}`}
              className="inline-block text-sm text-sea hover:text-coral transition-colors underline underline-offset-4"
            >
              Open order →
            </Link>
          ) : (
            canBill && (
              <div className="space-y-2">
                {appointment.status === "COMPLETED" && (
                  <p className="text-sm text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded-lg px-3 py-2">
                    Not yet charged — no POS order has been linked to this appointment.
                  </p>
                )}
                <button
                  type="button"
                  onClick={handleBill}
                  disabled={billing}
                  className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-4 py-2 text-sm font-medium disabled:opacity-50"
                >
                  {billing ? "Opening…" : "Bill this treatment"}
                </button>
              </div>
            )
          )}

          {appointment.status === "CANCELLED" && appointment.cancelReason && (
            <p className="text-sm text-cream/60">
              <span className="text-cream/40">Cancel reason:</span> {appointment.cancelReason}
            </p>
          )}

          {error && <p className="text-sm text-coral">{error}</p>}

          {isBooked && !showCancelForm && (
            <div className="flex flex-wrap gap-2 pt-2 border-t border-cream/10">
              <button
                type="button"
                onClick={() => setStatus("COMPLETED")}
                disabled={saving}
                className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {saving ? "…" : "Complete"}
              </button>
              <button
                type="button"
                onClick={() => setStatus("NO_SHOW")}
                disabled={saving}
                className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                No-show
              </button>
              <button
                type="button"
                onClick={() => setShowCancelForm(true)}
                disabled={saving}
                className="rounded-full border border-coral/50 text-coral hover:bg-coral/10 transition-colors px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          )}

          {isBooked && showCancelForm && (
            <div className="space-y-2 pt-2 border-t border-cream/10">
              <label className="eyebrow text-cream/60 block">Cancel reason (optional)</label>
              <textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                className="w-full bg-ink border border-cream/20 rounded-lg px-3 py-2 text-sm resize-none"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setStatus("CANCELLED", cancelReason || undefined)}
                  disabled={saving}
                  className="flex-1 rounded-full bg-coral hover:bg-coraldeep transition-colors py-2 text-sm font-medium disabled:opacity-50"
                >
                  {saving ? "…" : "Confirm cancel"}
                </button>
                <button
                  type="button"
                  onClick={() => setShowCancelForm(false)}
                  className="flex-1 rounded-full border border-cream/25 hover:border-cream/50 transition-colors py-2 text-sm font-medium"
                >
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
