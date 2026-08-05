import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentUser, SESSION_COOKIE_NAME } from "@/lib/session";

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
