import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdminUser } from "@/lib/rbac";
import UserRoleSelect from "@/components/admin/UserRoleSelect";

export default async function AdminUsersPage() {
  const sessionUser = await requireAdminUser();

  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, role: true, createdAt: true },
  });

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
            className="flex items-center gap-4 bg-ink2/40 border border-cream/10 rounded-xl p-4"
          >
            <div className="flex-1 min-w-0">
              <p className="truncate">{u.email}</p>
              <p className="text-xs text-cream/40">Joined {u.createdAt.toISOString().slice(0, 10)}</p>
            </div>
            <UserRoleSelect userId={u.id} currentRole={u.role} disabled={u.id === sessionUser.id} />
          </div>
        ))}
      </div>
    </div>
  );
}
