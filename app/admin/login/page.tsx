import { redirect } from "next/navigation";
import { loginHref } from "@/lib/loginRedirect";

// There is one login page, /login. Old links and bookmarks to /admin/login (and the redirects older builds
// issued) land here and move on, keeping the deep link they carried.
export default function AdminLoginRedirect({ searchParams }: { searchParams: { callbackUrl?: string } }) {
  redirect(loginHref(searchParams.callbackUrl));
}
