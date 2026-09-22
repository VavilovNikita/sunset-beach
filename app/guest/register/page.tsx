"use client";

import { useState } from "react";
import Link from "next/link";
import { extractApiError } from "@/lib/apiError";

export default function GuestRegisterPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setMessage(null);

    const res = await fetch("/api/guest-session/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password, ...(name.trim() ? { name: name.trim() } : {}) }),
    });

    const data = await res.json().catch(() => null);
    setSubmitting(false);

    if (!res.ok) {
      setError(extractApiError(data, "Could not register. Please try again."));
      return;
    }

    // Always the same generic message, regardless of what was actually true about this email
    // (free, already pending, or already verified) - see POST /guest-auth/register's own
    // description. Never returns a token: the account isn't usable until the guest clicks the
    // verification link.
    setMessage(typeof data?.message === "string" ? data.message : "If this email isn't already registered, we've sent a verification link.");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="eyebrow text-sea mb-2 text-center">Guest account</p>
        <h1 className="font-display italic text-3xl text-center mb-8">Create your account</h1>

        {message ? (
          <div className="bg-ink2/60 border border-cream/10 rounded-xl p-6 text-center">
            <p className="text-cream/90">{message}</p>
            <p className="text-sm text-cream/50 mt-4">
              Already verified?{" "}
              <Link href="/guest/login" className="text-coral hover:underline">
                Sign in
              </Link>
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 bg-ink2/60 border border-cream/10 rounded-xl p-6">
            <div>
              <label className="eyebrow text-cream/60 block mb-1">Name (optional)</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-transparent border-b border-cream/25 py-2 text-cream focus:outline-none focus:border-coral"
              />
            </div>
            <div>
              <label className="eyebrow text-cream/60 block mb-1">Email</label>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-transparent border-b border-cream/25 py-2 text-cream focus:outline-none focus:border-coral"
              />
            </div>
            <div>
              <label className="eyebrow text-cream/60 block mb-1">Password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-transparent border-b border-cream/25 py-2 text-cream focus:outline-none focus:border-coral"
              />
            </div>

            {error && <p className="text-sm text-coral">{error}</p>}

            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-full bg-coral hover:bg-coraldeep transition-colors py-2.5 text-sm font-medium disabled:opacity-60"
            >
              {submitting ? "Creating account…" : "Create account"}
            </button>

            <p className="text-sm text-cream/50 text-center">
              Already have an account?{" "}
              <Link href="/guest/login" className="text-coral hover:underline">
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </div>
  );
}
