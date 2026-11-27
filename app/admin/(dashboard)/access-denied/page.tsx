import Link from "next/link";
import { requireSessionUser } from "@/lib/rbac";
import { staffHomeLink } from "@/lib/staffLanding";

// Where requireRoleAtLeast/requireAdminUser send a signed-in user who hit a gate above their
// role, instead of the old default (a bare redirect to /admin) - for a WAITER that landed on
// AdminDashboardPage's own "forbidden" gap (every figure there needs CASHIER+), which reads
// exactly like a broken page to someone who doesn't already know why. This explains what
// happened and points at a page that actually has something on it for their role.
export default async function AccessDeniedPage() {
  const user = await requireSessionUser();
  const home = staffHomeLink(user.role, user.functions);

  return (
    <div className="max-w-md">
      <p className="eyebrow text-sea mb-2">Access</p>
      <h1 className="font-display italic text-3xl mb-4">Not available for your role</h1>
      <p className="text-sm text-cream/60 mb-8">
        You&rsquo;re signed in as <span className="text-cream">{user.role}</span>. This section needs a
        higher role than that - nothing went wrong, this just isn&rsquo;t a page for you.
      </p>
      <Link
        href={home.href}
        className="inline-block rounded-full bg-coral hover:bg-coraldeep transition-colors px-6 py-2.5 text-sm font-medium"
      >
        {home.label}
      </Link>
    </div>
  );
}
