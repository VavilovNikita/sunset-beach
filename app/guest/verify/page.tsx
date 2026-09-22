"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { extractApiError } from "@/lib/apiError";

type Status = "verifying" | "success" | "error";

function VerifyBody() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("verifying");
  const [error, setError] = useState<string | null>(null);
  // POST /guest-auth/verify is a one-shot action (the backend clears the token on success) - a
  // React 18 Strict Mode double-invoke of this effect in dev must not fire it twice.
  const firedRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setError("This verification link is missing its token.");
      return;
    }
    if (firedRef.current) return;
    firedRef.current = true;

    (async () => {
      const res = await fetch("/api/guest-session/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        setStatus("error");
        setError(extractApiError(data, "Invalid or expired verification token."));
        return;
      }

      // Verifying logs the guest in immediately (see POST /guest-auth/verify's own description) -
      // no separate login step.
      setStatus("success");
      router.push("/guest/account");
      router.refresh();
    })();
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <p className="eyebrow text-sea mb-2">Guest account</p>
        <h1 className="font-display italic text-3xl mb-8">Verifying your email</h1>

        <div className="bg-ink2/60 border border-cream/10 rounded-xl p-6">
          {status === "verifying" && <p className="text-cream/70">One moment…</p>}
          {status === "success" && <p className="text-cream/90">Verified! Taking you to your account…</p>}
          {status === "error" && <p className="text-coral">{error}</p>}
          {status !== "success" && (
            <p className="text-sm text-cream/50 mt-4">
              <Link href="/login" className="text-coral hover:underline">
                Back to sign in
              </Link>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function GuestVerifyPage() {
  return (
    <Suspense fallback={null}>
      <VerifyBody />
    </Suspense>
  );
}
