import Link from "next/link";
import { backendJson } from "@/lib/backendServer";
import { requireAdminUser } from "@/lib/rbac";
import UserRoleSelect from "@/components/admin/UserRoleSelect";
import UserActiveToggle from "@/components/admin/UserActiveToggle";
import ResetPasswordButton from "@/components/admin/ResetPasswordButton";
import type { User } from "@/lib/types";

export default async function AdminUsersPage() {
  const sessionUser = await requireAdminUser();

  const users = await backendJson<User[]>("/users", { auth: true });

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <p className="eyebrow text-sea mb-2">Staff</p>
          <h1 className="font-display italic text-3xl">Users</h1>
        </div>
        <Link
          href="/admin/users/new"
          className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2.5 text-sm font-medium"
        >
          New user
        </Link>
      </div>

      <div className="space-y-3">
        {users.map((u) => (
          <div
            key={u.id}
            className={`flex items-center gap-4 bg-ink2/40 border rounded-xl p-4 ${
              u.active ? "border-cream/10" : "border-coral/30"
            }`}
          >
            <div className="flex-1 min-w-0">
              <p className="truncate">
                {u.email}
                {!u.active && <span className="ml-2 text-xs text-coral border border-coral/40 rounded-full px-2 py-0.5">Disabled</span>}
              </p>
              <p className="text-xs text-cream/40">Joined {u.createdAt.slice(0, 10)}</p>
            </div>
            <ResetPasswordButton userId={u.id} />
            <UserActiveToggle userId={u.id} active={u.active} disabled={u.id === sessionUser.id} />
            <UserRoleSelect userId={u.id} currentRole={u.role} disabled={u.id === sessionUser.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
