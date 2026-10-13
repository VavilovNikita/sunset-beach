"use client";

import { useState } from "react";
import Link from "next/link";
import { loadGymDevices, sendGymAcCommand, setGymRelay } from "@/lib/gymClient";
import {
  AC_MODES,
  AC_TEMP_MAX,
  AC_TEMP_MIN,
  AC_WINDS,
  acCommand,
  clampTemp,
  initialAcSetting,
  lastCommandCaption,
  lastKnownOn,
  sameSetting,
  type AcSetting,
} from "@/lib/gym";
import { formatTimestampTime } from "@/lib/formatDate";
import type { GymDevice, GymDeviceList } from "@/lib/types";

// Every control is at least 44px: this page is used from a phone at the gym.
const TOUCH = "min-h-[44px]";
const CARD = "bg-ink2/40 border border-cream/10 rounded-xl p-4";

function chip(active: boolean) {
  return `${TOUCH} min-w-[44px] px-3 rounded-full border text-sm transition-colors disabled:opacity-50 ${
    active ? "bg-coral border-coral text-cream" : "border-cream/25 text-cream/80 hover:border-coral"
  }`;
}

function RelayCard({
  device,
  busy,
  error,
  onSet,
}: {
  device: GymDevice;
  busy: boolean;
  error: string | null;
  onSet: (isOn: boolean) => void;
}) {
  const known = device.isOn === true || device.isOn === false;
  const statusText = known ? (device.isOn ? "On" : "Off") : "State unknown";
  const statusColor = !known ? "text-amber-400" : device.isOn ? "text-sea" : "text-cream/60";
  return (
    <div className={CARD}>
      <div className="flex items-start justify-between gap-3">
        <p className="font-display text-lg break-words min-w-0">{device.name}</p>
        <span className={`text-sm shrink-0 ${statusColor}`}>{statusText}</span>
      </div>
      {device.online === false && <p className="text-xs text-amber-400 mt-1">Device is offline</p>}
      {device.stateError && <p className="text-xs text-amber-400 mt-1">{device.stateError}</p>}
      <div className="grid grid-cols-2 gap-2 mt-3" role="group" aria-label={`${device.name}: power`}>
        <button
          type="button"
          disabled={busy || device.isOn === true}
          aria-pressed={device.isOn === true}
          onClick={() => onSet(true)}
          className={`${chip(device.isOn === true)} w-full`}
        >
          Turn on
        </button>
        <button
          type="button"
          disabled={busy || device.isOn === false}
          aria-pressed={device.isOn === false}
          onClick={() => onSet(false)}
          className={`${chip(device.isOn === false)} w-full`}
        >
          Turn off
        </button>
      </div>
      {busy && <p className="text-xs text-cream/50 mt-2">Sending the command…</p>}
      {error && <p className="text-sm text-coral mt-2">{error}</p>}
    </div>
  );
}

function AcCard({
  device,
  busy,
  error,
  onSend,
}: {
  device: GymDevice;
  busy: boolean;
  error: string | null;
  onSend: (power: 0 | 1, setting: AcSetting) => void;
}) {
  // The controls edit a draft; nothing is sent until a button says so, so a few taps on "+" are one
  // command, not five (each one is a Tuya call and the unit beeps for every one).
  const [draft, setDraft] = useState<AcSetting>(() => initialAcSetting(device));
  const sent = initialAcSetting(device);
  const on = lastKnownOn(device);
  const changed = !sameSetting(draft, sent);

  return (
    <div className={CARD}>
      <p className="font-display text-lg break-words">{device.name}</p>
      <p className="text-xs text-cream/60 mt-1">{lastCommandCaption(device.lastCommand)}</p>
      <p className="text-xs text-cream/40 mt-0.5">
        The infrared link is one-way: the real state of the air conditioner is unknown, the last command sent is shown.
      </p>

      <p className="eyebrow text-cream/60 mt-4 mb-1">Mode</p>
      <div className="flex flex-wrap gap-2">
        {AC_MODES.map((m) => (
          <button key={m.value} type="button" disabled={busy} aria-pressed={draft.mode === m.value} onClick={() => setDraft({ ...draft, mode: m.value })} className={chip(draft.mode === m.value)}>
            {m.label}
          </button>
        ))}
      </div>

      <p className="eyebrow text-cream/60 mt-4 mb-1">Temperature</p>
      <div className="flex items-center gap-3">
        <button
          type="button"
          aria-label="Lower temperature"
          disabled={busy || draft.temp <= AC_TEMP_MIN}
          onClick={() => setDraft({ ...draft, temp: clampTemp(draft.temp - 1) })}
          className={`${chip(false)} w-11 text-xl leading-none`}
        >
          −
        </button>
        <span className="text-2xl font-display w-16 text-center" aria-live="polite">
          {draft.temp}°
        </span>
        <button
          type="button"
          aria-label="Higher temperature"
          disabled={busy || draft.temp >= AC_TEMP_MAX}
          onClick={() => setDraft({ ...draft, temp: clampTemp(draft.temp + 1) })}
          className={`${chip(false)} w-11 text-xl leading-none`}
        >
          +
        </button>
      </div>

      <p className="eyebrow text-cream/60 mt-4 mb-1">Fan speed</p>
      <div className="flex flex-wrap gap-2">
        {AC_WINDS.map((w) => (
          <button key={w.value} type="button" disabled={busy} aria-pressed={draft.wind === w.value} onClick={() => setDraft({ ...draft, wind: w.value })} className={chip(draft.wind === w.value)}>
            {w.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 mt-4">
        {on ? (
          <>
            <button
              type="button"
              disabled={busy}
              onClick={() => onSend(0, sent)}
              className={`${TOUCH} rounded-full border border-cream/25 hover:border-coral px-5 text-sm transition-colors disabled:opacity-50`}
            >
              Turn off
            </button>
            {changed && (
              <button
                type="button"
                disabled={busy}
                onClick={() => onSend(1, draft)}
                className={`${TOUCH} rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 text-sm font-medium disabled:opacity-50`}
              >
                Send changes
              </button>
            )}
          </>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => onSend(1, draft)}
            className={`${TOUCH} rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 text-sm font-medium disabled:opacity-50`}
          >
            Turn on
          </button>
        )}
      </div>
      {!on && changed && <p className="text-xs text-cream/50 mt-2">The settings are sent when you turn it on.</p>}
      {busy && <p className="text-xs text-cream/50 mt-2">Sending the command…</p>}
      {error && <p className="text-sm text-coral mt-2">{error}</p>}
    </div>
  );
}

export default function GymBoard({ initial, isAdmin }: { initial: GymDeviceList; isAdmin: boolean }) {
  const [devices, setDevices] = useState<GymDevice[]>(initial.devices);
  const [fetchedAt, setFetchedAt] = useState(initial.fetchedAt);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<ReadonlySet<string>>(new Set());
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  function replace(updated: GymDevice) {
    setDevices((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
  }

  function setBusy(id: string, busy: boolean) {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (busy) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function run(id: string, request: () => ReturnType<typeof setGymRelay>) {
    setBusy(id, true);
    setErrors((prev) => ({ ...prev, [id]: null }));
    const result = await request();
    setBusy(id, false);
    if (!result.ok) {
      setErrors((prev) => ({ ...prev, [id]: result.error }));
      return;
    }
    replace(result.data);
  }

  async function handleRefresh() {
    setRefreshing(true);
    setRefreshError(null);
    const result = await loadGymDevices(true);
    setRefreshing(false);
    if (!result.ok) {
      setRefreshError(result.error);
      return;
    }
    setDevices(result.data.devices);
    setFetchedAt(result.data.fetchedAt);
    setErrors({});
  }

  const relays = devices.filter((d) => d.type === "RELAY");
  const acs = devices.filter((d) => d.type === "AC_IR");

  return (
    <div className="max-w-5xl">
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          className={`${TOUCH} rounded-full bg-coral hover:bg-coraldeep transition-colors px-6 text-sm font-medium disabled:opacity-60`}
        >
          {refreshing ? "Refreshing…" : "Refresh"}
        </button>
        <span className="text-xs text-cream/50">State read at {formatTimestampTime(fetchedAt)}. The page does not refresh by itself.</span>
        {isAdmin && (
          <Link href="/admin/gym/settings" className={`${TOUCH} inline-flex items-center ml-auto text-sm text-sea hover:text-coral transition-colors underline underline-offset-4`}>
            Device settings
          </Link>
        )}
      </div>
      {refreshError && <p className="text-sm text-coral mb-4">{refreshError}</p>}

      {devices.length === 0 && (
        <p className="text-cream/60 text-sm">
          No devices added yet.{isAdmin ? " Add them in the device settings." : " Ask an administrator to add them."}
        </p>
      )}

      {relays.length > 0 && (
        <section className="mb-8">
          <h2 className="eyebrow text-cream/60 mb-3">Fans</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {relays.map((d) => (
              <RelayCard
                key={d.id}
                device={d}
                busy={busyIds.has(d.id) || refreshing}
                error={errors[d.id] ?? null}
                onSet={(isOn) => run(d.id, () => setGymRelay(d.id, isOn))}
              />
            ))}
          </div>
        </section>
      )}

      {acs.length > 0 && (
        <section className="mb-8">
          <h2 className="eyebrow text-cream/60 mb-3">Air conditioners</h2>
          <div className="grid sm:grid-cols-2 gap-4">
            {acs.map((d) => (
              <AcCard
                key={d.id}
                device={d}
                busy={busyIds.has(d.id) || refreshing}
                error={errors[d.id] ?? null}
                onSend={(power, setting) => run(d.id, () => sendGymAcCommand(d.id, acCommand(power, setting)))}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
