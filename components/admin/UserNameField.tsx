"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import type { User } from "@/lib/types";

// Renames `User.name` - the display name every other screen (POS, punch logs, roster grid) reads
// live, so a rename relabels past records too; see PATCH /users/{id}/name's own description.
// Same click-to-edit shape as UserFullNameField, except `name` can never be cleared: a blank
// submission is a validation error here, not a save (the backend would reject it with a 400
// anyway).
export default function UserNameField({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setValue(name);
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    const trimmed = value.trim();
    if (trimmed === "") {
      setError("Name can't be empty.");
      return;
    }
    if (trimmed === name) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError(null);

    const result = await adminRequest<User>(
      `/users/${userId}/name`,
      adminJsonInit("PATCH", { name: trimmed }),
      "Could not rename the user."
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
        title="Rename - shown everywhere, including past records"
        className="text-xs px-2.5 py-1 rounded-lg border border-cream/20 text-cream/70 transition-colors hover:border-coral hover:text-coral"
      >
        {name}
      </button>
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <input
        type="text"
        autoFocus
        required
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") setEditing(false);
        }}
        aria-invalid={error !== null}
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
