"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_API_URL } from "@/lib/backend";
import type { Role } from "@/lib/types";

const ROLES: Role[] = ["WAITER", "CASHIER", "MANAGER", "ADMIN"];

export default function UserRoleSelect({
  userId,
  currentRole,
  disabled,
}: {
  userId: string;
  currentRole: Role;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const role = e.target.value;
    setSaving(true);
    setError(null);

    const res = await fetch(`${ADMIN_API_URL}/users/${userId}`, {
      method: "PATCH",
      credentials: "include",
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

  // A native <select> silently renders its first <option> when
  // defaultValue/value doesn't match any of them — with only ADMIN/MANAGER
  // options, a WAITER or CASHIER user used to show up here as MANAGER with
  // no indication anything was wrong, and one accidental interaction would
  // PATCH them to it. ROLES now covers every backend Role, so this branch
  // shouldn't fire in practice — it's a guard against the two ever drifting
  // apart again, not routine handling.
  if (!ROLES.includes(currentRole)) {
    return (
      <span
        className="text-xs text-coral border border-coral/40 rounded-lg px-2 py-1"
        title="This role isn't one the admin UI knows how to display — fix the code before changing it here."
      >
        Unknown role: {currentRole}
      </span>
    );
  }

  return (
    <span>
      <select
        defaultValue={currentRole}
        onChange={handleChange}
        disabled={disabled || saving}
        className="bg-ink2 border border-cream/20 rounded-lg px-2 py-1 text-xs disabled:opacity-50"
      >
        {ROLES.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </select>
      {error && <span className="block text-xs text-coral mt-1">{error}</span>}
    </span>
  );
}
