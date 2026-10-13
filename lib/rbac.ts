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
  if (user.role !== "ADMIN") redirect("/admin/access-denied");
  return user;
}

// Every gate sends a signed-in user who is below the required role to the same place,
// /admin/access-denied, which says why and links to the page that role does have. It used to take a
// per-page fallback (/admin/pos, /admin/rooms, ...), so the same mistake landed on a different
// screen depending on the page - and some of those looked like a working page that silently
// did nothing. Don't add a redirect parameter back.
export async function requireRoleAtLeast(minimum: Role) {
  const user = await requireSessionUser();
  if (!hasRoleAtLeast(user.role, minimum)) redirect("/admin/access-denied");
  return user;
}
