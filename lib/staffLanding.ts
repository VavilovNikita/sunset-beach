import type { JobFunction, Role } from "@/lib/session";

// Where a member of staff lands after signing in (an explicit deep link, `callbackUrl`, always wins
// and is handled by the caller).
//
// For the floor and the desk (WAITER, CASHIER) the job function decides, because it says what the
// person actually does: an ENGINEER opens on the maintenance tasks, a THERAPIST on the spa schedule;
// holding both, ENGINEER first. Without a function, the role's own page: WAITER `/pos`, CASHIER
// `/admin/today`. MANAGER and ADMIN always open the dashboard, whatever functions they hold.
// (The spa schedule needs CASHIER+, so a WAITER therapist lands on the access-denied page.)
const ROLE_LANDING: Partial<Record<Role, string>> = { WAITER: "/pos", CASHIER: "/admin/today" };

const FUNCTION_LANDING: { fn: JobFunction; href: string }[] = [
  { fn: "ENGINEER", href: "/admin/maintenance" },
  { fn: "THERAPIST", href: "/admin/spa" },
];

export const DEFAULT_LANDING = "/admin";

export function staffLanding(role: string | null | undefined, functions: readonly string[] | null | undefined): string {
  const roleLanding = role ? ROLE_LANDING[role as Role] : undefined;
  if (!roleLanding) return DEFAULT_LANDING; // MANAGER, ADMIN, or an unknown role
  const held = functions ?? [];
  return FUNCTION_LANDING.find((l) => held.includes(l.fn))?.href ?? roleLanding;
}
