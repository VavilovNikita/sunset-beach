"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_API_URL } from "@/lib/backend";
import { extractApiError } from "@/lib/apiError";
import type { Folio } from "@/lib/posTypes";

const STATUSES = ["NEW", "CONFIRMED", "PAID", "CANCELLED"] as const;

export default function BookingStatusForm({
  bookingId,
  currentStatus,
  currentPaymentNote,
  folio,
}: {
  bookingId: string;
  currentStatus: string;
  currentPaymentNote: string | null;
  // Purely informational — nothing here writes to paymentNote or blocks
  // saving. null covers both "no POS orders" and "folio failed to load";
  // either way there's nothing safe to warn about, so no banner.
  folio: Folio | null;
}) {
  const router = useRouter();
  const [status, setStatus] = useState(currentStatus);
  const [paymentNote, setPaymentNote] = useState(currentPaymentNote ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    const res = await fetch(`${ADMIN_API_URL}/bookings/${bookingId}`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, paymentNote: paymentNote || null }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(extractApiError(data, "Could not update booking."));
      return;
    }
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md bg-ink2/40 border border-cream/10 rounded-xl p-5">
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Status</label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
        >
          {STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </div>

      {status === "PAID" && folio && folio.roomChargeCount > 0 && (
        <p className="text-sm text-coral bg-coral/10 border border-coral/30 rounded-lg px-3 py-2">
          This booking has {folio.roomChargeCount} POS room charge{folio.roomChargeCount === 1 ? "" : "s"} totaling ฿
          {Number(folio.roomChargesTotal).toLocaleString("en-US")}. Total due including the room is ฿
          {Number(folio.folioTotal).toLocaleString("en-US")} — make sure that&rsquo;s what was collected, not just
          the room total.
        </p>
      )}

      <div>
        <label className="eyebrow text-cream/60 block mb-1">Payment note</label>
        <textarea
          rows={3}
          value={paymentNote}
          onChange={(e) => setPaymentNote(e.target.value)}
          placeholder="e.g. terminal receipt #4471 — never enter the guest's card number"
          className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm placeholder:text-cream/30 focus:outline-none focus:border-coral resize-none"
        />
      </div>

      {error && <p className="text-sm text-coral">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-6 py-2.5 text-sm font-medium disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
