"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UserRoleSelect({
  userId,
  currentRole,
  disabled,
}: {
  userId: string;
  currentRole: "ADMIN" | "MANAGER";
  disabled?: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const role = e.target.value;
    setSaving(true);
    setError(null);

    const res = await fetch(`/api/users/${userId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ role }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Could not update role.");
      return;
    }
    router.refresh();
  }

  return (
    <span>
      <select
        defaultValue={currentRole}
        onChange={handleChange}
        disabled={disabled || saving}
        className="bg-ink2 border border-cream/20 rounded-lg px-2 py-1 text-xs disabled:opacity-50"
      >
        <option value="MANAGER">MANAGER</option>
        <option value="ADMIN">ADMIN</option>
      </select>
      {error && <span className="block text-xs text-coral mt-1">{error}</span>}
    </span>
  );
}
