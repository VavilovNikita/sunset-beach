import { safeCallbackUrl as sameSitePath } from "@/lib/staffLanding";

// The deep link a protected page sends an unauthenticated visitor back with (?callbackUrl=). Only a path inside
// this site is followed (`sameSitePath`, audit finding M11: no other site, no "//host", no backslash trick), and
// never the login page itself, which would loop.
export function safeCallbackUrl(raw: string | null | undefined): string | null {
  const path = sameSitePath(raw);
  if (!path || path.includes("\\")) return null;
  if (path === "/login" || path.startsWith("/login?") || path.startsWith("/admin/login")) return null;
  return path;
}

// The one login page. An old /admin/login link or bookmark is sent here with its callbackUrl kept.
export function loginHref(callbackUrl?: string | null): string {
  const safe = safeCallbackUrl(callbackUrl);
  return safe ? `/login?callbackUrl=${encodeURIComponent(safe)}` : "/login";
}
