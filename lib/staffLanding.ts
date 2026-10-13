import type { JobFunction, Role } from "@/lib/session";

// Where a member of staff lands after signing in (an explicit deep link, `callbackUrl`, always wins
// and is handled by the caller).
//
// A role's own start page comes first: WAITER works the floor on /pos, CASHIER is the front desk and
// opens on /admin/today - the daily job of that role, ahead of anything a job function adds.
// MANAGER and ADMIN have no such page of their own, so their job functions decide: an ENGINEER opens
// on the maintenance tasks, a THERAPIST on the spa schedule. Several functions: the first in
// FUNCTION_LANDING order. Neither: the dashboard.
const ROLE_LANDING: Partial<Record<Role, string>> = { WAITER: "/pos", CASHIER: "/admin/today" };

const FUNCTION_LANDING: { fn: JobFunction; href: string }[] = [
  { fn: "ENGINEER", href: "/admin/maintenance" },
  { fn: "THERAPIST", href: "/admin/spa" },
];

export const DEFAULT_LANDING = "/admin";

export function staffLanding(role: string | null | undefined, functions: readonly string[] | null | undefined): string {
  const roleLanding = role ? ROLE_LANDING[role as Role] : undefined;
  if (roleLanding) return roleLanding;
  const held = functions ?? [];
  return FUNCTION_LANDING.find((l) => held.includes(l.fn))?.href ?? DEFAULT_LANDING;
}
