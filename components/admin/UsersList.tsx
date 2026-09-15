"use client";

import { useState } from "react";
import UserRoleSelect from "@/components/admin/UserRoleSelect";
import UserActiveToggle from "@/components/admin/UserActiveToggle";
import UserOvertimeEligibilityToggle from "@/components/admin/UserOvertimeEligibilityToggle";
import UserFunctionsSelect from "@/components/admin/UserFunctionsSelect";
import UserEnrollmentNumberField from "@/components/admin/UserEnrollmentNumberField";
import ResetPasswordButton from "@/components/admin/ResetPasswordButton";
import GrantCredentialsButton from "@/components/admin/GrantCredentialsButton";
import type { User } from "@/lib/types";

// Hidden by default, shown via the toggle below - deactivated is now the exception, not most of
// this list. Filters on `u.active` alone: a no-login account (email null) is still an active
// employee, just one who can't sign in (see UserCreateInput) - they are most of the staff list
// now and must never be caught by this filter. `email`/enrollmentNumber/anything else never
// feeds into this decision, only the field UserActiveToggle itself writes.
export default function UsersList({ users, sessionUserId }: { users: User[]; sessionUserId: string }) {
  const [showDeactivated, setShowDeactivated] = useState(false);
  const deactivatedCount = users.filter((u) => !u.active).length;
  const visibleUsers = showDeactivated ? users : users.filter((u) => u.active);

  return (
    <div>
      <label className="flex items-center gap-2 text-sm text-cream/60 mb-4">
        <input
          type="checkbox"
          checked={showDeactivated}
          onChange={(e) => setShowDeactivated(e.target.checked)}
          className="accent-coral"
        />
        Show deactivated ({deactivatedCount})
      </label>

      <div className="space-y-3">
        {visibleUsers.map((u) => (
          <div
            key={u.id}
            className={`flex items-center gap-4 bg-ink2/40 border rounded-xl p-4 ${
              u.active ? "border-cream/10" : "border-coral/30"
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="truncate">
                {u.name}
                {!u.active && <span className="ml-2 text-xs text-coral border border-coral/40 rounded-full px-2 py-0.5">Disabled</span>}
              </p>
              <p className="text-xs text-cream/40">
                {u.email ?? "No login"} · Joined {u.createdAt.slice(0, 10)}
              </p>
            </div>
            <UserFunctionsSelect userId={u.id} currentFunctions={u.functions} />
            <UserEnrollmentNumberField userId={u.id} enrollmentNumber={u.enrollmentNumber} />
            <UserOvertimeEligibilityToggle userId={u.id} overtimeEligible={u.overtimeEligible} />
            {u.email ? <ResetPasswordButton userId={u.id} /> : <GrantCredentialsButton userId={u.id} name={u.name} />}
            <UserActiveToggle userId={u.id} active={u.active} disabled={u.id === sessionUserId} />
            <UserRoleSelect userId={u.id} currentRole={u.role} disabled={u.id === sessionUserId} />
          </div>
        ))}
      </div>
    </div>
  );
}
