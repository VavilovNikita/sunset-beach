"use client";

import { useState } from "react";
import { ADMIN_API_URL } from "@/lib/backend";
import { extractApiError } from "@/lib/apiError";
import ConfirmActionDialog from "@/components/admin/ConfirmActionDialog";

// Admin-forced reset for when the current password can't be trusted (lost device, suspected
// compromise) or as the other half of closing access for someone who just left, alongside
// UserActiveToggle — no current-password check, unlike the self-service form on /admin/account.
export default function ResetPasswordButton({ userId }: { userId: string }) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [asking, setAsking] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  async function handleReset(): Promise<string | null> {
    if (newPassword.length < 8) return "The password needs at least 8 characters.";

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
      return extractApiError(data, "Could not reset this user's password.");
    }
    setMessage("Password reset — they'll need to sign in again.");
    return null;
  }

  function close() {
    setAsking(false);
    setNewPassword("");
  }

  return (
    <span>
      <button
        type="button"
        onClick={() => setAsking(true)}
        disabled={saving}
        className="text-xs text-cream/70 hover:text-coral transition-colors disabled:opacity-50"
      >
        {saving ? "…" : "Reset password"}
      </button>
      {asking && (
        <ConfirmActionDialog
          eyebrow="Account"
          title="Set a new password for this user"
          confirmLabel="Reset password"
          busyLabel="Saving…"
          action={handleReset}
          onDone={close}
          onBack={close}
        >
          <label className="block text-sm text-cream/70">
            New password (at least 8 characters)
            <input
              type="password"
              autoFocus
              autoComplete="new-password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-1 w-full rounded-lg bg-ink border border-cream/20 px-3 py-2 text-cream"
            />
          </label>
        </ConfirmActionDialog>
      )}
      {message && <span className="block text-xs text-sea mt-1">{message}</span>}
      {error && <span className="block text-xs text-coral mt-1">{error}</span>}
    </span>
  );
}
