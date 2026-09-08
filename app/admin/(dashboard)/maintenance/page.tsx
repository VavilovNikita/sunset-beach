import { backendJson } from "@/lib/backendServer";
import { requireSessionUser, hasRoleAtLeast } from "@/lib/rbac";
import MaintenanceTaskBoard from "@/components/admin/MaintenanceTaskBoard";
import type { MaintenanceTask, RoomUnit } from "@/lib/types";

// GET/POST /maintenance-tasks are open to any authenticated staff role on the backend (whoever
// notices a problem should be able to report and see it), and so is this page and its nav link
// (lib/adminNav.ts) - not role-gated the way most of /admin is. Only the specific actions below
// that the backend itself restricts (blocking a room, moving a task through its statuses) are
// hidden per-control inside MaintenanceTaskBoard, not by hiding the page.
export default async function MaintenancePage() {
  const user = await requireSessionUser();

  const [tasks, roomUnits] = await Promise.all([
    backendJson<MaintenanceTask[]>("/maintenance-tasks", { auth: true }),
    backendJson<RoomUnit[]>("/room-units", { auth: true }),
  ]);

  const canBlock = hasRoleAtLeast(user.role, "MANAGER");
  const canProgress = canBlock || user.functions.includes("ENGINEER");

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Maintenance</p>
      <h1 className="font-display italic text-3xl mb-8">Room tasks</h1>
      <MaintenanceTaskBoard initialTasks={tasks} roomUnits={roomUnits} canBlock={canBlock} canProgress={canProgress} />
    </div>
  );
}
