import { redirect } from "next/navigation";
import UnifiedLoginForm from "@/components/UnifiedLoginForm";
import { loginGateDestination } from "@/lib/loginGate";
import { getSessionUser } from "@/lib/rbac";

// Already signed in as staff: go where a successful sign-in would have gone, before anything is drawn (no flash of the
// form). Only the staff session counts - a guest's cookie is a different identity (getSessionUser reads the staff
// cookie alone), and /guest/login is untouched. An expired or invalid token is simply "not signed in", and so is a
// backend that cannot be asked: the form is shown, never a redirect that could loop.
export default async function LoginPage({ searchParams }: { searchParams: { callbackUrl?: string } }) {
  let destination: string | null = null;
  try {
    destination = loginGateDestination(await getSessionUser(), searchParams.callbackUrl);
  } catch {
    destination = null;
  }
  if (destination) redirect(destination);
  return <UnifiedLoginForm />;
}
