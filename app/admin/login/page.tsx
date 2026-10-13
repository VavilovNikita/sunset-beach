"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { getLastEmail, setLastEmail } from "@/lib/pos/lastUser";
import { staffLanding } from "@/lib/staffLanding";

// Where each role / job function lands is lib/staffLanding.ts.

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Explicit only — middleware.ts sets this when it bounced an unauthenticated
  // visit to a specific protected page (see middleware.ts), and that deep
  // link should win over the role default below. A bare visit to the login
  // page (bookmark, typed URL) carries no callbackUrl at all.
  const callbackUrl = searchParams.get("callbackUrl");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // A shared floor phone/tablet gets logged out and back in as a different person constantly
  // (see PosTopBar's "Switch user") — remembering only the last email typed here (never the
  // password) is what keeps that from being annoying enough that staff stop bothering.
  useEffect(() => {
    const last = getLastEmail();
    if (last) setEmail(last);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const res = await fetch("/api/session/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json().catch(() => null);
    setSubmitting(false);

    if (!res.ok) {
      setError("Invalid email or password.");
      return;
    }

    setLastEmail(email);
    const destination = callbackUrl ?? staffLanding(data?.role, data?.functions);
    router.push(destination);
    router.refresh();
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <Link href="/" className="text-sm text-cream/50 hover:text-cream/80 transition-colors">
          ← The Sunset Beach
        </Link>
        <p className="eyebrow text-sea mb-2 text-center mt-6">Staff access</p>
        <h1 className="font-display italic text-3xl text-center mb-8">Admin sign in</h1>

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

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-full bg-coral hover:bg-coraldeep transition-colors py-2.5 text-sm font-medium disabled:opacity-60"
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
