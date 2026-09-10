"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateGuest, deleteGuest } from "@/lib/guestClient";
import type { GuestDetail } from "@/lib/types";

// The guest card: contact details plus this guest's entire stay history (every booking with
// this guestId, any status - cancelled included, see GuestDetail's own description). Each
// booking already shows its own totalPrice/status; deliberately no lifetime-spend/stay-count
// total here.
export default function GuestCard({ guest }: { guest: GuestDetail }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  function handleSaved() {
    setEditing(false);
    router.refresh();
  }

  return (
    <div className="space-y-8">
      <div className="bg-ink2/40 border border-cream/10 rounded-xl p-5">
        <div className="flex items-center justify-between gap-3 mb-3">
          <p className="eyebrow text-cream/60">Contact details</p>
          {!editing && (
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className="text-sm text-sea hover:text-coral transition-colors"
              >
                Edit
              </button>
              <DeleteGuestButton guestId={guest.id} guestName={guest.name} />
            </div>
          )}
        </div>

        {!editing ? (
          <div className="space-y-1 text-sm">
            <p className="text-cream">{guest.email || "No email on file"}</p>
            <p className="text-cream">{guest.phone || "No phone on file"}</p>
            {guest.notes && <p className="text-cream/60 whitespace-pre-wrap mt-2">{guest.notes}</p>}
          </div>
        ) : (
          <GuestEditForm guest={guest} onSaved={handleSaved} onCancel={() => setEditing(false)} />
        )}
      </div>

      <div>
        <p className="eyebrow text-sea mb-3">
          Stay history <span className="text-cream/40">({guest.bookings.length})</span>
        </p>
        {guest.bookings.length === 0 ? (
          <p className="text-sm text-cream/40">No bookings linked to this guest yet.</p>
        ) : (
          <div className="space-y-2">
            {guest.bookings.map((b) => (
              <Link
                key={b.id}
                href={`/admin/bookings/${b.id}`}
                className="flex items-center justify-between gap-4 bg-ink2/40 border border-cream/10 rounded-xl p-4 text-sm hover:bg-cream/5 transition-colors"
              >
                <div className="min-w-0">
                  <p className="text-cream truncate">
                    {b.room.name} — {b.checkIn} → {b.checkOut}
                  </p>
                  <p className="text-xs text-cream/40">{b.status}</p>
                </div>
                <span className="text-cream shrink-0">฿{Number(b.totalPrice).toLocaleString("en-US")}</span>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function GuestEditForm({
  guest,
  onSaved,
  onCancel,
}: {
  guest: GuestDetail;
  onSaved: () => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(guest.name);
  const [email, setEmail] = useState(guest.email ?? "");
  const [phone, setPhone] = useState(guest.phone ?? "");
  const [notes, setNotes] = useState(guest.notes ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    setError(null);
    const result = await updateGuest(guest.id, {
      name: name.trim(),
      email: email.trim() || null,
      phone: phone.trim() || null,
      notes: notes.trim() || null,
    });
    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          className="w-full bg-ink border border-cream/20 rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-ink border border-cream/20 rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Phone</label>
        <input
          type="text"
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full bg-ink border border-cream/20 rounded-lg px-3 py-2 text-sm"
        />
      </div>
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Notes</label>
        <textarea
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="w-full bg-ink border border-cream/20 rounded-lg px-3 py-2 text-sm"
        />
      </div>
      {error && <p className="text-xs text-coral">{error}</p>}
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
        <button type="button" onClick={onCancel} className="text-sm text-cream/50 hover:text-cream transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}

// Blocked server-side (409) while any booking, past or future, still references this guest -
// see GuestService#delete's own comment for why past stays count too. The 409's message already
// says so; this just surfaces it rather than pre-checking client-side.
function DeleteGuestButton({ guestId, guestName }: { guestId: string; guestName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm(`Delete ${guestName}? This can't be undone.`)) return;
    setBusy(true);
    setError(null);
    const result = await deleteGuest(guestId);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.push("/admin/guests");
  }

  return (
    <div className="text-right">
      <button
        type="button"
        onClick={handleDelete}
        disabled={busy}
        className="text-sm text-coral hover:text-coraldeep transition-colors disabled:opacity-60"
      >
        {busy ? "Deleting…" : "Delete"}
      </button>
      {error && <p className="text-xs text-coral mt-1 max-w-xs">{error}</p>}
    </div>
  );
}
