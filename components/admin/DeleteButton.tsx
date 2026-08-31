"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { extractApiError } from "@/lib/apiError";

export default function DeleteButton({
  url,
  confirmText,
  className,
  conflictMessage,
  onDeleted,
}: {
  url: string;
  confirmText: string;
  className?: string;
  // Shown instead of the raw backend error when DELETE returns 409 (the
  // resource is still referenced elsewhere and can't be removed) — lets a
  // caller point at a domain-specific way out instead of surfacing whatever
  // string the backend happened to send.
  conflictMessage?: string;
  // Runs after a successful delete, in addition to router.refresh() — for
  // callers holding their own copy of the list (e.g. TableManager) that need
  // to drop the row immediately rather than wait on a refetch.
  onDeleted?: () => void;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm(confirmText)) return;
    setDeleting(true);
    setError(null);

    const res = await fetch(url, { method: "DELETE", credentials: "include" });
    setDeleting(false);

    if (!res.ok) {
      if (res.status === 409 && conflictMessage) {
        setError(conflictMessage);
        return;
      }
      const data = await res.json().catch(() => null);
      setError(extractApiError(data, "Could not delete."));
      return;
    }
    onDeleted?.();
    router.refresh();
  }

  return (
    <span>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className={className ?? "text-sm text-cream/50 hover:text-coral transition-colors disabled:opacity-60"}
      >
        {deleting ? "Deleting…" : "Delete"}
      </button>
      {error && <span className="block text-xs text-coral mt-1">{error}</span>}
    </span>
  );
}
