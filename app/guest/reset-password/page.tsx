"use client";

import { useState, Suspense, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { extractApiError } from "@/lib/apiError";

// Two steps on one page: without ?token= it asks for the email (POST /guest-auth/forgot-password,
// whose answer never says whether the email has an account); the emailed link brings the guest
// back here with ?token=, where they choose the new password (POST /guest-auth/reset-password,
// which signs them in). The guest mobile app's "Forgot password" screen sends guests to the same
// email, so this page is where the link lands for both.
function ResetBody() {
  const router = useRouter();
  const token = useSearchParams().get("token");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  async function requestLink(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/guest-session/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(extractApiError(data, "Could not send the reset email. Please try again."));
        return;
      }
      setSent(typeof data?.message === "string" ? data.message : "Check your email for a reset link.");
    } catch {
      setError("No connection — check the network and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function reset(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      setError("Use at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("The two passwords don't match.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/guest-session/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword: password }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setError(extractApiError(data, "This reset link is invalid or has expired."));
        return;
      }
      router.push("/guest/account");
      router.refresh();
    } catch {
      setError("No connection — check the network and try again.");
    } finally {
      setBusy(false);
    }
  }

  const input = "w-full rounded-lg bg-ink border border-cream/20 px-3 py-2 text-cream";

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <p className="eyebrow text-sea mb-2 text-center">Guest account</p>
        <h1 className="font-display italic text-3xl mb-8 text-center">{token ? "Choose a new password" : "Reset your password"}</h1>

        <div className="bg-ink2/60 border border-cream/10 rounded-xl p-6 space-y-4">
          {token ? (
            <form onSubmit={reset} className="space-y-4">
              <label className="block text-sm text-cream/70">
                New password
                <input type="password" autoComplete="new-password" className={input} value={password} onChange={(e) => setPassword(e.target.value)} />
              </label>
              <label className="block text-sm text-cream/70">
                Repeat it
                <input type="password" autoComplete="new-password" className={input} value={confirm} onChange={(e) => setConfirm(e.target.value)} />
              </label>
              <button type="submit" disabled={busy} className="w-full rounded-lg bg-coral py-2 font-medium disabled:opacity-50">
                {busy ? "Saving…" : "Save and sign in"}
              </button>
            </form>
          ) : sent ? (
            <p className="text-cream/90">{sent}</p>
          ) : (
            <form onSubmit={requestLink} className="space-y-4">
              <label className="block text-sm text-cream/70">
                Email
                <input type="email" autoComplete="email" className={input} value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>
              <button type="submit" disabled={busy || !email.trim()} className="w-full rounded-lg bg-coral py-2 font-medium disabled:opacity-50">
                {busy ? "Sending…" : "Email me a reset link"}
              </button>
            </form>
          )}
          {error && <p className="text-sm text-coral">{error}</p>}
          <p className="text-sm text-cream/50">
            <Link href="/login" className="text-coral hover:underline">
              Back to sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default function GuestResetPasswordPage() {
  return (
    <Suspense fallback={null}>
      <ResetBody />
    </Suspense>
  );
}
