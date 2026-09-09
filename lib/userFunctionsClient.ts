// Shared client-side call for PATCH /users/{id}/functions. Mirrors lib/roomUnitHousekeepingClient.ts's
// exact pattern (same ok/error result shape, same adminRequest use). Full replace, not
// incremental - the caller sends the complete desired set of job functions.
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import type { JobFunction, User, UserUpdateResult } from "@/lib/types";

export type UpdateUserFunctionsResult = { ok: true; user: User; warning: string | null } | { ok: false; error: string };

export async function updateUserFunctions(userId: string, functions: JobFunction[]): Promise<UpdateUserFunctionsResult> {
  const result = await adminRequest<UserUpdateResult>(
    `/users/${userId}/functions`,
    adminJsonInit("PATCH", { functions }),
    "Could not update job functions."
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, user: result.data.user, warning: result.data.warning };
}
