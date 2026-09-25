"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import type { User } from "@/lib/types";

// Optional full legal name, admin reference only - see the backend's User.fullName doc. Separate
// from `name`, which this never touches. Click to edit, empty input clears it (sent as explicit
// null, not omitted - the backend rejects an entirely-omitted body as a 400, see
// PATCH /users/{id}/full-name's own description). Same shape as UserEnrollmentNumberField.
export default function UserFullNameField({ userId, fullName }: { userId: string; fullName: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(fullName ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setValue(fullName ?? "");
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    const trimmed = value.trim();
    setSaving(true);
    setError(null);

    const result = await adminRequest<User>(
      `/users/${userId}/full-name`,
      adminJsonInit("PATCH", { fullName: trimmed === "" ? null : trimmed }),
      "Could not update the full name."
    );

    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setEditing(false);
    router.refresh();
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={startEdit}
        title="Full legal name"
        className={`text-xs px-2.5 py-1 rounded-lg border border-cream/20 transition-colors hover:border-coral hover:text-coral ${
          fullName ? "text-cream/70" : "text-cream/50"
        }`}
      >
        {fullName ?? "No full name"}
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <input
        type="text"
        maxLength={200}
        autoFocus
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") setEditing(false);
        }}
        placeholder="none"
        className="w-56 max-w-full bg-transparent border-b border-cream/25 py-1 text-cream text-xs placeholder:text-cream/40 focus:outline-none focus:border-coral"
      />
      <button type="button" onClick={handleSave} disabled={saving} className="text-xs text-sea hover:text-coral transition-colors disabled:opacity-60">
        {saving ? "…" : "Save"}
      </button>
      <button type="button" onClick={() => setEditing(false)} className="text-xs text-cream/50 hover:text-cream transition-colors">
        Cancel
      </button>
      {error && <span className="text-xs text-coral">{error}</span>}
    </span>
  );
}
