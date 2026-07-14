import { requireSessionUser } from "@/lib/rbac";
import AdminSidebar from "@/components/admin/AdminSidebar";

export default async function AdminDashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await requireSessionUser();

  return (
    <div className="flex flex-col md:flex-row">
      <AdminSidebar email={user.email ?? ""} role={user.role} />
      <main className="flex-1 min-w-0 p-6 md:p-10">{children}</main>
    </div>
  );
}
