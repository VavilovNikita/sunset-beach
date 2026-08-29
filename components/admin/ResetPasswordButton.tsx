"use client";

import { useState } from "react";
import { ADMIN_API_URL } from "@/lib/backend";
import { extractApiError } from "@/lib/apiError";

// Admin-forced reset for when the current password can't be trusted (lost device, suspected
// compromise) or as the other half of closing access for someone who just left, alongside
// UserActiveToggle — no current-password check, unlike the self-service form on /admin/account.
export default function ResetPasswordButton({ userId }: { userId: string }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    const newPassword = window.prompt("New password for this user (at least 8 characters):");
    if (!newPassword) return;

    setSaving(true);
    setError(null);
    setMessage(null);

    const res = await fetch(`${ADMIN_API_URL}/users/${userId}/password`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newPassword }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(extractApiError(data, "Could not reset this user's password."));
      return;
    }
    setMessage("Password reset — they'll need to sign in again.");
  }

  return (
    <span>
      <button
        type="button"
        onClick={handleReset}
        disabled={saving}
        className="text-xs text-cream/70 hover:text-coral transition-colors disabled:opacity-50"
      >
        {saving ? "…" : "Reset password"}
      </button>
      {message && <span className="block text-xs text-sea mt-1">{message}</span>}
      {error && <span className="block text-xs text-coral mt-1">{error}</span>}
    </span>
  );
}
