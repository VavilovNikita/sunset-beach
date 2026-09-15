import Link from "next/link";
import { backendJson } from "@/lib/backendServer";
import { requireAdminUser } from "@/lib/rbac";
import UsersList from "@/components/admin/UsersList";
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

      <UsersList users={users} sessionUserId={sessionUser.id} />
    </div>
  );
}
