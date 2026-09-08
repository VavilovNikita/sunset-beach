// Shared client-side calls for /maintenance-tasks. JSON bodies go through adminRequest, matching
// every other admin write in this app; the multipart create follows RoomImageUploader.tsx's own
// raw-fetch-with-FormData pattern instead (adminJsonInit is JSON-only) — same ADMIN_API_URL
// origin, same credentials:"include", same extractApiError handling.
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import { ADMIN_API_URL } from "@/lib/backend";
import { extractApiError } from "@/lib/apiError";
import type { MaintenanceTask, MaintenanceTaskBlockResult, MaintenanceTaskStatus, RoomUnitBlockInput } from "@/lib/types";

export type ListMaintenanceTasksResult = { ok: true; tasks: MaintenanceTask[] } | { ok: false; error: string };
export type GetMaintenanceTaskResult = { ok: true; task: MaintenanceTask } | { ok: false; error: string };
export type CreateMaintenanceTaskResult = { ok: true; task: MaintenanceTask } | { ok: false; error: string };
export type AddMaintenanceTaskBlockResult = { ok: true; result: MaintenanceTaskBlockResult } | { ok: false; error: string };
export type UpdateMaintenanceTaskStatusResult = { ok: true; task: MaintenanceTask } | { ok: false; error: string };

export async function listMaintenanceTasks(filter?: { status?: MaintenanceTaskStatus; roomUnitId?: string }): Promise<ListMaintenanceTasksResult> {
  const params = new URLSearchParams();
  if (filter?.status) params.set("status", filter.status);
  if (filter?.roomUnitId) params.set("roomUnitId", filter.roomUnitId);
  const query = params.toString();
  const result = await adminRequest<MaintenanceTask[]>(`/maintenance-tasks${query ? `?${query}` : ""}`, undefined, "Could not load maintenance tasks.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, tasks: result.data };
}

export async function getMaintenanceTask(id: string): Promise<GetMaintenanceTaskResult> {
  const result = await adminRequest<MaintenanceTask>(`/maintenance-tasks/${id}`, undefined, "Could not load this task.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, task: result.data };
}

// Photos are optional (zero or more) - not every problem is photographable.
export async function createMaintenanceTask(
  roomUnitId: string,
  description: string,
  photos: File[]
): Promise<CreateMaintenanceTaskResult> {
  const formData = new FormData();
  formData.append("roomUnitId", roomUnitId);
  formData.append("description", description);
  photos.forEach((f) => formData.append("photos", f));

  let res: Response;
  try {
    res = await fetch(`${ADMIN_API_URL}/maintenance-tasks`, { method: "POST", credentials: "include", body: formData });
  } catch {
    return { ok: false, error: "No connection — check the network and try again." };
  }
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    return { ok: false, error: extractApiError(data, "Could not file this task.") };
  }
  return { ok: true, task: (await res.json()) as MaintenanceTask };
}

export async function addMaintenanceTaskBlock(taskId: string, input: RoomUnitBlockInput): Promise<AddMaintenanceTaskBlockResult> {
  const result = await adminRequest<MaintenanceTaskBlockResult>(
    `/maintenance-tasks/${taskId}/block`,
    adminJsonInit("POST", input),
    "Could not block this room."
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, result: result.data };
}

export async function updateMaintenanceTaskStatus(taskId: string, status: MaintenanceTaskStatus): Promise<UpdateMaintenanceTaskStatusResult> {
  const result = await adminRequest<MaintenanceTask>(`/maintenance-tasks/${taskId}/status`, adminJsonInit("PATCH", { status }), "Could not update this task.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, task: result.data };
}
