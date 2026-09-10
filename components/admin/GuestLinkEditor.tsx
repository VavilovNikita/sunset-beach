"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { searchGuests } from "@/lib/guestClient";
import { assignBookingGuest } from "@/lib/bookingGuestClient";
import GuestCreateForm from "@/components/admin/GuestCreateForm";
import type { Booking, Guest } from "@/lib/types";

const DEBOUNCE_MS = 300;

function dedupeById(guests: Guest[]): Guest[] {
  const seen = new Set<string>();
  const result: Guest[] = [];
  for (const g of guests) {
    if (!seen.has(g.id)) {
      seen.add(g.id);
      result.push(g);
    }
  }
  return result;
}

// Linking must not require retyping what the booking already knows. Opening this seeds the
// search from the booking's own guestName/guestEmail/guestPhone snapshot, with results already
// on screen - reception sees candidates without typing anything. A guest whose email or phone
// exactly matches the booking's is offered as a single confirming action (never linked
// automatically - a contact match is good evidence, not proof, and this is a person's history).
// Nothing matching offers creating a guest from the booking's own details in one action,
// prefilled and editable. Relinking to a different guest needs no confirmation and no state
// check - nothing downstream depends on which Guest a booking points to.
export default function GuestLinkEditor({ booking, onSaved }: { booking: Booking; onSaved: (booking: Booking) => void }) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="flex items-center gap-3 flex-wrap">
        {booking.guest ? (
          <>
            <span className="text-sm text-cream">
              Linked to{" "}
              <Link href={`/admin/guests/${booking.guest.id}`} className="text-sea hover:text-coral transition-colors">
                {booking.guest.name}
              </Link>
            </span>
            <button type="button" onClick={() => setOpen(true)} className="text-xs text-sea hover:text-coral transition-colors">
              Change
            </button>
            <UnlinkButton booking={booking} onSaved={onSaved} />
          </>
        ) : (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-xs text-sea hover:text-coral transition-colors underline underline-offset-4"
          >
            Link guest
          </button>
        )}
      </div>
    );
  }

  function handlePicked(b: Booking) {
    setOpen(false);
    onSaved(b);
  }

  return <GuestPicker booking={booking} onSaved={handlePicked} onCancel={() => setOpen(false)} />;
}

function UnlinkButton({ booking, onSaved }: { booking: Booking; onSaved: (booking: Booking) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUnlink() {
    setBusy(true);
    setError(null);
    const result = await assignBookingGuest(booking.id, null);
    setBusy(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onSaved(result.booking);
  }

  return (
    <span>
      <button
        type="button"
        onClick={handleUnlink}
        disabled={busy}
        className="text-xs text-cream/50 hover:text-coral transition-colors disabled:opacity-60"
      >
        {busy ? "…" : "Unlink"}
      </button>
      {error && <span className="text-xs text-coral ml-2">{error}</span>}
    </span>
  );
}

function GuestPicker({
  booking,
  onSaved,
  onCancel,
}: {
  booking: Booking;
  onSaved: (booking: Booking) => void;
  onCancel: () => void;
}) {
  const [query, setQuery] = useState(booking.guestName);
  const [nameResults, setNameResults] = useState<Guest[]>([]);
  const [contactMatches, setContactMatches] = useState<Guest[]>([]);
  const [searching, setSearching] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Seeded automatically on mount (query already holds the booking's own guestName) and again
  // on every edit to the search box - the debounce covers both, so results are on screen the
  // instant this opens without a separate "run once" effect.
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      setSearchError(null);
      const result = await searchGuests(query);
      setSearching(false);
      if (!result.ok) {
        setSearchError(result.error);
        return;
      }
      setNameResults(result.guests);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // Independent of the editable search box above - always checked against the booking's own
  // fixed email/phone snapshot, so typing something else into the search box never hides or
  // changes this evidence-based match.
  useEffect(() => {
    let cancelled = false;
    async function checkContactMatch() {
      const probes = [booking.guestEmail, booking.guestPhone].filter((v) => v && v.trim());
      if (probes.length === 0) {
        setContactMatches([]);
        return;
      }
      const results = await Promise.all(probes.map((p) => searchGuests(p)));
      if (cancelled) return;
      const candidates = dedupeById(results.flatMap((r) => (r.ok ? r.guests : [])));
      const matches = candidates.filter(
        (g) =>
          (booking.guestEmail && g.email === booking.guestEmail) || (booking.guestPhone && g.phone === booking.guestPhone)
      );
      setContactMatches(matches);
    }
    checkContactMatch();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const exactMatch = contactMatches.length === 1 ? contactMatches[0] : null;
  const visibleResults = dedupeById(nameResults).filter((g) => g.id !== exactMatch?.id);
  const noMatches = !searching && !exactMatch && visibleResults.length === 0;

  async function handleLink(guestId: string) {
    setLinkingId(guestId);
    setLinkError(null);
    const result = await assignBookingGuest(booking.id, guestId);
    setLinkingId(null);
    if (!result.ok) {
      setLinkError(result.error);
      return;
    }
    onSaved(result.booking);
  }

  async function handleCreatedAndLink(guest: Guest) {
    await handleLink(guest.id);
  }

  return (
    <div className="bg-ink border border-cream/10 rounded-xl p-4 space-y-3">
      <p className="eyebrow text-cream/50">Link guest</p>

      {creating ? (
        <GuestCreateForm
          initial={{ name: booking.guestName, email: booking.guestEmail || null, phone: booking.guestPhone || null }}
          onCreated={handleCreatedAndLink}
          onCancel={() => setCreating(false)}
        />
      ) : (
        <>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Name, email, or phone…"
            autoFocus
            className="w-full bg-ink2 border border-cream/20 rounded-lg px-3 py-2 text-sm placeholder:text-cream/30 focus:outline-none focus:border-coral"
          />

          {exactMatch && (
            <div className="bg-coral/10 border border-coral/30 rounded-lg p-3 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-coral/80 mb-0.5">Matches this booking&rsquo;s email or phone</p>
                <p className="text-cream text-sm truncate">{exactMatch.name}</p>
              </div>
              <button
                type="button"
                onClick={() => handleLink(exactMatch.id)}
                disabled={linkingId === exactMatch.id}
                className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-4 py-1.5 text-xs font-medium disabled:opacity-60 shrink-0"
              >
                {linkingId === exactMatch.id ? "Linking…" : `Link ${exactMatch.name}`}
              </button>
            </div>
          )}

          {searchError && <p className="text-xs text-coral">{searchError}</p>}
          {!searchError && searching && <p className="text-xs text-cream/50">Searching…</p>}

          {!searching && visibleResults.length > 0 && (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {visibleResults.map((g) => (
                <div
                  key={g.id}
                  className="flex items-center justify-between gap-3 bg-ink2 border border-cream/10 rounded-lg px-3 py-2"
                >
                  <div className="min-w-0">
                    <p className="text-cream text-sm truncate">{g.name}</p>
                    <p className="text-cream/50 text-xs truncate">{g.email || g.phone || ""}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleLink(g.id)}
                    disabled={linkingId === g.id}
                    className="rounded-full border border-cream/25 hover:border-cream/50 transition-colors px-3 py-1.5 text-xs font-medium disabled:opacity-40 shrink-0"
                  >
                    {linkingId === g.id ? "Linking…" : "Link"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {noMatches && (
            <div className="space-y-2">
              <p className="text-xs text-cream/40">No matching guests.</p>
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="text-xs text-sea hover:text-coral transition-colors underline underline-offset-4"
              >
                Create guest from this booking&rsquo;s details
              </button>
            </div>
          )}

          {linkError && <p className="text-xs text-coral">{linkError}</p>}
        </>
      )}

      {!creating && (
        <button type="button" onClick={onCancel} className="text-xs text-cream/50 hover:text-cream transition-colors">
          Cancel
        </button>
      )}
    </div>
  );
}
