"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import type { User } from "@/lib/types";

// The terminal's own numeric PIN for this person - see the backend's User.enrollmentNumber doc
// for why nothing a fingerprint terminal reports can be attributed to anyone without one. Click
// to edit, empty input clears it (sent as explicit null, not omitted - the backend rejects an
// entirely-omitted body as a 400, see PATCH /users/{id}/enrollment-number's own description).
export default function UserEnrollmentNumberField({ userId, enrollmentNumber }: { userId: string; enrollmentNumber: number | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(enrollmentNumber === null ? "" : String(enrollmentNumber));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit() {
    setValue(enrollmentNumber === null ? "" : String(enrollmentNumber));
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    const trimmed = value.trim();
    const next = trimmed === "" ? null : Number(trimmed);
    if (next !== null && (!Number.isInteger(next) || next < 0)) {
      setError("Enter a whole number, or leave it blank to clear.");
      return;
    }
    setSaving(true);
    setError(null);

    const result = await adminRequest<User>(
      `/users/${userId}/enrollment-number`,
      adminJsonInit("PATCH", { enrollmentNumber: next }),
      "Could not update the enrollment number."
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
        title="Fingerprint terminal enrollment number"
        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors ${
          enrollmentNumber === null
            ? "border-cream/20 text-cream/50 hover:border-coral hover:text-coral"
            : "border-cream/20 text-cream/70 hover:border-coral hover:text-coral"
        }`}
      >
        {enrollmentNumber === null ? "No PIN" : `PIN ${enrollmentNumber}`}
      </button>
    );
  }

  return (
    <span className="flex items-center gap-1.5">
      <input
        type="number"
        min={0}
        step={1}
        autoFocus
        value={value}
        disabled={saving}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") handleSave();
          if (e.key === "Escape") setEditing(false);
        }}
        placeholder="none"
        className="w-20 bg-transparent border-b border-cream/25 py-1 text-cream text-xs placeholder:text-cream/40 focus:outline-none focus:border-coral"
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
