"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { searchGuests } from "@/lib/guestClient";
import GuestCreateForm from "@/components/admin/GuestCreateForm";
import type { Guest } from "@/lib/types";

const DEBOUNCE_MS = 300;

// Standalone guest search screen - GET /guests?q= is a case-insensitive substring match against
// name/email/phone, one field matching is enough. initialGuests (every guest, q omitted) is what
// renders before anyone types anything, matching the backend's own "empty q means everything"
// precedent (GET /bookings?guestName= behaves the same way).
export default function GuestsListView({ initialGuests }: { initialGuests: Guest[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [guests, setGuests] = useState(initialGuests);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
      setGuests(result.guests);
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  function handleCreated(guest: Guest) {
    setCreating(false);
    router.push(`/admin/guests/${guest.id}`);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, email, or phone…"
          className="flex-1 min-w-[240px] bg-ink2 border border-cream/20 rounded-xl px-4 py-3 text-sm placeholder:text-cream/30 focus:outline-none focus:border-coral"
        />
        {!creating && (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2.5 text-sm font-medium shrink-0"
          >
            New guest
          </button>
        )}
      </div>

      {creating && <GuestCreateForm onCreated={handleCreated} onCancel={() => setCreating(false)} />}

      {searchError && <p className="text-sm text-coral">{searchError}</p>}
      {!searchError && searching && <p className="text-sm text-cream/50">Searching…</p>}
      {!searchError && !searching && guests.length === 0 && <p className="text-sm text-cream/40">No guests match.</p>}

      {!searching && guests.length > 0 && (
        <div className="space-y-2">
          {guests.map((g) => (
            <Link
              key={g.id}
              href={`/admin/guests/${g.id}`}
              className="flex items-center justify-between gap-4 bg-ink2/40 border border-cream/10 rounded-xl p-4 text-sm hover:bg-cream/5 transition-colors"
            >
              <span className="text-cream font-medium truncate">{g.name}</span>
              <span className="text-cream/50 text-xs shrink-0">{g.email || g.phone || ""}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
