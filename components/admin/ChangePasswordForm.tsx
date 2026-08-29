"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { extractApiError } from "@/lib/apiError";

export default function ChangePasswordForm() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(false);

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
    setSuccess(true);
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Current password</label>
        <input
          type="password"
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
          className="w-full bg-transparent border-b border-cream/25 py-2 text-cream focus:outline-none focus:border-coral"
        />
      </div>
      <div>
        <label className="eyebrow text-cream/60 block mb-1">New password</label>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full bg-transparent border-b border-cream/25 py-2 text-cream focus:outline-none focus:border-coral"
        />
      </div>

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
