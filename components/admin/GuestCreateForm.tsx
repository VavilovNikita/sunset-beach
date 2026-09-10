"use client";

import { useEffect, useRef, useState } from "react";
import { createGuest, searchGuests } from "@/lib/guestClient";
import type { Guest } from "@/lib/types";

const DEBOUNCE_MS = 300;

// Duplicates are much cheaper not to create than to reconcile later, and merging is out of
// scope - so this warns before creating rather than blocking or silently deduping. Two people
// genuinely share a phone number sometimes, so it's a warning naming who else already has that
// email/phone, not a rejection. Reused both for plain "New guest" creation and for creating a
// guest straight from a booking's own snapshot fields (the ADDITION's third bullet) - `initial`
// prefills and stays fully editable either way.
export default function GuestCreateForm({
  initial,
  onCreated,
  onCancel,
}: {
  initial?: { name?: string; email?: string | null; phone?: string | null };
  onCreated: (guest: Guest) => void;
  onCancel?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [phone, setPhone] = useState(initial?.phone ?? "");
  const [notes, setNotes] = useState("");
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmedEmail = email.trim();
    const trimmedPhone = phone.trim();
    if (!trimmedEmail && !trimmedPhone) {
      setDuplicateWarning(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const [byEmail, byPhone] = await Promise.all([
        trimmedEmail ? searchGuests(trimmedEmail) : Promise.resolve<{ ok: true; guests: Guest[] }>({ ok: true, guests: [] }),
        trimmedPhone ? searchGuests(trimmedPhone) : Promise.resolve<{ ok: true; guests: Guest[] }>({ ok: true, guests: [] }),
      ]);
      const candidates = [...(byEmail.ok ? byEmail.guests : []), ...(byPhone.ok ? byPhone.guests : [])];
      const match = candidates.find(
        (g) => (trimmedEmail && g.email === trimmedEmail) || (trimmedPhone && g.phone === trimmedPhone)
      );
      setDuplicateWarning(match ? `${match.name} already has this email or phone on file.` : null);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [email, phone]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    const result = await createGuest({
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      notes: notes.trim() || null,
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onCreated(result.guest);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3 bg-ink border border-cream/10 rounded-xl p-4">
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
          className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm placeholder:text-cream/30"
        />
      </div>
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm placeholder:text-cream/30"
        />
      </div>
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Phone</label>
        <input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm placeholder:text-cream/30"
        />
      </div>
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Notes</label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Staff notes — allergies, preferences, anything worth remembering"
          className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm placeholder:text-cream/30"
        />
      </div>
      {duplicateWarning && (
        <p className="text-xs text-amber-400 bg-amber-400/10 border border-amber-400/30 rounded-lg px-3 py-2">
          {duplicateWarning}
        </p>
      )}
      {error && <p className="text-xs text-coral">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={submitting || !name.trim()}
          className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-60"
        >
          {submitting ? "Creating…" : "Create guest"}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-cream/50 hover:text-cream transition-colors">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}
