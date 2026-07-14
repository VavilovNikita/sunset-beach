"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function DeleteButton({
  url,
  confirmText,
  className,
}: {
  url: string;
  confirmText: string;
  className?: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (!window.confirm(confirmText)) return;
    setDeleting(true);
    setError(null);

    const res = await fetch(url, { method: "DELETE" });
    setDeleting(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not delete.");
      return;
    }
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
