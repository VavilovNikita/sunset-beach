import { redirect } from "next/navigation";
import { requireRoleAtLeast } from "@/lib/rbac";
import { parseNightAuditDateParam } from "@/lib/nightAudit";
import { reportsHref } from "@/lib/reportsTabs";

// The manager report is now a tab of /admin/reports; this keeps old bookmarks working.
export default async function ManagerReportRedirect({ searchParams }: { searchParams: { date?: string } }) {
  await requireRoleAtLeast("MANAGER");
  redirect(reportsHref({ tab: "manager", date: parseNightAuditDateParam(searchParams.date) ?? undefined }));
}
