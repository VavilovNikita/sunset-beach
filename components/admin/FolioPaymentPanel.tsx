"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { recordFolioPayment } from "@/lib/folioPaymentClient";
import type { FolioPayment, FolioPaymentMethod } from "@/lib/posTypes";

const METHODS: FolioPaymentMethod[] = ["CASH", "CARD", "OTHER"];

// Settles a booking's outstanding POS room charges — the only way roomChargesTotal (and the
// checkout warning / RoomChargeDebtBadge that read it) ever goes back down. See
// lib/folioPaymentClient.ts and openapi.yaml's /bookings/{id}/folio-payments for why this is a
// standalone record rather than folded into the PAID status flip: a guest can settle the room
// charges without the room stay being PAID yet, or vice versa, and they're tracked separately on
// purpose. This page already gates on CASHIER+ before rendering at all, so there's no additional
// role check here.
export default function FolioPaymentPanel({
  bookingId,
  outstanding,
  payments,
}: {
  bookingId: string;
  outstanding: string;
  payments: FolioPayment[];
}) {
  const router = useRouter();
  const owed = Number(outstanding);
  const [amount, setAmount] = useState(outstanding);
  const [method, setMethod] = useState<FolioPaymentMethod>("CASH");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    const result = await recordFolioPayment(bookingId, { method, amount });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="mt-4 space-y-3">
      {payments.length > 0 && (
        <div className="space-y-1">
          {payments.map((p) => (
            <div key={p.id} className="flex items-center justify-between text-xs text-cream/50">
              <span>
                {p.method} · {p.createdAt.slice(0, 10)}
              </span>
              <span>฿{Number(p.amount).toLocaleString("en-US")}</span>
            </div>
          ))}
        </div>
      )}

      {owed > 0 && (
        <form onSubmit={handleSubmit} className="flex items-end gap-2 flex-wrap">
          <div>
            <label className="eyebrow text-cream/50 block mb-1 text-[0.65rem]">Amount collected</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              max={outstanding}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="w-28 bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="eyebrow text-cream/50 block mb-1 text-[0.65rem]">Method</label>
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as FolioPaymentMethod)}
              className="bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm"
            >
              {METHODS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={saving}
            className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-60"
          >
            {saving ? "Recording…" : "Record payment"}
          </button>
        </form>
      )}
      {error && <p className="text-sm text-coral">{error}</p>}
    </div>
  );
}
