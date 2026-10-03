"use client";

import { useState } from "react";
import { closeNightAudit } from "@/lib/nightAuditClient";
import { formatClosedAt } from "@/lib/nightAudit";
import type { NightAuditClosure } from "@/lib/types";
import { formatDate } from "@/lib/formatDate";

// "Close day" for the date on screen only - there is deliberately no close-any-date action.
// Closing records that someone reviewed the day; it blocks and locks nothing, and it doesn't need
// the missed lists to be empty. Once a closure exists (loaded or just made) the form is replaced
// by who closed it and when.
export default function NightAuditCloseForm({ date, initialClosure }: { date: string; initialClosure: NightAuditClosure | null }) {
  const [closure, setClosure] = useState<NightAuditClosure | null>(initialClosure);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (closure) {
    return (
      <div className="bg-ink2/40 border border-cream/10 rounded-xl p-5">
        <p className="eyebrow text-cream/50 mb-1">Closed</p>
        <p className="text-sm text-cream">
          Closed by <span className="font-medium">{closure.closedByName}</span> at {formatClosedAt(closure.closedAt)}
        </p>
        {closure.notes && <p className="text-sm text-cream/60 mt-2 whitespace-pre-wrap">{closure.notes}</p>}
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const result = await closeNightAudit({ date, notes: notes.trim() || null });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setClosure(result.closure);
  }

  return (
    <form onSubmit={handleSubmit} className="bg-ink2/40 border border-cream/10 rounded-xl p-5 space-y-3">
      <p className="eyebrow text-cream/50">Close day</p>
      <p className="text-xs text-cream/40">
        Records that you reviewed {formatDate(date)}. It doesn&apos;t change or lock anything, and unresolved items above can still be
        handled afterwards.
      </p>
      <textarea
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        maxLength={2000}
        rows={3}
        placeholder="Notes (optional)"
        className="w-full bg-ink border border-cream/20 rounded-lg px-3 py-2 text-sm placeholder:text-cream/30"
      />
      {error && <p className="text-xs text-coral">{error}</p>}
      <button
        type="submit"
        disabled={saving}
        className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-60"
      >
        {saving ? "Closing…" : "Close day"}
      </button>
    </form>
  );
}
