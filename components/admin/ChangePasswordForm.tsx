"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { extractApiError } from "@/lib/apiError";
import { newPasswordProblem, PASSWORD_HINT, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "@/lib/passwordForm";

const INPUT = "w-full bg-transparent border-b border-cream/25 py-2 text-cream focus:outline-none focus:border-coral";

export default function ChangePasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [visible, setVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Shown beside the fields as soon as the confirmation has been started, so a typo is seen before Save.
  const live = confirm !== "" ? newPasswordProblem(newPassword, confirm, currentPassword) : null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSuccess(false);
    const problem = newPasswordProblem(newPassword, confirm, currentPassword);
    if (problem) {
      setError(problem);
      return;
    }
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/session/change-password", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(extractApiError(data, "Could not change password."));
      return;
    }

    // The response already rewrote the session cookie with a fresh token (see the route) —
    // nothing else here keeps the user signed in, this just clears the form and lets any
    // server-rendered data on the page catch up.
    setCurrentPassword("");
    setNewPassword("");
    setConfirm("");
    setSuccess(true);
    router.refresh();
  }

  const type = visible ? "text" : "password";

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Current password</label>
        <input
          type={type}
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className={INPUT}
        />
      </div>
      <div>
        <label className="eyebrow text-cream/60 block mb-1">New password</label>
        <input
          type={type}
          required
          minLength={PASSWORD_MIN_LENGTH}
          maxLength={PASSWORD_MAX_LENGTH}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          aria-describedby="new-password-hint"
          className={INPUT}
        />
        <p id="new-password-hint" className="text-xs text-cream/40 mt-1">
          {PASSWORD_HINT}
        </p>
      </div>
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Repeat new password</label>
        <input
          type={type}
          required
          autoComplete="new-password"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          className={INPUT}
        />
        {live && <p className="text-xs text-coral mt-1">{live}</p>}
      </div>

      <label className="flex items-center gap-2 text-sm text-cream/70">
        <input type="checkbox" checked={visible} onChange={(e) => setVisible(e.target.checked)} className="h-4 w-4" />
        Show passwords
      </label>

      {error && <p className="text-sm text-coral">{error}</p>}
      {success && <p className="text-sm text-sea">Password changed.</p>}

      <button
        type="submit"
        disabled={submitting}
        className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-6 py-2.5 text-sm font-medium disabled:opacity-60"
      >
        {submitting ? "Saving…" : "Change password"}
      </button>
    </form>
  );
}
