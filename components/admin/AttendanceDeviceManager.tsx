"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ADMIN_API_URL } from "@/lib/backend";
import { createAttendanceDevice, updateAttendanceDevice, resyncAttendanceDevice, listAttendanceDevices } from "@/lib/attendanceDeviceClient";
import { usePolling } from "@/lib/usePolling";
import { isStale } from "@/lib/attendanceDeviceHealth";
import DeleteButton from "@/components/admin/DeleteButton";
import type { AttendanceDevice, AttendanceDeviceInput } from "@/lib/types";

const EMPTY_FORM: AttendanceDeviceInput = { name: "", serial: "", address: "", port: 4370, timezone: "Asia/Bangkok", active: true };

function LastSeenLabel({ lastSeenAt }: { lastSeenAt: string | null }) {
  if (lastSeenAt === null) {
    return <span className="text-amber-400">Never reached</span>;
  }
  const stale = isStale(lastSeenAt);
  return <span className={stale ? "text-coral" : "text-cream/60"}>Last heard from {new Date(lastSeenAt).toLocaleString()}</span>;
}

// Mirrors the backend's app.attendance.device-poll-interval-ms default (AttendanceDevicePollService).
// Not exposed by any API, so it's hardcoded here - change both together.
const POLL_INTERVAL_MS = 300_000;
// How far past the expected poll we wait before saying it's late rather than "due now". A poll
// itself takes a few seconds, and the list below refetches only every 30s.
const OVERDUE_GRACE_MS = 60_000;

// An estimate, not a schedule: the backend poll is fixedDelay (next attempt = interval after the
// previous one *finished*), and lastSeenAt only moves on a *successful* poll, so after a failed
// attempt the real next try is sooner than lastSeenAt + interval suggests. Hence the "~", and
// "overdue" rather than a negative countdown when the expected poll never landed.
function NextPollLabel({ lastSeenAt }: { lastSeenAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  usePolling(() => setNow(Date.now()), 1000);

  const remainingMs = new Date(lastSeenAt).getTime() + POLL_INTERVAL_MS - now;
  if (remainingMs < -OVERDUE_GRACE_MS) {
    return <span className="text-amber-400"> · next poll overdue (last attempt may have failed)</span>;
  }
  if (remainingMs <= 0) {
    return <span className="text-cream/40"> · next poll due now</span>;
  }
  const label =
    remainingMs >= 60_000 ? `~${Math.ceil(remainingMs / 60_000)}m` : `~${Math.max(10, Math.ceil(remainingMs / 10_000) * 10)}s`;
  return <span className="text-cream/40"> · next in {label}</span>;
}

// Set from what the device actually answered, never assumed - see the backend's
// AttendanceDevice.windowedReadUnsupported doc. Shown so a device that turns out not to support
// the windowed read doesn't just quietly read its whole log every poll forever unnoticed.
function WindowedReadUnsupportedBadge() {
  return (
    <span
      className="text-amber-400"
      title="This terminal rejected the windowed attendance-log read the last time it was tried, so every poll currently reads the entire log instead of just what's new."
    >
      · Full reads only (windowed read not supported)
    </span>
  );
}

function DeviceFields({ values, onChange }: { values: AttendanceDeviceInput; onChange: (values: AttendanceDeviceInput) => void }) {
  return (
    <div className="grid sm:grid-cols-6 gap-3 items-end">
      <div className="sm:col-span-2">
        <label className="eyebrow text-cream/60 block mb-1">Name</label>
        <input
          type="text"
          required
          minLength={1}
          maxLength={120}
          value={values.name}
          onChange={(e) => onChange({ ...values, name: e.target.value })}
          placeholder="e.g. Back Office Clock"
          className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm placeholder:text-cream/40 focus:outline-none focus:border-coral"
        />
      </div>
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Serial</label>
        <input
          type="text"
          required
          minLength={1}
          maxLength={120}
          value={values.serial}
          onChange={(e) => onChange({ ...values, serial: e.target.value })}
          placeholder="Printed on the unit"
          className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm placeholder:text-cream/40 focus:outline-none focus:border-coral"
        />
      </div>
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Address</label>
        <input
          type="text"
          required
          minLength={1}
          maxLength={255}
          value={values.address}
          onChange={(e) => onChange({ ...values, address: e.target.value })}
          placeholder="192.168.1.50"
          className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm placeholder:text-cream/40 focus:outline-none focus:border-coral"
        />
      </div>
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Port</label>
        <input
          type="number"
          required
          min={1}
          max={65535}
          value={values.port ?? 4370}
          onChange={(e) => onChange({ ...values, port: Number(e.target.value) })}
          className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral"
        />
      </div>
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Timezone</label>
        <input
          type="text"
          required
          minLength={1}
          maxLength={100}
          value={values.timezone}
          onChange={(e) => onChange({ ...values, timezone: e.target.value })}
          placeholder="Asia/Bangkok"
          className="w-full bg-transparent border-b border-cream/25 py-2 text-cream text-sm placeholder:text-cream/40 focus:outline-none focus:border-coral"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-cream/70 pb-2 sm:col-span-6">
        <input
          type="checkbox"
          checked={values.active ?? true}
          onChange={(e) => onChange({ ...values, active: e.target.checked })}
          className="accent-coral"
        />
        Active — polled every few minutes. Uncheck to stop polling a retired or replaced unit without losing its punch history.
      </label>
    </div>
  );
}

function ResyncButton({ deviceId, onResynced }: { deviceId: string; onResynced: (device: AttendanceDevice) => void }) {
  const [resyncing, setResyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleResync() {
    setResyncing(true);
    setError(null);

    const result = await resyncAttendanceDevice(deviceId);
    setResyncing(false);

    if (!result.ok) {
      setError(result.error);
      return;
    }
    onResynced(result.device);
    if (result.device.lastSeenAt === null) {
      setError("Reached out but the device didn't respond - check it's powered on and reachable.");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleResync}
        disabled={resyncing}
        title="Force a full re-read of this device's log, instead of waiting for the next scheduled poll"
        className="text-sm text-sea hover:text-coral transition-colors disabled:opacity-60"
      >
        {resyncing ? "Resyncing…" : "Resync"}
      </button>
      {error && <span className="text-xs text-coral max-w-[16rem] text-right">{error}</span>}
    </div>
  );
}

export default function AttendanceDeviceManager({ initialDevices }: { initialDevices: AttendanceDevice[] }) {
  const router = useRouter();
  const [devices, setDevices] = useState(initialDevices);
  // Keeps lastSeenAt current so NextPollLabel's countdown restarts after each real poll. Edit
  // forms hold their own values (editValues/newValues), so replacing the list never clobbers one.
  usePolling(async () => {
    const result = await listAttendanceDevices();
    if (result.ok) setDevices(result.devices);
  }, 30_000);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<AttendanceDeviceInput>(EMPTY_FORM);
  const [creating, setCreating] = useState(false);
  const [newValues, setNewValues] = useState<AttendanceDeviceInput>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEdit(device: AttendanceDevice) {
    setEditingId(device.id);
    setEditValues({
      name: device.name,
      serial: device.serial,
      address: device.address,
      port: device.port,
      timezone: device.timezone,
      active: device.active,
    });
    setError(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    const result = await createAttendanceDevice(newValues);

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDevices((prev) => [...prev, result.device]);
    setNewValues(EMPTY_FORM);
    setCreating(false);
    router.refresh();
  }

  async function handleSaveEdit(id: string) {
    setSubmitting(true);
    setError(null);

    const result = await updateAttendanceDevice(id, editValues);

    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setDevices((prev) => prev.map((d) => (d.id === id ? result.device : d)));
    setEditingId(null);
    router.refresh();
  }

  function handleResynced(device: AttendanceDevice) {
    setDevices((prev) => prev.map((d) => (d.id === device.id ? device : d)));
    router.refresh();
  }

  function handleDeleted(id: string) {
    setDevices((prev) => prev.filter((d) => d.id !== id));
    router.refresh();
  }

  return (
    <div className="max-w-4xl">
      {devices.length === 0 && <p className="text-cream/50 text-sm mb-4">No fingerprint terminals registered yet - add one below.</p>}

      <div className="space-y-2">
        {devices.map((device) =>
          editingId === device.id ? (
            <div key={device.id} className="bg-ink2/40 border border-cream/10 rounded-xl p-4 space-y-3">
              <DeviceFields values={editValues} onChange={setEditValues} />
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => handleSaveEdit(device.id)}
                  className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-60"
                >
                  {submitting ? "Saving…" : "Save"}
                </button>
                <button type="button" onClick={() => setEditingId(null)} className="text-sm text-cream/50 hover:text-cream transition-colors">
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div key={device.id} className="flex items-center gap-4 bg-ink2/40 border border-cream/10 rounded-xl p-4">
              <div className="flex-1 min-w-0">
                <p className="font-display text-lg">
                  {device.name}
                  {!device.active && <span className="ml-2 text-xs text-cream/40">· Inactive</span>}
                </p>
                <p className="text-sm text-cream/60">
                  {device.address}:{device.port} · {device.timezone}
                </p>
                <p className="text-xs mt-0.5">
                  <LastSeenLabel lastSeenAt={device.lastSeenAt} />
                  {device.active && device.lastSeenAt !== null && <NextPollLabel lastSeenAt={device.lastSeenAt} />}
                  {device.windowedReadUnsupported && <WindowedReadUnsupportedBadge />}
                </p>
              </div>
              <ResyncButton deviceId={device.id} onResynced={handleResynced} />
              <button type="button" onClick={() => startEdit(device)} className="text-sm text-sea hover:text-coral transition-colors">
                Edit
              </button>
              <DeleteButton
                url={`${ADMIN_API_URL}/attendance/devices/${device.id}`}
                confirmText={`Delete "${device.name}"? This can't be undone.`}
                conflictMessage={`"${device.name}" has recorded punches and can't be deleted. Deactivate it instead (Edit → uncheck Active) to stop polling it while keeping its history.`}
                onDeleted={() => handleDeleted(device.id)}
              />
            </div>
          )
        )}
      </div>

      <div className="mt-4">
        {creating ? (
          <form onSubmit={handleCreate} className="bg-ink2/40 border border-cream/10 rounded-xl p-4 space-y-3">
            <p className="eyebrow text-cream/60">New device</p>
            <DeviceFields values={newValues} onChange={setNewValues} />
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2 text-sm font-medium disabled:opacity-60"
              >
                {submitting ? "Registering…" : "Register device"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCreating(false);
                  setNewValues(EMPTY_FORM);
                  setError(null);
                }}
                className="text-sm text-cream/50 hover:text-cream transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setCreating(true)}
            className="rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 py-2.5 text-sm font-medium"
          >
            New device
          </button>
        )}
      </div>

      {error && <p className="text-sm text-coral mt-3">{error}</p>}
    </div>
  );
}
