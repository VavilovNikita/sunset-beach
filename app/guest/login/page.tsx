"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { extractApiError } from "@/lib/apiError";

export default function GuestLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  // Distinct from `error`: only set on a 403 (correct password, unverified account) - offers a
  // resend action a wrong-password 401 never gets, matching the backend's own distinction (see
  // POST /guest-auth/login's description for why the two cases deliberately aren't the same).
  const [unverified, setUnverified] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setUnverified(false);
    setResendMessage(null);

    const res = await fetch("/api/guest-session/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => null);
    setSubmitting(false);

    if (!res.ok) {
      if (res.status === 403) {
        setUnverified(true);
        setError(extractApiError(data, "Please verify your email before logging in."));
      } else {
        setError(extractApiError(data, "Invalid email or password."));
      }
      return;
    }

    router.push("/guest/account");
    router.refresh();
  }

  async function handleResend() {
    setResendMessage(null);
    const res = await fetch("/api/guest-session/resend-verification", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    const data = await res.json().catch(() => null);
    setResendMessage(typeof data?.message === "string" ? data.message : "If this email has a pending verification, we've sent a new link.");
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-sm text-cream/50 hover:text-cream/80 transition-colors">
          ← The Sunset Beach
        </Link>
        <p className="eyebrow text-sea mb-2 text-center mt-6">Guest account</p>
        <h1 className="font-display italic text-3xl text-center mb-8">Sign in</h1>

        <form onSubmit={handleSubmit} className="space-y-4 bg-ink2/60 border border-cream/10 rounded-xl p-6">
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
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-transparent border-b border-cream/25 py-2 text-cream focus:outline-none focus:border-coral"
            />
          </div>

          {error && <p className="text-sm text-coral">{error}</p>}

          {unverified && (
            <div className="text-sm">
              <button type="button" onClick={handleResend} className="text-coral hover:underline">
                Resend verification email
              </button>
              {resendMessage && <p className="text-cream/50 mt-1">{resendMessage}</p>}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-coral hover:bg-coraldeep transition-colors py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>

          <p className="text-sm text-cream/50 text-center">
            New here?{" "}
            <Link href="/guest/register" className="text-coral hover:underline">
              Create an account
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}
