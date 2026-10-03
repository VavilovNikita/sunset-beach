"use client";

import { useEffect, useRef, useState } from "react";
import { searchGuests } from "@/lib/guestClient";
import VipBadge from "@/components/admin/VipBadge";
import type { Guest } from "@/lib/types";

const DEBOUNCE_MS = 300;
const MAX_RESULTS = 8;

// Search-as-you-type over existing Guest cards (GET /guests?q= - name, email or phone), for the
// new-booking form. Same debounced shape as the POS "Charge to room" search (RoomChargeSearch.tsx);
// that one searches currently-staying *bookings*, this one searches *guest cards*, so the two
// share the pattern rather than the component. Nothing is searched until something is typed - an
// empty query would list every guest, which is noise in a form. A failed search says so instead
// of looking like "no such guest".
export default function GuestSearchPicker({
  picked,
  onPick,
  onClear,
}: {
  picked: Guest | null;
  onPick: (guest: Guest) => void;
  onClear: () => void;
}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Guest[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Only the latest request may update the list - a slow early response must not overwrite a
  // newer one.
  const requestSeq = useRef(0);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setSearching(false);
      setSearchError(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      const seq = ++requestSeq.current;
      setSearching(true);
      setSearchError(null);
      const result = await searchGuests(q);
      if (seq !== requestSeq.current) return;
      setSearching(false);
      if (!result.ok) {
        setSearchError(result.error);
        return;
      }
      setResults(result.guests.slice(0, MAX_RESULTS));
    }, DEBOUNCE_MS);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  if (picked) {
    return (
      <div className="flex items-center gap-3 flex-wrap bg-ink border border-sea/40 rounded-lg px-3 py-2 text-sm">
        <span className="text-cream">
          Guest card: <span className="text-sea">{picked.name}</span>
        </span>
        <VipBadge vip={picked.vip} />
        <button type="button" onClick={onClear} className="ml-auto text-xs text-cream/50 hover:text-coral transition-colors">
          Not this guest
        </button>
      </div>
    );
  }

  const q = query.trim();
  return (
    <div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Name, email or phone of an existing guest…"
        className="w-full bg-ink border border-cream/20 rounded-lg px-3 py-2 text-sm placeholder:text-cream/30"
      />
      {searchError && <p className="text-xs text-coral mt-1">{searchError}</p>}
      {!searchError && searching && <p className="text-xs text-cream/50 mt-1">Searching…</p>}
      {!searchError && !searching && q.length >= 2 && results.length === 0 && (
        <p className="text-xs text-cream/50 mt-1">No guest card matches — fill in the details below for a new guest.</p>
      )}
      {!searching && results.length > 0 && (
        <div className="mt-1 max-h-48 overflow-y-auto border border-cream/15 rounded-lg divide-y divide-cream/10">
          {results.map((g) => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                setQuery("");
                setResults([]);
                onPick(g);
              }}
              className="w-full text-left px-3 py-2 hover:bg-cream/5 transition-colors"
            >
              <span className="text-sm text-cream">{g.name}</span>
              {g.vip && <span className="ml-2 text-xs text-amber-400">VIP</span>}
              <span className="block text-xs text-cream/50">{[g.email, g.phone].filter(Boolean).join(" · ") || "No contact details"}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
