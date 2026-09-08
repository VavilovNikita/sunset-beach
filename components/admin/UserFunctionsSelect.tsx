"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateUserFunctions } from "@/lib/userFunctionsClient";
import type { JobFunction } from "@/lib/types";

const FUNCTIONS: JobFunction[] = ["ENGINEER", "HOUSEKEEPER"];

// Job functions are a second, independent axis from role (see lib/session.ts's JobFunction) — no
// "disabled" prop for the caller's own row the way UserRoleSelect/UserActiveToggle take one: the
// backend places no self-change restriction here, since a function can't lock anyone out of
// anything the way losing your own ADMIN role or disabling your own account could.
export default function UserFunctionsSelect({ userId, currentFunctions }: { userId: string; currentFunctions: JobFunction[] }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle(fn: JobFunction, checked: boolean) {
    const next = checked ? [...currentFunctions, fn] : currentFunctions.filter((f) => f !== fn);
    setSaving(true);
    setError(null);

    const result = await updateUserFunctions(userId, next);

    setSaving(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <span className="flex flex-col gap-1">
      <span className="flex flex-wrap gap-3">
        {FUNCTIONS.map((fn) => (
          <label key={fn} className="flex items-center gap-1.5 text-xs text-cream/70">
            <input
              type="checkbox"
              checked={currentFunctions.includes(fn)}
              disabled={saving}
              onChange={(e) => toggle(fn, e.target.checked)}
              className="accent-coral"
            />
            {fn}
          </label>
        ))}
      </span>
      {error && <span className="text-xs text-coral">{error}</span>}
    </span>
  );
}
