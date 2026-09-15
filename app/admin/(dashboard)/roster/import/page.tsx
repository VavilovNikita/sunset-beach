import { backendJson } from "@/lib/backendServer";
import { requireAdminUser } from "@/lib/rbac";
import RosterImportManager from "@/components/admin/RosterImportManager";
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
      <p className="text-sm text-cream/60 mb-6 max-w-2xl">
        Reads the hand-built Excel schedule for one month and turns it into roster entries. Nothing is written
        until every name below maps to an account and every ambiguous &ldquo;9&rdquo; maps to a shift code -
        read the file, resolve what&rsquo;s unresolved, then confirm.
      </p>
      <RosterImportManager initialEmployees={users.map((u) => ({ id: u.id, name: u.name, email: u.email }))} />
    </div>
  );
}
