"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { loadLightingDevices, setLightingState } from "@/lib/lightingClient";
import {
  brightnessChanged,
  brightnessToPercent,
  cardControls,
  percentToBrightness,
  powerLabel,
  presetOptions,
  presetSelectValue,
} from "@/lib/lighting";
import { formatTimestampTime } from "@/lib/formatDate";
import { usePolling } from "@/lib/usePolling";
import type { LightingDevice, LightingDeviceList, LightingStateInput } from "@/lib/types";
import LightingSetupBanner from "@/components/admin/LightingSetupBanner";

// Every control is at least 44px, like the Gym page: this is used from a tablet at the front desk.
const TOUCH = "min-h-[44px]";
const CARD = "bg-ink2/40 border border-cream/10 rounded-xl p-4";

function LightingCard({
  device,
  busy,
  error,
  onSend,
}: {
  device: LightingDevice;
  busy: boolean;
  error: string | null;
  // Resolves true when the controller took the command.
  onSend: (input: LightingStateInput) => Promise<boolean>;
}) {
  const controls = cardControls(device, busy);
  const [percent, setPercent] = useState(() => brightnessToPercent(device.brightness ?? 0));

  // Follows what the controller reports (after a command or a refresh) - and only that: while the
  // thumb is being dragged the draft is the person's, not the device's.
  useEffect(() => {
    setPercent(brightnessToPercent(device.brightness ?? 0));
  }, [device.brightness, device.stateReadAt]);

  // Sent when the slider is released (pointer up, or a key press for the keyboard), never while it moves.
  async function release() {
    if (!controls.brightness || !brightnessChanged(device.brightness, percent)) return;
    const ok = await onSend({ brightness: percentToBrightness(percent) });
    // A refused command leaves the card as it was - the thumb goes back with it.
    if (!ok) setPercent(brightnessToPercent(device.brightness ?? 0));
  }

  const status = powerLabel(device);
  const statusColor = !device.online || device.isOn === undefined ? "text-amber-400" : device.isOn ? "text-sea" : "text-cream/60";
  const on = device.isOn === true;

  return (
    <div className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-display text-lg break-words">{device.name}</p>
          {device.location && <p className="text-xs text-cream/50 break-words">{device.location}</p>}
        </div>
        <span className={`text-sm shrink-0 ${statusColor}`}>{status}</span>
      </div>
      {device.stateError && <p className="text-xs text-amber-400 mt-1">{device.stateError}</p>}

      <div className="mt-3">
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={`${device.name}: ${on ? "turn off" : "turn on"}`}
          disabled={!controls.power}
          onClick={() => onSend({ isOn: !on })}
          className={`${TOUCH} w-full rounded-full border px-5 text-sm font-medium transition-colors disabled:opacity-50 ${
            on ? "bg-coral border-coral text-cream" : "border-cream/25 text-cream/80 hover:border-coral"
          }`}
        >
          {on ? "Turn off" : "Turn on"}
        </button>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between">
          <label htmlFor={`bri-${device.id}`} className="eyebrow text-cream/60">
            Brightness
          </label>
          <span className="text-sm text-cream/70" aria-live="polite">
            {controls.brightness || device.brightness !== undefined ? `${percent} %` : "—"}
          </span>
        </div>
        <input
          id={`bri-${device.id}`}
          type="range"
          min={0}
          max={100}
          step={1}
          value={percent}
          disabled={!controls.brightness}
          onChange={(e) => setPercent(Number(e.target.value))}
          onPointerUp={release}
          onKeyUp={release}
          className={`${TOUCH} w-full accent-coral disabled:opacity-50`}
        />
      </div>

      <div className="mt-3">
        <label htmlFor={`preset-${device.id}`} className="eyebrow text-cream/60 block mb-1">
          Preset
        </label>
        <select
          id={`preset-${device.id}`}
          value={presetSelectValue(device)}
          disabled={!controls.preset}
          onChange={(e) => {
            if (e.target.value !== "") onSend({ presetId: Number(e.target.value) });
          }}
          className={`${TOUCH} w-full bg-ink border-b border-cream/25 py-2 text-cream text-sm focus:outline-none focus:border-coral disabled:opacity-50`}
        >
          <option value="" disabled>
            {device.presets.length === 0 ? "No presets on this controller" : "No preset applied"}
          </option>
          {presetOptions(device).map((p) => (
            <option key={p.id} value={String(p.id)}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {busy && <p className="text-xs text-cream/50 mt-2">Sending the command…</p>}
      {error && <p className="text-sm text-coral mt-2">{error}</p>}
    </div>
  );
}

export default function LightingBoard({ initial, isAdmin }: { initial: LightingDeviceList; isAdmin: boolean }) {
  const [configured, setConfigured] = useState(initial.configured);
  const [devices, setDevices] = useState<LightingDevice[]>(initial.devices);
  const [fetchedAt, setFetchedAt] = useState(initial.fetchedAt);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  function setBusy(id: string, busy: boolean) {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  // Each command updates only its own card from the device the server answers with; a failure stays
  // on that card, next to the control, and the card keeps its last state.
  async function send(id: string, input: LightingStateInput): Promise<boolean> {
    setBusy(id, true);
    setErrors((prev) => ({ ...prev, [id]: null }));
    const result = await setLightingState(id, input);
    setBusy(id, false);
    if (!result.ok) {
      setErrors((prev) => ({ ...prev, [id]: result.error }));
      return false;
    }
    setDevices((prev) => prev.map((d) => (d.id === id ? result.data : d)));
    return true;
  }

  async function reload(refresh: boolean) {
    setRefreshing(true);
    setRefreshError(null);
    const result = await loadLightingDevices(refresh);
    setRefreshing(false);
    if (!result.ok) {
      setRefreshError(result.error);
      return;
    }
    setConfigured(result.data.configured);
    setDevices(result.data.devices);
    setFetchedAt(result.data.fetchedAt);
    setErrors({});
  }

  // No timer: the page is read when it is opened, when Refresh is pressed, after a command and when the
  // tab comes back into view (hidden for a while, or restored from the back/forward cache). Not while a
  // command is in flight - its answer would be overwritten by an older read.
  usePolling(
    () => {
      if (busyIds.size === 0 && !refreshing) void reload(false);
    },
    0,
    configured
  );

  if (!configured) return <LightingSetupBanner isAdmin={isAdmin} />;

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => reload(true)}
          disabled={refreshing || busyIds.size > 0}
          className={`${TOUCH} rounded-full bg-coral hover:bg-coraldeep transition-colors px-6 text-sm font-medium disabled:opacity-60`}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
        <span className="text-xs text-cream/50">State read at {formatTimestampTime(fetchedAt)}. The page does not refresh by itself.</span>
        {isAdmin && (
          <Link href="/admin/lighting/settings" className={`${TOUCH} inline-flex items-center ml-auto text-sm text-sea hover:text-coral transition-colors underline underline-offset-4`}>
            Controller settings
          </Link>
        )}
      </div>
      {refreshError && <p className="text-sm text-coral mb-4">{refreshError}</p>}

      {devices.length === 0 && (
        <p className="text-cream/60 text-sm">
          No controllers added yet.{isAdmin ? " Add them in the controller settings." : " Ask an administrator to add them."}
        </p>
      )}

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {devices.map((d) => (
          <LightingCard key={d.id} device={d} busy={busyIds.has(d.id) || refreshing} error={errors[d.id] ?? null} onSend={(input) => send(d.id, input)} />
        ))}
      </div>
    </div>
  );
}
