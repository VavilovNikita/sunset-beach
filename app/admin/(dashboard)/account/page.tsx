import { requireSessionUser } from "@/lib/rbac";
import ChangePasswordForm from "@/components/admin/ChangePasswordForm";

export default async function AdminAccountPage() {
  const user = await requireSessionUser();

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Account</p>
      <h1 className="font-display italic text-3xl mb-1">{user.email}</h1>
      <p className="text-sm text-cream/50 mb-8">{user.role}</p>
      <ChangePasswordForm />
    </div>
  );
}
