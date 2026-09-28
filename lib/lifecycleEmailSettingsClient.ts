// PUT /settings/lifecycle-emails (ADMIN only) through adminRequest - the page reads the current
// settings server-side (backendJson), so only the save needs a client call.
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import type { LifecycleEmailSettings, LifecycleEmailSettingsUpdateInput } from "@/lib/types";

export type SaveLifecycleEmailSettingsResult = { ok: true; settings: LifecycleEmailSettings } | { ok: false; error: string };

export async function saveLifecycleEmailSettings(input: LifecycleEmailSettingsUpdateInput): Promise<SaveLifecycleEmailSettingsResult> {
  const result = await adminRequest<LifecycleEmailSettings>(
    "/settings/lifecycle-emails",
    adminJsonInit("PUT", input),
    "Could not save the email settings.",
  );
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, settings: result.data };
}
