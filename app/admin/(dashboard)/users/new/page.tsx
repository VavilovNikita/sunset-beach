import { requireAdminUser } from "@/lib/rbac";
import UserForm from "@/components/admin/UserForm";

export default async function NewUserPage() {
  await requireAdminUser();

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Staff</p>
      <h1 className="font-display italic text-3xl mb-8">New user</h1>
      <UserForm />
    </div>
  );
}
