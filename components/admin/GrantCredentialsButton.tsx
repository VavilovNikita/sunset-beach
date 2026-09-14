"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_API_URL } from "@/lib/backend";
import { extractApiError } from "@/lib/apiError";

// The no-login-to-login transition (see UserCreateInput's own comment: a dishwasher who becomes
// a receptionist) - only shown for a user with no email (UsersPage decides that), since PATCH
// /users/{id}/credentials only accepts the transition, not changing an existing login email.
export default function GrantCredentialsButton({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch(`${ADMIN_API_URL}/users/${userId}/credentials`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    setSubmitting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(extractApiError(data, "Could not grant login credentials."));
      return;
    }
    setOpen(false);
    setEmail("");
    setPassword("");
    router.refresh();
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-cream/70 hover:text-coral transition-colors"
      >
        Give login access
      </button>
    );
  }

  return (
    <div className="bg-ink border border-cream/10 rounded-lg p-3 space-y-2 max-w-xs">
      <p className="text-xs text-cream/50">Give {name} an email and password so they can sign in.</p>
      <form onSubmit={handleSubmit} className="space-y-2">
        <input
          type="email"
          required
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full bg-transparent border-b border-cream/25 py-1.5 text-sm text-cream focus:outline-none focus:border-coral"
        />
        <input
          type="text"
          required
          minLength={8}
          placeholder="Temporary password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full bg-transparent border-b border-cream/25 py-1.5 text-sm text-cream focus:outline-none focus:border-coral"
        />
        {error && <p className="text-xs text-coral">{error}</p>}
        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-4 py-1.5 text-xs font-medium disabled:opacity-60"
          >
            {submitting ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            className="text-xs text-cream/50 hover:text-cream transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
