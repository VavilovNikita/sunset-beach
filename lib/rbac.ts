import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser, SESSION_COOKIE_NAME, type Role } from "@/lib/session";

// Mirrors the backend's RoleHierarchy (ADMIN > MANAGER > CASHIER > WAITER —
// see openapi.yaml's Role schema). Several POS endpoints are gated at
// "MANAGER or above"; this is how the UI hides actions a lower role would
// just get a 403 for, without duplicating the hierarchy at every call site.
const ROLE_RANK: Record<Role, number> = { WAITER: 0, CASHIER: 1, MANAGER: 2, ADMIN: 3 };

export function hasRoleAtLeast(role: Role, minimum: Role) {
  return ROLE_RANK[role] >= ROLE_RANK[minimum];
}

export async function getSessionUser() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value ?? null;
  return getCurrentUser(token);
}

// For Server Components/pages — redirects rather than returning a response.
export async function requireSessionUser() {
  const user = await getSessionUser();
  if (!user) redirect("/admin/login");
  return user;
}

export async function requireAdminUser() {
  const user = await requireSessionUser();
  if (user.role !== "ADMIN") redirect("/admin");
  return user;
}

// For POS pages gated at "MANAGER or above" (menu/printer management) where,
// unlike requireAdminUser, the fallback route varies by caller — bouncing a
// WAITER off /admin/pos/printers should land them back on /admin/pos, not
// on the dashboard root.
export async function requireRoleAtLeast(minimum: Role, redirectTo = "/admin") {
  const user = await requireSessionUser();
  if (!hasRoleAtLeast(user.role, minimum)) redirect(redirectTo);
  return user;
}
