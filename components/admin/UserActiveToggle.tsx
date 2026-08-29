"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_API_URL } from "@/lib/backend";
import { extractApiError } from "@/lib/apiError";

// The whole point of this control: closing access for someone who just left, without waiting on
// a password reset or a JWT to expire on its own — see JwtAuthFilter, which rejects a disabled
// user's token on their very next request regardless of remaining validity.
export default function UserActiveToggle({
  userId,
  active,
  disabled,
}: {
  userId: string;
  active: boolean;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    const next = !active;
    const confirmed = window.confirm(
      next ? "Re-enable this account? They will be able to sign in again." : "Disable this account? They will be signed out immediately."
    );
    if (!confirmed) return;

    setSaving(true);
    setError(null);

    const res = await fetch(`${ADMIN_API_URL}/users/${userId}/active`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: next }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(extractApiError(data, "Could not update this account."));
      return;
    }
    router.refresh();
  }

  return (
    <span>
      <button
        type="button"
        onClick={handleToggle}
        disabled={disabled || saving}
        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-50 ${
          active
            ? "border-cream/20 text-cream/70 hover:border-coral hover:text-coral"
            : "border-coral/50 text-coral hover:bg-coral/10"
        }`}
      >
        {saving ? "…" : active ? "Disable" : "Enable"}
      </button>
      {error && <span className="block text-xs text-coral mt-1">{error}</span>}
    </span>
  );
}
