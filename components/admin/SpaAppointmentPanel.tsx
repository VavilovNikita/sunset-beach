"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addSpaAppointmentTreatment, removeSpaAppointmentTreatment, updateSpaAppointmentStatus } from "@/lib/spaClient";
import { billSpaAppointment } from "@/lib/spaOrderClient";
import { sumTreatmentPrices } from "@/lib/spaTreatmentPricing";
import type { MenuItem, SpaAppointment, SpaAppointmentStatus } from "@/lib/posTypes";

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
//
// Creating the order and adding its treatment line are two separate writes that can't be made
// atomic from here - see billSpaAppointment's own comment. Once the order is created the
// appointment is linked (orderId set), whether or not the line made it on, so `billedOrderId`
// below is set the moment creation succeeds - not only on full success - so this panel switches
// straight to the "Open order" link and can never re-fire handleBill into creating a second order
// for the same appointment while waiting on the parent to refetch.
//
// `current` holds the appointment as of the latest write this panel itself made (treatment add/
// remove, billing) - same overlay reasoning as `billedOrderId`: the grid only reflects a write
// once router.refresh() resolves and the parent re-renders, and this panel doesn't get remounted
// in between (the appointment id is unchanged, just its contents), so it keeps its own view up to
// date locally rather than showing stale treatments/warnings for a moment.
export default function SpaAppointmentPanel({
  appointment,
  treatments: availableTreatments,
  onClose,
  onUpdated,
}: {
  appointment: SpaAppointment;
  treatments: MenuItem[];
  onClose: () => void;
  onUpdated: () => void;
}) {
  const router = useRouter();
  const [current, setCurrent] = useState(appointment);
  const [cancelReason, setCancelReason] = useState("");
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [billing, setBilling] = useState(false);
  const [billedOrderId, setBilledOrderId] = useState<string | null>(null);
  const [billError, setBillError] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [addTreatmentId, setAddTreatmentId] = useState(availableTreatments[0]?.id ?? "");
  const [addingTreatment, setAddingTreatment] = useState(false);
  const [addTreatmentError, setAddTreatmentError] = useState<string | null>(null);
  const [removingTreatmentId, setRemovingTreatmentId] = useState<string | null>(null);
  const [removeTreatmentError, setRemoveTreatmentError] = useState<string | null>(null);

  async function setStatus(status: SpaAppointmentStatus, reason?: string) {
    setSaving(true);
    setError(null);
    const result = await updateSpaAppointmentStatus(current.id, { status, cancelReason: reason });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onUpdated();
  }

  async function handleBill() {
    setBilling(true);
    setBillError(null);
    const result = await billSpaAppointment(current);
    setBilling(false);
    if (!result.ok) {
      setBillError(result.error);
      return;
    }
    setBilledOrderId(result.orderId);
    // Refresh the underlying schedule now, not only on close (onUpdated, below, also closes the
    // panel - too soon to fire here). billedOrderId already covers the gap until this lands, but
    // the appointment prop itself needs the real orderId too: closing this panel without
    // navigating and reopening the same appointment would otherwise mount a fresh instance with
    // no local state and a still-stale `appointment.orderId: null`, offering "Bill this treatment"
    // again for an appointment that's already linked.
    router.refresh();
    if (!result.itemAdded) {
      // Loud, not silent: the order is real and linked (see class comment), but the ⚠ this
      // mechanism exists to raise would otherwise go quiet on an order that never actually billed
      // anything. Stay on the panel rather than auto-redirecting, so this is the moment reception
      // reads it, not a message that flashes past on the way to the next page.
      const treatmentNames = current.treatments.map((t) => t.treatmentName).join(", ");
      setBillError(`Order opened, but "${treatmentNames}" couldn't be added automatically — open the order and add it by hand.`);
      return;
    }
    router.push(`/admin/pos/orders/${result.orderId}`);
  }

  async function handleAddTreatment(e: React.FormEvent) {
    e.preventDefault();
    if (!addTreatmentId) return;
    setAddingTreatment(true);
    setAddTreatmentError(null);
    const result = await addSpaAppointmentTreatment(current.id, { treatmentMenuItemId: addTreatmentId });
    setAddingTreatment(false);
    if (!result.ok) {
      setAddTreatmentError(result.error);
      return;
    }
    setCurrent(result.appointment);
    router.refresh();
  }

  async function handleRemoveTreatment(treatmentId: string) {
    setRemovingTreatmentId(treatmentId);
    setRemoveTreatmentError(null);
    const result = await removeSpaAppointmentTreatment(current.id, treatmentId);
    setRemovingTreatmentId(null);
    if (!result.ok) {
      setRemoveTreatmentError(result.error);
      return;
    }
    setCurrent(result.appointment);
    router.refresh();
  }

  const isBooked = current.status === "BOOKED";
  const isCompleted = current.status === "COMPLETED";
  const canBill = current.status === "BOOKED" || current.status === "COMPLETED";
  const orderId = current.orderId ?? billedOrderId;
  // Growing is only offered while BOOKED (a COMPLETED appointment is a record of what happened,
  // not a plan still being negotiated - see the backend CLAUDE.md's Naming section); shrinking
  // (below) stays available through COMPLETED too, to correct an over-count, since it can never
  // collide with anything.
  const canAddTreatment = isBooked;
  const canRemoveTreatment = isBooked || isCompleted;
  const totalCurrentPrice = sumTreatmentPrices(current.treatments.map((t) => t.currentPrice));

  return (
    <div className="fixed inset-0 z-40 pointer-events-none">
      <div className="absolute inset-0 pointer-events-auto" onClick={onClose} />
      <div
        className="absolute top-0 right-0 bottom-0 w-full sm:w-[400px] bg-ink2 border-l border-cream/15 shadow-2xl pointer-events-auto overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5 border-b border-cream/10 flex items-center justify-between sticky top-0 bg-ink2 z-10">
          <p className="eyebrow text-sea">{current.status}</p>
          <button onClick={onClose} className="text-cream/50 hover:text-cream transition-colors text-xl leading-none">
            ×
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <h2 className="font-display italic text-2xl mb-1">{current.guestName}</h2>
          </div>

          <div className="space-y-1 text-sm">
            <p>
              <span className="text-cream/40">Table:</span> {current.tableLabel}
            </p>
            <p>
              <span className="text-cream/40">Time:</span> {current.date} · {current.startTime} ({current.durationMinutes} min)
            </p>
            <p>
              <span className="text-cream/40">Therapist:</span> {current.therapistEmail}
            </p>
          </div>

          <div className="space-y-2 pt-2 border-t border-cream/10">
            <p className="eyebrow text-cream/60">Treatments</p>
            <ul className="space-y-1.5">
              {current.treatments.map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 text-sm">
                  <span>
                    {t.treatmentName} <span className="text-cream/40">({t.durationMinutes} min)</span>
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-cream/60">฿{Number(t.currentPrice).toLocaleString("en-US")}</span>
                    {canRemoveTreatment && current.treatments.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveTreatment(t.id)}
                        disabled={removingTreatmentId === t.id}
                        className="text-coral/70 hover:text-coral transition-colors text-xs disabled:opacity-50"
                        aria-label={`Remove ${t.treatmentName}`}
                      >
                        {removingTreatmentId === t.id ? "…" : "Remove"}
                      </button>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            {/* A live sum of already-known server prices, for reception's own reference - never
                the number that's actually charged (that's computed fresh, live, when a treatment
                is billed - see lib/spaTreatmentPricing.ts's own comment). */}
            <p className="text-sm text-cream/60 pt-1">
              Estimated total: ฿{totalCurrentPrice.toLocaleString("en-US")}
            </p>
            {removeTreatmentError && <p className="text-sm text-coral">{removeTreatmentError}</p>}

            {canAddTreatment && availableTreatments.length > 0 && (
              <form onSubmit={handleAddTreatment} className="flex gap-2 pt-1">
                <select
                  value={addTreatmentId}
                  onChange={(e) => setAddTreatmentId(e.target.value)}
                  className="flex-1 bg-ink border border-cream/20 rounded-lg px-2 py-1.5 text-sm"
                >
                  {availableTreatments.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.durationMinutes} min) — ฿{Number(t.price).toLocaleString("en-US")}
                    </option>
                  ))}
                </select>
                <button
                  type="submit"
                  disabled={addingTreatment}
                  className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-3 py-1.5 text-xs font-medium disabled:opacity-60 shrink-0"
                >
                  {addingTreatment ? "Adding…" : "Add"}
                </button>
              </form>
            )}
            {addTreatmentError && <p className="text-sm text-coral">{addTreatmentError}</p>}
          </div>

          {orderId ? (
            <div className="space-y-2">
              <Link
                href={`/admin/pos/orders/${orderId}`}
                className="inline-block text-sm text-sea hover:text-coral transition-colors underline underline-offset-4"
              >
                Open order →
              </Link>
              {billError && <p className="text-sm text-coral">{billError}</p>}
            </div>
          ) : (
            canBill && (
              <div className="space-y-2">
                {current.status === "COMPLETED" && (
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
                {billError && <p className="text-sm text-coral">{billError}</p>}
              </div>
            )
          )}

          {current.status === "COMPLETED" && orderId && current.missingTreatmentNames.length > 0 && (
            <p className="text-sm text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded-lg px-3 py-2">
              Linked order doesn&apos;t carry: {current.missingTreatmentNames.join(", ")}.
            </p>
          )}

          {current.status === "CANCELLED" && current.cancelReason && (
            <p className="text-sm text-cream/60">
              <span className="text-cream/40">Cancel reason:</span> {current.cancelReason}
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
