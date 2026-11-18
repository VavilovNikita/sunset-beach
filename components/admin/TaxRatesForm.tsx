"use client";

import { useState } from "react";
import { adminJsonInit, adminRequest } from "@/lib/adminFetch";
import { parseRate, rateChanged } from "@/lib/taxRates";
import { formatTimestamp } from "@/lib/formatDate";
import { useSavedNotice } from "@/lib/useSavedNotice";
import type { ServiceChargeSettings, VatSettings } from "@/lib/types";

// The two percentages the booking tracker takes out of room prices. One card each, saved on its own (each is its own
// PUT); what is shown after a save is the server's own two-decimal figure.
export default function TaxRatesForm({ vat, serviceCharge }: { vat: VatSettings; serviceCharge: ServiceChargeSettings }) {
  return (
    <div className="space-y-4">
      <RateCard
        title="Service charge"
        description="Included in every room price. The booking tracker takes it out of the price to show the package before service charge. It is for that analysis only - nothing is charged to a guest."
        path="/settings/service-charge"
        field="serviceChargeRate"
        initial={serviceCharge.serviceChargeRate}
        updatedAt={serviceCharge.updatedAt}
      />
      <RateCard
        title="VAT"
        description="Included in every price. Used by the revenue statistic (Z410) and by the booking tracker, to take VAT out of a price - never to add it."
        path="/settings/vat"
        field="vatRate"
        initial={vat.vatRate}
        updatedAt={vat.updatedAt}
      />
    </div>
  );
}

function RateCard({
  title,
  description,
  path,
  field,
  initial,
  updatedAt,
}: {
  title: string;
  description: string;
  path: string;
  field: "serviceChargeRate" | "vatRate";
  initial: string;
  updatedAt: string;
}) {
  const [saved, setSaved] = useState(initial);
  const [savedAt, setSavedAt] = useState(updatedAt);
  const [typed, setTyped] = useState(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, showNotice, clearNotice] = useSavedNotice();

  async function save(e: React.FormEvent) {
    e.preventDefault();
    const parsed = parseRate(typed, title);
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }
    setSaving(true);
    setError(null);
    clearNotice();
    const result = await adminRequest<Record<string, string>>(path, adminJsonInit("PUT", { [field]: parsed.rate }), `Could not save the ${title.toLowerCase()} rate.`);
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(result.data[field]);
    setTyped(result.data[field]);
    setSavedAt(result.data.updatedAt);
    showNotice("Saved.");
  }

  return (
    <form onSubmit={save} noValidate className="rounded-xl border border-cream/10 bg-ink2/40 p-5 space-y-3">
      <div>
        <h2 className="font-display italic text-xl">{title}</h2>
        <p className="text-xs text-cream/50 mt-1">{description}</p>
      </div>
      <div className="flex items-end gap-3">
        <div>
          <label className="eyebrow text-cream/60 block mb-1" htmlFor={`rate-${field}`}>
            Rate, percent
          </label>
          <input
            id={`rate-${field}`}
            inputMode="decimal"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            className="w-28 bg-ink border border-cream/20 rounded-lg px-3 py-2 text-sm"
          />
        </div>
        <button
          type="submit"
          disabled={saving || !rateChanged(saved, typed)}
          className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        {notice && <span role="status" className="text-xs text-cream/70">✓ {notice}</span>}
      </div>
      <p className="text-xs text-cream/40">Now {saved}%. Last saved {formatTimestamp(savedAt)}.</p>
      {error && <p role="alert" className="text-xs text-coral">{error}</p>}
    </form>
  );
}
