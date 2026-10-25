"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getLastEmail, setLastEmail } from "@/lib/pos/lastUser";
import { decideAfterGuestLogin, decideAfterStaffLogin } from "@/lib/unifiedLogin";

/**
 * One login form for both staff and guest accounts - staff login (POST /api/session/login) is
 * tried first, and guest login (POST /api/guest-session/login) only follows on the specific
 * "wrong email/password" case (see lib/unifiedLogin.ts's own comments for the exact rules). The
 * two backend auth systems stay entirely separate; this page is purely a frontend sequencing
 * layer on top of both, never called concurrently - always staff, awaited, then guest.
 *
 * This is the one login form (app/login/page.tsx decides whether to show it at all): /admin/login redirects here (keeping its callbackUrl), and
 * /guest/login stays as the guest-only form.
 */
function LoginForm() {
  const router = useRouter();
  const callbackUrl = useSearchParams().get("callbackUrl");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [unverified, setUnverified] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // A shared floor phone gets signed out and in as a different person all day: the last email typed (never the
  // password) is remembered, as the old staff-only page did.
  useEffect(() => {
    const last = getLastEmail();
    if (last) setEmail(last);
  }, []);

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
    const staffOutcome = decideAfterStaffLogin(staffRes.ok, staffRes.status, staffData, callbackUrl);

    if (staffOutcome.action === "redirect-admin") {
      setLastEmail(email);
      router.push(staffOutcome.destination);
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
        <Link href="/" className="text-sm text-cream/50 hover:text-cream/80 transition-colors">
          ← The Sunset Beach
        </Link>
        <p className="eyebrow text-sea mb-2 text-center mt-6">Sign in</p>
        <h1 className="font-display italic text-3xl text-center mb-8">Welcome back</h1>

        <form onSubmit={handleSubmit} className="space-y-4 bg-ink2/60 border border-cream/10 rounded-xl p-6">
          <div>
            <label className="eyebrow text-cream/60 block mb-1">Email</label>
            <input
              type="email"
              autoComplete="username"
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
              autoComplete="current-password"
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
          <p className="text-sm text-cream/50 text-center">
            <Link href="/guest/reset-password" className="text-coral hover:underline">
              Forgot your guest account password?
            </Link>
          </p>
        </form>
      </div>
    </div>
  );
}

export default function UnifiedLoginForm() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
