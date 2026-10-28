import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE_NAME, getCurrentUser } from "@/lib/session";
import { BackendUnavailableError } from "@/lib/backendOutage";

// nginx's auth_request for the staff manual (/manual/, the sunset-manual repo): 204 when the
// session cookie belongs to an active staff account, 401 otherwise - nginx then sends the visitor to
// /login?callbackUrl=/manual/. Asks the backend (GET /auth/me), so a disabled account or a changed
// password closes the manual too. A guest session is another cookie and never passes.
// Not reachable from outside as anything more than a yes/no: the body is empty either way.
export async function GET() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value ?? null;
  try {
    const user = await getCurrentUser(token);
    const status = user && user.active !== false ? 204 : 401;
    return new NextResponse(null, { status, headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    // Backend down for a deploy: not "logged out" - nginx shows an error instead of the login page.
    if (e instanceof BackendUnavailableError) return new NextResponse(null, { status: 503 });
    throw e;
  }
}
