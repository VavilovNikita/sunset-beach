"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import type { User } from "@/lib/types";

// A fact about the person, not derived from their shift code - see the backend's
// User.overtimeEligible doc for why. Unlike UserActiveToggle, there's no self-lockout risk and
// no warning to surface - this doesn't touch authentication at all.
export default function UserOvertimeEligibilityToggle({ userId, overtimeEligible }: { userId: string; overtimeEligible: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleToggle() {
    const next = !overtimeEligible;
    setSaving(true);
    setError(null);

    const result = await adminRequest<User>(
      `/users/${userId}/overtime-eligibility`,
      adminJsonInit("PATCH", { overtimeEligible: next }),
      "Could not update overtime eligibility."
    );

    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <span>
      <button
        type="button"
        onClick={handleToggle}
        disabled={saving}
        title="Overtime eligibility"
        className={`text-xs px-2.5 py-1 rounded-lg border transition-colors disabled:opacity-50 ${
          overtimeEligible
            ? "border-cream/20 text-cream/70 hover:border-coral hover:text-coral"
            : "border-amber-400/50 text-amber-400 hover:bg-amber-400/10"
        }`}
      >
        {saving ? "…" : overtimeEligible ? "OT eligible" : "OT ineligible"}
      </button>
      {error && <span className="block text-xs text-coral mt-1">{error}</span>}
    </span>
  );
}
