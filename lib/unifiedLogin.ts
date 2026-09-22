import { extractApiError } from "@/lib/apiError";

export type StaffLoginOutcome =
  | { action: "redirect-admin" }
  | { action: "try-guest" }
  | { action: "error"; message: string };

/**
 * What /login should do after the staff call (POST /api/session/login) comes back - the
 * sequencing gate the unified login page is built around. Guest login is only ever attempted
 * after a plain 401 ("Invalid email or password") - anything else (429 rate-limited, a 5xx, or a
 * malformed body) stops here with its own message instead of falling through to a second call.
 */
export function decideAfterStaffLogin(ok: boolean, status: number, body: unknown): StaffLoginOutcome {
  if (ok) return { action: "redirect-admin" };
  if (status === 401) return { action: "try-guest" };
  if (status === 429) {
    return { action: "error", message: extractApiError(body, "Too many attempts. Please try again later.") };
  }
  return { action: "error", message: extractApiError(body, "Something went wrong. Please try again.") };
}

export type GuestLoginOutcome =
  | { action: "redirect-guest" }
  | { action: "unverified"; message: string }
  | { action: "error"; message: string };

/**
 * What /login should do after the guest fallback call (POST /api/guest-session/login) comes
 * back, only ever reached once decideAfterStaffLogin has already returned "try-guest". A 403 is
 * the guest system's own "please verify your email" response - deliberately not generic (a
 * correct password already proves account ownership, per that feature's own design) - shown
 * as-is, never folded into the 401 case's single generic message, which is worded so it never
 * reveals which system was tried or whether either account exists.
 */
export function decideAfterGuestLogin(ok: boolean, status: number, body: unknown): GuestLoginOutcome {
  if (ok) return { action: "redirect-guest" };
  if (status === 403) {
    return { action: "unverified", message: extractApiError(body, "Please verify your email before logging in.") };
  }
  if (status === 401) return { action: "error", message: "Invalid email or password." };
  return { action: "error", message: extractApiError(body, "Something went wrong. Please try again.") };
}
