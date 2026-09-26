"use client";

import { useState } from "react";
import UserRoleSelect from "@/components/admin/UserRoleSelect";
import UserActiveToggle from "@/components/admin/UserActiveToggle";
import UserOvertimeEligibilityToggle from "@/components/admin/UserOvertimeEligibilityToggle";
import UserFunctionsSelect from "@/components/admin/UserFunctionsSelect";
import UserEnrollmentNumberField from "@/components/admin/UserEnrollmentNumberField";
import UserFullNameField from "@/components/admin/UserFullNameField";
import UserNameField from "@/components/admin/UserNameField";
import ResetPasswordButton from "@/components/admin/ResetPasswordButton";
import GrantCredentialsButton from "@/components/admin/GrantCredentialsButton";
import { STAFF_AREAS, STAFF_AREA_LABELS } from "@/lib/rosterGrid";
import type { StaffArea, User } from "@/lib/types";

// Hidden by default, shown via the toggle below - deactivated is now the exception, not most of
// this list. Filters on `u.active` alone: a no-login account (email null) is still an active
// employee, just one who can't sign in (see UserCreateInput) - they are most of the staff list
// now and must never be caught by this filter. `email`/enrollmentNumber/anything else never
// feeds into this decision, only the field UserActiveToggle itself writes.
//
// Grouped by department in the same order and with the same labels as RosterGrid, plus a
// trailing "No area set" group. Each row shows identity only; every editable control lives in a
// per-row disclosure panel so the list stays scannable. The one exception to "identity only" is
// the terminal PIN (enrollmentNumber), shown read-only on the collapsed row too: it's what staff
// type into the ZK terminal's keypad when enrolling a fingerprint, so it needs to be visible
// without opening every row. Still edited only in the panel.
export default function UsersList({ users, sessionUserId }: { users: User[]; sessionUserId: string }) {
  const [showDeactivated, setShowDeactivated] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const deactivatedCount = users.filter((u) => !u.active).length;
  const visibleUsers = showDeactivated ? users : users.filter((u) => u.active);

  const groups: { area: StaffArea | null; users: User[] }[] = [
    ...STAFF_AREAS.map((area) => ({ area, users: visibleUsers.filter((u) => u.staffArea === area) })),
    { area: null, users: visibleUsers.filter((u) => u.staffArea === null) },
  ].filter((g) => g.users.length > 0);

  function toggle(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

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

      <div className="space-y-8">
        {groups.map((group) => (
          <section key={group.area ?? "none"}>
            <h2 className="eyebrow text-cream/50 mb-3">
              {group.area ? STAFF_AREA_LABELS[group.area] : "No area set"}
              <span className="ml-2 text-cream/30">{group.users.length}</span>
            </h2>
            <div className="space-y-3">
              {group.users.map((u) => {
                const isOpen = expanded.has(u.id);
                const panelId = `user-panel-${u.id}`;
                return (
                  <div key={u.id} className={`bg-ink2/40 border rounded-xl ${u.active ? "border-cream/10" : "border-coral/30"}`}>
                    <button
                      type="button"
                      onClick={() => toggle(u.id)}
                      aria-expanded={isOpen}
                      aria-controls={panelId}
                      className="w-full flex items-center gap-4 p-4 text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="truncate">
                          {u.name}
                          {u.fullName && <span className="ml-2 text-sm text-cream/40">{u.fullName}</span>}
                          {u.enrollmentNumber != null && (
                            <span className="ml-2 font-mono text-xs text-cream/60 border border-cream/20 rounded px-1.5 py-0.5">
                              PIN {u.enrollmentNumber}
                            </span>
                          )}
                          {!u.active && (
                            <span className="ml-2 text-xs text-coral border border-coral/40 rounded-full px-2 py-0.5">Disabled</span>
                          )}
                        </p>
                        <p className="text-xs text-cream/40">
                          {u.email ?? "No login"} · Joined {u.createdAt.slice(0, 10)}
                        </p>
                      </div>
                      <span className="text-xs text-cream/40">{u.role}</span>
                      <span aria-hidden className={`text-cream/40 transition-transform ${isOpen ? "rotate-180" : ""}`}>
                        ▾
                      </span>
                    </button>

                    {isOpen && (
                      <div
                        id={panelId}
                        className="border-t border-cream/10 px-4 py-4 grid gap-x-4 gap-y-3 sm:grid-cols-[9rem_1fr] sm:items-center text-sm"
                      >
                        <span className="eyebrow text-cream/40">Name</span>
                        <div>
                          <UserNameField userId={u.id} name={u.name} />
                        </div>

                        <span className="eyebrow text-cream/40">Full name</span>
                        <div>
                          <UserFullNameField userId={u.id} fullName={u.fullName ?? null} />
                        </div>

                        <span className="eyebrow text-cream/40">Role</span>
                        <div>
                          <UserRoleSelect userId={u.id} currentRole={u.role} disabled={u.id === sessionUserId} />
                        </div>

                        <span className="eyebrow text-cream/40">Functions</span>
                        <div>
                          <UserFunctionsSelect userId={u.id} currentFunctions={u.functions} />
                        </div>

                        <span className="eyebrow text-cream/40">Terminal PIN</span>
                        <div>
                          <UserEnrollmentNumberField userId={u.id} enrollmentNumber={u.enrollmentNumber} />
                        </div>

                        <span className="eyebrow text-cream/40">Overtime</span>
                        <div>
                          <UserOvertimeEligibilityToggle userId={u.id} overtimeEligible={u.overtimeEligible} />
                        </div>

                        <span className="eyebrow text-cream/40">Login</span>
                        <div>
                          {u.email ? <ResetPasswordButton userId={u.id} /> : <GrantCredentialsButton userId={u.id} name={u.name} />}
                        </div>

                        <span className="eyebrow text-cream/40">Account</span>
                        <div>
                          <UserActiveToggle userId={u.id} active={u.active} disabled={u.id === sessionUserId} />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
