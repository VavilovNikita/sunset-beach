"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import type { UserUpdateResult } from "@/lib/types";

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
  const [warning, setWarning] = useState<string | null>(null);

  async function handleToggle() {
    const next = !active;
    const confirmed = window.confirm(
      next ? "Re-enable this account? They will be able to sign in again." : "Disable this account? They will be signed out immediately."
    );
    if (!confirmed) return;

    setSaving(true);
    setError(null);
    setWarning(null);

    const result = await adminRequest<UserUpdateResult>(`/users/${userId}/active`, adminJsonInit("PATCH", { active: next }), "Could not update this account.");

    setSaving(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    // Disabling a therapist with future spa appointments still assigned to them warns rather
    // than blocks - see UserService#futureBookedAppointmentWarning on the backend.
    if (result.data.warning) setWarning(result.data.warning);
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
      {warning && <span className="block text-xs text-amber-400 mt-1">{warning}</span>}
    </span>
  );
}
