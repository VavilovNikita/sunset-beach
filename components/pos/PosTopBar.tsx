"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { Role } from "@/lib/session";

const ROLE_LABELS: Record<Role, string> = { WAITER: "Waiter", CASHIER: "Cashier", MANAGER: "Manager", ADMIN: "Admin" };

// Always visible, on every /pos screen — this is the actual fix for a shared floor device
// mis-attributing history to whoever happened to be logged in last (see the "shared device"
// decision this section was built around): a persistent "who am I" plus a one-tap way to stop
// being that person is what makes "sign out before handing the phone over" a habit instead of
// friction nobody bothers with. Not a PIN gate on payments - that would need the backend to know
// who's acting versus who's logged in, which it doesn't (every write is attributed to the JWT
// holder alone), so the fix has to be at the login boundary itself, made cheap to cross often.
export default function PosTopBar({ email, role }: { email: string; role: Role }) {
  const router = useRouter();
  const pathname = usePathname();
  const [switching, setSwitching] = useState(false);
  const onBoard = pathname === "/pos";

  async function handleSwitchUser() {
    setSwitching(true);
    try {
      await fetch("/api/session/logout", { method: "POST" });
    } catch {
      // Even if the request itself failed (offline), still send the user to the login screen -
      // staying "logged in" on a floor device because a logout call didn't round-trip is the
      // wrong failure mode here.
    }
    router.push("/admin/login?callbackUrl=/pos");
    router.refresh();
  }

  return (
    // Identity gets its own full-width line, never sharing horizontal space with the switch
    // button - on a narrow/older phone (checked down to 320px) a side-by-side layout squeezed a
    // longer email down to a handful of characters before an ellipsis, which defeats the whole
    // point of showing it. Stacked, the email only ever wraps if it's implausibly long for a
    // phone this narrow, and the button stays a fixed, predictable tap target underneath.
    //
    // The way back to the board is a real 44px button in that same bottom row, not a line of
    // small text stacked above the email - it's the main way out of every screen, and a text line
    // of its own only made this sticky bar taller. The role moves to the email line to make room.
    <div className="sticky top-0 z-40 bg-ink2 border-b border-cream/10 px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
      <p className="text-base text-cream font-medium break-words leading-snug">
        {email}
        <span className="eyebrow text-sea text-[0.7rem] ml-2 whitespace-nowrap">{ROLE_LABELS[role]}</span>
      </p>
      <div className="flex items-center justify-between gap-3 mt-2">
        {!onBoard ? (
          <Link
            href="/pos"
            className="shrink-0 min-h-11 inline-flex items-center rounded-full border border-cream/25 active:border-cream/50 transition-colors px-4 text-sm font-medium"
          >
            ← Table board
          </Link>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={handleSwitchUser}
          disabled={switching}
          className="shrink-0 min-h-11 rounded-full border border-cream/25 active:border-cream/50 transition-colors px-4 text-sm font-medium disabled:opacity-60"
        >
          {switching ? "…" : "Not you? Switch"}
        </button>
      </div>
    </div>
  );
}
