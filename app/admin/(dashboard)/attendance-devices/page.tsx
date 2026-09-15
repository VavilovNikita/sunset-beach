import Link from "next/link";
import { backendJson } from "@/lib/backendServer";
import { requireRoleAtLeast } from "@/lib/rbac";
import AttendanceDeviceManager from "@/components/admin/AttendanceDeviceManager";
import type { AttendanceDevice } from "@/lib/types";

// GET /attendance/devices is MANAGER+ on the backend with no lower-privilege read, same shape as
// AdminPrintersPage - the whole page redirects rather than rendering a degraded view.
export default async function AdminAttendanceDevicesPage() {
  await requireRoleAtLeast("MANAGER");

  const devices = await backendJson<AttendanceDevice[]>("/attendance/devices", { auth: true });

  return (
    <div>
      <p className="eyebrow text-sea mb-2">Staff</p>
      <h1 className="font-display italic text-3xl mb-8">Fingerprint terminals</h1>
      <p className="text-sm text-cream/60 mb-6 max-w-2xl">
        Each terminal is polled every few minutes for its attendance log - it never calls this app. Give every
        employee who punches one a matching enrollment number on their{" "}
        <Link href="/admin/users" className="text-sea hover:text-coral transition-colors underline underline-offset-4">
          user record
        </Link>{" "}
        first, or their punches won&rsquo;t be attributable to anyone. <span className="text-cream/80">Last heard from</span> is the one signal
        that tells a quiet stretch where nobody worked apart from a terminal that stopped reporting - a device that&rsquo;s gone
        more than a day without responding is flagged here. Use{" "}
        <span className="text-cream/80">Resync</span> to force an immediate full re-read instead of waiting for the next
        scheduled poll - useful right after registering a device, or if one was ever factory-reset.
      </p>
      <AttendanceDeviceManager initialDevices={devices} />
    </div>
  );
}
