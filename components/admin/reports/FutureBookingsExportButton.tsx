"use client";

import { useState } from "react";
import { downloadFutureBookingsCsv } from "@/lib/futureBookingsClient";

// GET /reports/future-bookings/export, saved as a download; a failure is said next to the button.
export default function FutureBookingsExportButton({ query }: { query: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setError(null);
    const result = await downloadFutureBookingsCsv(query);
    setBusy(false);
    if (!result.ok) setError(result.error);
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={run}
        disabled={busy}
        className="rounded-full border border-cream/20 hover:border-coral px-4 py-2 text-sm disabled:opacity-60"
      >
        {busy ? "Preparing…" : "Export CSV"}
      </button>
      {error && <span role="alert" className="text-xs text-coral">{error}</span>}
    </div>
  );
}
