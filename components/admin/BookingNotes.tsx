"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminJsonInit, adminRequest } from "@/lib/adminFetch";
import { NOTES_MAX_LENGTH, NOTES_PLACEHOLDER, notesCounter, notesError, notesPatchBody } from "@/lib/bookingNotes";
import type { Booking, BookingStatus } from "@/lib/types";

// The stay's staff notes, near the guest's details. Saved on its own through PATCH /bookings/{id} (the status form
// is separate and untouched), the error stays next to the field, and what is shown after saving is what the server
// returned. CASHIER+ edits - everyone who can open a booking can.
export default function BookingNotes({
  bookingId,
  status,
  notes,
  onSaved,
}: {
  bookingId: string;
  status: BookingStatus;
  notes: string | null | undefined;
  // The calendar panel refetches its own booking; the booking page refreshes the route.
  onSaved?: () => void;
}) {
  const router = useRouter();
  const [saved, setSaved] = useState<string | null>(notes ?? null);
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const tooLong = notesError(text);

  function startEditing() {
    setText(saved ?? "");
    setError(null);
    setEditing(true);
  }

  async function save() {
    if (tooLong) return;
    setSaving(true);
    setError(null);
    const result = await adminRequest<Booking>(`/bookings/${bookingId}`, adminJsonInit("PATCH", notesPatchBody(status, text)), "Could not save the notes.");
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setSaved(result.data.notes ?? null);
    setEditing(false);
    if (onSaved) onSaved();
    else router.refresh();
  }

  return (
    <div className="bg-ink2/40 border border-cream/10 rounded-xl p-4">
      <div className="flex items-center justify-between mb-1">
        <p className="eyebrow text-cream/60">Notes</p>
        {!editing && saved && (
          <button type="button" onClick={startEditing} className="text-xs text-sea hover:underline">
            Edit
          </button>
        )}
      </div>
      {editing ? (
        <div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={4}
            placeholder={NOTES_PLACEHOLDER}
            aria-label="Notes"
            aria-invalid={tooLong ? true : undefined}
            className={`w-full bg-ink border rounded-lg px-3 py-2 text-sm ${tooLong ? "border-coral" : "border-cream/20"}`}
          />
          <div className="flex items-center justify-between mt-1">
            <span className={`text-xs ${text.trim().length > NOTES_MAX_LENGTH ? "text-coral" : "text-cream/40"}`}>{notesCounter(text)}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setEditing(false)} disabled={saving} className="text-xs text-cream/60 hover:text-cream">
                Cancel
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving || !!tooLong}
                className="text-xs rounded-lg bg-sea text-ink px-3 py-1.5 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save notes"}
              </button>
            </div>
          </div>
          {(tooLong || error) && <p className="text-xs text-coral mt-1">{tooLong ?? error}</p>}
        </div>
      ) : saved ? (
        <p className="text-sm whitespace-pre-wrap break-words">{saved}</p>
      ) : (
        <div className="flex items-center justify-between">
          <p className="text-sm text-cream/40">No notes</p>
          <button type="button" onClick={startEditing} className="text-xs text-sea hover:underline">
            Add notes
          </button>
        </div>
      )}
    </div>
  );
}
