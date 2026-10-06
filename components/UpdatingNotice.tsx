"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

// What every section's error.tsx renders. A server component that fails to load (almost always
// because the backend is restarting for a deploy) used to end in Next's bare "Internal Server
// Error". This says the system is updating, shows a spinner, and retries by itself every few
// seconds - router.refresh() re-runs the server components, reset() re-renders the boundary.
//
// Production strips the real error message from the client, so this can't tell a deploy from a
// genuine bug. After about a minute of failed retries it stops claiming an update and offers a
// manual reload instead, so a real bug never shows an endless spinner.
const RETRY_MS = 5000;
const MAX_RETRIES = 12;

export default function UpdatingNotice({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [attempts, setAttempts] = useState(0);
  const attemptsRef = useRef(0);

  useEffect(() => {
    const timer = setInterval(() => {
      if (attemptsRef.current >= MAX_RETRIES) {
        clearInterval(timer);
        return;
      }
      attemptsRef.current += 1;
      setAttempts(attemptsRef.current);
      startTransition(() => {
        router.refresh();
        reset();
      });
    }, RETRY_MS);
    return () => clearInterval(timer);
  }, [router, reset]);

  const gaveUp = attempts >= MAX_RETRIES;

  return (
    <div className="min-h-[60vh] flex items-center justify-center text-center px-6" role="status" aria-live="polite">
      <div className="max-w-md">
        {!gaveUp && <div className="mx-auto mb-6 h-9 w-9 animate-spin rounded-full border-[3px] border-current border-t-transparent opacity-60" />}
        <h1 className="text-2xl font-semibold mb-3">{gaveUp ? "Still not loading" : "Updating…"}</h1>
        <p className="opacity-70 leading-relaxed">
          {gaveUp
            ? "This is taking longer than an update should. Reload the page, and if it keeps happening, tell whoever looks after the system."
            : "We’re installing an update. This page will reload automatically in a moment — usually under a minute."}
        </p>
        {gaveUp && (
          <>
            <button type="button" onClick={() => window.location.reload()} className="mt-6 rounded-full border border-current px-6 py-2 text-sm">
              Reload
            </button>
            {error.digest && <p className="mt-4 text-xs opacity-40">Reference: {error.digest}</p>}
          </>
        )}
      </div>
    </div>
  );
}
