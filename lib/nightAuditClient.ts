// POST /night-audit/close (CASHIER+) through adminRequest - the page reads the checklist
// server-side (backendJson), so only closing needs a client call.
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import type { NightAuditCloseInput, NightAuditClosure } from "@/lib/types";

export type CloseNightAuditResult = { ok: true; closure: NightAuditClosure } | { ok: false; error: string };

export async function closeNightAudit(input: NightAuditCloseInput): Promise<CloseNightAuditResult> {
  const result = await adminRequest<NightAuditClosure>("/night-audit/close", adminJsonInit("POST", input), "Could not close the day.");
  if (!result.ok) return { ok: false, error: result.error };
  return { ok: true, closure: result.data };
}
