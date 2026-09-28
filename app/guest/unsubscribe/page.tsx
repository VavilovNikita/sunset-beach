"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { extractApiError } from "@/lib/apiError";

type Status = "working" | "success" | "error";

// Where every automated guest email's unsubscribe link lands. The opt-out itself fires from this
// page's script, not from the link: a mail client's link scanner fetching the URL without
// running scripts must not unsubscribe anyone by itself. Repeating it is harmless (the backend
// call is idempotent), so no confirm step.
function UnsubscribeBody() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("working");
  const [message, setMessage] = useState<string | null>(null);
  // React 18 Strict Mode runs this effect twice in dev - harmless here, but no reason to call twice.
  const firedRef = useRef(false);

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("This unsubscribe link is missing its token.");
      return;
    }
    if (firedRef.current) return;
    firedRef.current = true;

    (async () => {
      let res: Response;
      try {
        res = await fetch(`/api/guest-session/unsubscribe?${new URLSearchParams({ token })}`, { cache: "no-store" });
      } catch {
        setStatus("error");
        setMessage("No connection — check the network and try again.");
        return;
      }
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setStatus("error");
        setMessage(extractApiError(data, "This unsubscribe link isn't valid."));
        return;
      }
      setStatus("success");
    })();
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm text-center">
        <p className="eyebrow text-sea mb-2">Guest emails</p>
        <h1 className="font-display italic text-3xl mb-8">Unsubscribe</h1>

        <div className="bg-ink2/60 border border-cream/10 rounded-xl p-6">
          {status === "working" && <p className="text-cream/70">One moment…</p>}
          {status === "success" && (
            <p className="text-cream/90">
              You&apos;ve been unsubscribed. You won&apos;t receive any more of these emails. Emails about a booking you make
              will still reach you.
            </p>
          )}
          {status === "error" && <p className="text-coral">{message}</p>}
        </div>
      </div>
    </div>
  );
}

export default function GuestUnsubscribePage() {
  return (
    <Suspense fallback={null}>
      <UnsubscribeBody />
    </Suspense>
  );
}
