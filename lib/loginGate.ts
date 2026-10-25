import { safeCallbackUrl } from "@/lib/loginRedirect";
import { staffLanding } from "@/lib/staffLanding";

// Where /login sends someone who is already signed in as staff, or null to show the form. The destination is what a
// successful "Sign in" would pick (decideAfterStaffLogin): the deep link the visitor came with if it is a path on this
// site, otherwise the role's / job functions' landing page - one rule, staffLanding, not a second copy.
export function loginGateDestination(
  user: { role: string; functions?: readonly string[] | null } | null,
  callbackUrl: string | null | undefined,
): string | null {
  if (!user) return null;
  return safeCallbackUrl(callbackUrl) ?? staffLanding(user.role, user.functions ?? []);
}
