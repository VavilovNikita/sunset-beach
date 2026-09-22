import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getCurrentGuestAccount, GUEST_SESSION_COOKIE_NAME } from "@/lib/guestSession";

export async function getGuestSessionAccount() {
  const store = await cookies();
  const token = store.get(GUEST_SESSION_COOKIE_NAME)?.value ?? null;
  return getCurrentGuestAccount(token);
}

// For Server Components/pages — redirects rather than returning a response, same convention as
// lib/rbac.ts's requireSessionUser.
export async function requireGuestSessionAccount() {
  const account = await getGuestSessionAccount();
  if (!account) redirect("/guest/login");
  return account;
}
