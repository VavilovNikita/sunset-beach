"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { decideAfterGuestLogin, decideAfterStaffLogin } from "@/lib/unifiedLogin";

/**
 * One login form for both staff and guest accounts - staff login (POST /api/session/login) is
 * tried first, and guest login (POST /api/guest-session/login) only follows on the specific
 * "wrong email/password" case (see lib/unifiedLogin.ts's own comments for the exact rules). The
 * two backend auth systems stay entirely separate; this page is purely a frontend sequencing
 * layer on top of both, never called concurrently - always staff, awaited, then guest.
 *
 * /admin/login and /guest/login keep working unchanged - this is an additional entry point,
 * not a replacement.
 */
export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setUnverified(false);
    setResendMessage(null);

    let staffRes: Response;
    try {
      staffRes = await fetch("/api/session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      setSubmitting(false);
      setError("Could not reach the server. Please try again.");
      return;
    }
    const staffData = await staffRes.json().catch(() => null);
    const staffOutcome = decideAfterStaffLogin(staffRes.ok, staffRes.status, staffData);

    if (staffOutcome.action === "redirect-admin") {
      router.push("/admin");
      router.refresh();
      return;
    }
    if (staffOutcome.action === "error") {
      setSubmitting(false);
      setError(staffOutcome.message);
      return;
    }

    // staffOutcome.action === "try-guest" - the staff call failed with a plain "wrong
    // email/password", and only that case falls through to a guest login attempt.
    let guestRes: Response;
    try {
      guestRes = await fetch("/api/guest-session/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
    } catch {
      setSubmitting(false);
      setError("Could not reach the server. Please try again.");
      return;
    }
    const guestData = await guestRes.json().catch(() => null);
    setSubmitting(false);
    const guestOutcome = decideAfterGuestLogin(guestRes.ok, guestRes.status, guestData);

    if (guestOutcome.action === "redirect-guest") {
      router.push("/guest/account");
      router.refresh();
      return;
    }
    if (guestOutcome.action === "unverified") {
      setUnverified(true);
      setError(guestOutcome.message);
      return;
    }
    setError(guestOutcome.message);
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
        <p className="eyebrow text-sea mb-2 text-center">Sign in</p>
        <h1 className="font-display italic text-3xl text-center mb-8">Welcome back</h1>

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
