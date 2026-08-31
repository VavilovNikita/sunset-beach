// Remembers the last email typed into the shared login form — nothing more sensitive than that
// (never the password, never a token). Purely a convenience for a shared floor device: making
// "sign out, hand the phone over, sign back in as someone else" fast is the actual fix for
// per-action attribution on a shared device (see app/pos's PosTopBar) — a device that's mildly
// annoying to switch users on just won't get switched. Wrapped in try/catch: a private window or
// storage-blocking browser setting must never break the login form itself over a cosmetic detail.
const KEY = "sunset-beach:pos:last-email";

export function getLastEmail(): string {
  try {
    return window.localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}

export function setLastEmail(email: string) {
  try {
    if (email) window.localStorage.setItem(KEY, email);
  } catch {
    // ignore - see file comment
  }
}
