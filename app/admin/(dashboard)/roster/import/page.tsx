import { backendJson } from "@/lib/backendServer";
import { requireAdminUser } from "@/lib/rbac";
import RosterImportTabs from "@/components/admin/RosterImportTabs";
import type { User } from "@/lib/types";

// ADMIN only, stricter than the rest of Roster's MANAGER floor - it can create User accounts on
// the spot, the one thing /users/** itself is also hard-restricted to ADMIN for.
export default async function AdminRosterImportPage() {
  await requireAdminUser();

  const users = await backendJson<User[]>("/users", { auth: true });

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Staff</p>
      <h1 className="font-display italic text-3xl mb-8">Import a month&rsquo;s schedule</h1>
      <RosterImportTabs initialEmployees={users.map((u) => ({ id: u.id, name: u.name, email: u.email }))} />
    </div>
  );
}
