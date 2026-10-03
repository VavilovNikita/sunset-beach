"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { extractApiError } from "@/lib/apiError";
import ConfirmDialog from "@/components/admin/ConfirmDialog";

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
  // The question is asked in the admin's own dialog (ConfirmDialog), not window.confirm(); a
  // failure is shown in it, next to the button, and it stays open for a retry - except a 409,
  // which closes it and shows the caller's way out under the Delete button.
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    setError(null);

    const res = await fetch(url, { method: "DELETE", credentials: "include" });
    setDeleting(false);

    if (!res.ok) {
      if (res.status === 409 && conflictMessage) {
        setConfirming(false);
        setError(conflictMessage);
        return;
      }
      const data = await res.json().catch(() => null);
      setError(extractApiError(data, "Could not delete."));
      return;
    }
    setConfirming(false);
    onDeleted?.();
    router.refresh();
  }

  return (
    <span>
      <button
        type="button"
        onClick={() => {
          setError(null);
          setConfirming(true);
        }}
        disabled={deleting}
        className={className ?? "text-sm text-cream/50 hover:text-coral transition-colors disabled:opacity-60"}
      >
        {deleting ? "Deleting…" : "Delete"}
      </button>
      {error && !confirming && <span className="block text-xs text-coral mt-1">{error}</span>}
      {confirming && (
        <ConfirmDialog
          eyebrow="Delete"
          title={confirmText}
          confirmLabel="Delete"
          busyLabel="Deleting…"
          busy={deleting}
          error={error}
          onConfirm={handleDelete}
          onBack={() => {
            setConfirming(false);
            setError(null);
          }}
        />
      )}
    </span>
  );
}
