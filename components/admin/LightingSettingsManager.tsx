"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import {
  checkLightingDevice,
  createLightingDeviceConfig,
  deleteLightingDeviceConfig,
  reorderLightingDeviceConfigs,
  updateLightingDeviceConfig,
} from "@/lib/lightingClient";
import { diffUpdate, parsePort, settingsFieldError, valuesOf, type SettingsFieldError, type SettingsValues } from "@/lib/lighting";
import { moveId } from "@/lib/gym";
import type { LightingDeviceCheckResult, LightingDeviceConfig } from "@/lib/types";

// Touch targets of at least 44px, like the Lighting page itself.
const TOUCH = "min-h-[44px]";
const CARD = "bg-ink2/40 border border-cream/10 rounded-xl p-4";
const INPUT = "w-full min-h-[44px] bg-transparent border-b border-cream/25 py-2 text-cream text-sm placeholder:text-cream/40 focus:outline-none focus:border-coral disabled:opacity-50";
const PRIMARY = `${TOUCH} rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 text-sm font-medium disabled:opacity-60`;
const SECONDARY = `${TOUCH} rounded-full border border-cream/25 hover:border-coral px-5 text-sm transition-colors disabled:opacity-50`;
const LINK = `${TOUCH} min-w-[44px] px-2 text-sm text-sea hover:text-coral transition-colors disabled:opacity-40`;

const EMPTY: SettingsValues = { name: "", host: "", port: "80", location: "", active: true };

type FieldErrors = Partial<Record<SettingsFieldError["field"], string>>;

function FieldError({ message }: { message?: string }) {
  return message ? <p className="text-xs text-coral mt-1">{message}</p> : null;
}

function checkSummary(result: LightingDeviceCheckResult): string {
  if (!result.reachable || !result.info) return result.error ?? "The controller did not answer.";
  const { name, version, ledCount, mac } = result.info;
  return `Reachable: “${name || "unnamed"}” · WLED ${version} · ${ledCount} LEDs · MAC ${mac || "unknown"}`;
}

// One form for adding and for editing. `configured` false (the server has no allowed subnet): the
// address of a saved controller can't be changed and nothing can be checked, but name, location and
// visibility still can - the server answers 409 for the rest, so the form doesn't offer it.
function ControllerForm({
  initial,
  mode,
  configured,
  onSubmit,
  onCancel,
}: {
  initial: SettingsValues;
  mode: "add" | "edit";
  configured: boolean;
  onSubmit: (values: SettingsValues) => Promise<SettingsFieldError | null>;
  onCancel: () => void;
}) {
  const [values, setValues] = useState(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [checkResult, setCheckResult] = useState<LightingDeviceCheckResult | null>(null);

  function set<K extends keyof SettingsValues>(key: K, value: SettingsValues[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    // What was checked is the address that was typed then.
    if (key === "host" || key === "port") setCheckResult(null);
    setErrors((e) => ({ ...e, [key]: undefined, form: undefined }));
  }

  async function check() {
    const port = parsePort(values.port);
    if (!values.host.trim()) {
      setErrors({ host: "Enter the controller's address" });
      return;
    }
    if (port === null) {
      setErrors({ port: "The port is a number from 1 to 65535" });
      return;
    }
    setChecking(true);
    setErrors({});
    setCheckResult(null);
    const result = await checkLightingDevice({ host: values.host.trim(), port });
    setChecking(false);
    if (!result.ok) {
      const e = settingsFieldError(result.status, result.error, result.body);
      setErrors({ [e.field]: e.message });
      return;
    }
    setCheckResult(result.data);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const next: FieldErrors = {};
    if (!values.name.trim()) next.name = "Enter a name";
    if (!values.host.trim()) next.host = "Enter the controller's address";
    if (parsePort(values.port) === null) next.port = "The port is a number from 1 to 65535";
    if (Object.keys(next).length > 0) {
      setErrors(next);
      return;
    }
    setSaving(true);
    setErrors({});
    const failure = await onSubmit(values);
    setSaving(false);
    if (failure) setErrors({ [failure.field]: failure.message });
  }

  const addressLocked = mode === "edit" && !configured;

  return (
    <form onSubmit={submit} className={`${CARD} space-y-3`}>
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Name</label>
        <input type="text" maxLength={120} value={values.name} onChange={(e) => set("name", e.target.value)} className={INPUT} />
        <FieldError message={errors.name} />
      </div>
      <div className="grid sm:grid-cols-[1fr_8rem] gap-3">
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Address (IP)</label>
          <input
            type="text"
            inputMode="decimal"
            maxLength={253}
            autoComplete="off"
            value={values.host}
            disabled={addressLocked}
            onChange={(e) => set("host", e.target.value)}
            placeholder="192.168.1.50"
            className={INPUT}
          />
          <FieldError message={errors.host} />
        </div>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Port</label>
          <input type="text" inputMode="numeric" maxLength={5} value={values.port} disabled={addressLocked} onChange={(e) => set("port", e.target.value)} className={INPUT} />
          <FieldError message={errors.port} />
        </div>
      </div>
      {addressLocked && <p className="text-xs text-cream/50">The address can&rsquo;t be changed while lighting is not configured on the server.</p>}
      <div>
        <label className="eyebrow text-cream/60 block mb-1">Location (optional)</label>
        <input type="text" maxLength={200} value={values.location} onChange={(e) => set("location", e.target.value)} placeholder="Pool bar, roof" className={INPUT} />
      </div>
      <label className={`${TOUCH} flex items-center gap-2 text-sm text-cream/70`}>
        <input type="checkbox" checked={values.active} onChange={(e) => set("active", e.target.checked)} className="accent-coral w-5 h-5" />
        Show on the Lighting page
      </label>

      {configured && (
        <div>
          <button type="button" disabled={checking || saving} onClick={check} className={SECONDARY}>
            {checking ? "Checking…" : "Check connection"}
          </button>
          <p className="text-xs text-cream/50 mt-1">Asks the controller at this address who it is - nothing is saved.</p>
          {checkResult && (
            <p role="status" className={`text-sm mt-2 ${checkResult.reachable ? "text-sea" : "text-amber-400"}`}>
              {checkSummary(checkResult)}
            </p>
          )}
        </div>
      )}

      <div className="flex gap-3 items-center">
        <button type="submit" disabled={saving} className={PRIMARY}>
          {saving ? "Saving…" : mode === "add" ? "Add" : "Save"}
        </button>
        <button type="button" disabled={saving} onClick={onCancel} className={`${TOUCH} px-3 text-sm text-cream/50 hover:text-cream transition-colors`}>
          Cancel
        </button>
      </div>
      <FieldError message={errors.form} />
    </form>
  );
}

function ConfigRow({
  config,
  index,
  total,
  busy,
  configured,
  onMove,
  onUpdated,
  onDeleted,
}: {
  config: LightingDeviceConfig;
  index: number;
  total: number;
  busy: boolean;
  configured: boolean;
  onMove: (step: -1 | 1) => void;
  onUpdated: (config: LightingDeviceConfig) => void;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function toggleActive() {
    setToggling(true);
    setError(null);
    const result = await updateLightingDeviceConfig(config.id, { active: !config.active });
    setToggling(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onUpdated(result.data);
  }

  async function remove() {
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteLightingDeviceConfig(config.id);
    setDeleting(false);
    if (!result.ok) {
      setDeleteError(result.error);
      return;
    }
    setConfirmingDelete(false);
    onDeleted();
  }

  async function save(values: SettingsValues): Promise<SettingsFieldError | null> {
    const diff = diffUpdate(config, values);
    if (Object.keys(diff).length === 0) {
      setEditing(false);
      return null;
    }
    const result = await updateLightingDeviceConfig(config.id, diff);
    if (!result.ok) return settingsFieldError(result.status, result.error, result.body);
    onUpdated(result.data);
    setEditing(false);
    return null;
  }

  if (editing) {
    return <ControllerForm mode="edit" configured={configured} initial={valuesOf(config)} onSubmit={save} onCancel={() => setEditing(false)} />;
  }

  return (
    <div className={CARD}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <div className="flex-1 min-w-[12rem]">
          <p className="font-display text-lg break-words">
            {config.name}
            {!config.active && <span className="ml-2 text-xs text-cream/40">· hidden</span>}
          </p>
          <p className="text-xs text-cream/50 break-all">
            {config.host}:{config.port}
            {config.location ? ` · ${config.location}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" aria-label="Move up" disabled={busy || index === 0} onClick={() => onMove(-1)} className={LINK}>
            ↑
          </button>
          <button type="button" aria-label="Move down" disabled={busy || index === total - 1} onClick={() => onMove(1)} className={LINK}>
            ↓
          </button>
          <button type="button" disabled={busy || toggling} onClick={toggleActive} className={LINK}>
            {config.active ? "Hide" : "Show"}
          </button>
          <button type="button" disabled={busy} onClick={() => setEditing(true)} className={LINK}>
            Edit
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirmingDelete(true)} className={`${LINK} text-coral`}>
            Delete
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-coral mt-2">{error}</p>}
      {confirmingDelete && (
        <ConfirmDialog
          eyebrow="Delete"
          title={`Delete "${config.name}" from the Lighting page? Its audit-log entries stay.`}
          confirmLabel="Delete"
          busyLabel="Deleting…"
          backLabel="Cancel"
          busy={deleting}
          error={deleteError}
          onConfirm={remove}
          onBack={() => {
            setConfirmingDelete(false);
            setDeleteError(null);
          }}
        />
      )}
    </div>
  );
}

export default function LightingSettingsManager({ initialConfigs, configured }: { initialConfigs: LightingDeviceConfig[]; configured: boolean }) {
  const [configs, setConfigs] = useState(initialConfigs);
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);

  async function handleMove(id: string, step: -1 | 1) {
    const ids = moveId(configs.map((c) => c.id), id, step);
    setReordering(true);
    setError(null);
    const result = await reorderLightingDeviceConfigs(ids);
    setReordering(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConfigs(result.data);
  }

  async function handleAdd(values: SettingsValues): Promise<SettingsFieldError | null> {
    const port = parsePort(values.port) ?? 80;
    const location = values.location.trim();
    const result = await createLightingDeviceConfig({
      name: values.name.trim(),
      host: values.host.trim(),
      port,
      ...(location ? { location } : {}),
      active: values.active,
    });
    if (!result.ok) return settingsFieldError(result.status, result.error, result.body);
    setConfigs((prev) => [...prev, result.data]);
    setAdding(false);
    return null;
  }

  return (
    <div className="max-w-4xl">
      <h2 className="eyebrow text-cream/60 mb-3">Controllers on the Lighting page</h2>
      {configs.length === 0 && <p className="text-sm text-cream/60 mb-3">Nothing added yet.</p>}
      <div className="space-y-2">
        {configs.map((c, i) => (
          <ConfigRow
            key={c.id}
            config={c}
            index={i}
            total={configs.length}
            busy={reordering}
            configured={configured}
            onMove={(step) => handleMove(c.id, step)}
            onUpdated={(updated) => setConfigs((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))}
            onDeleted={() => setConfigs((prev) => prev.filter((x) => x.id !== c.id))}
          />
        ))}
      </div>
      {error && <p className="text-sm text-coral mt-2">{error}</p>}

      <h2 className="eyebrow text-cream/60 mt-8 mb-3">New controller</h2>
      {!configured ? (
        <p className="text-sm text-cream/60">Adding is switched off until the server&rsquo;s allowed subnet is set.</p>
      ) : adding ? (
        <ControllerForm mode="add" configured initial={EMPTY} onSubmit={handleAdd} onCancel={() => setAdding(false)} />
      ) : (
        <div>
          <button type="button" onClick={() => setAdding(true)} className={PRIMARY}>
            Add a controller
          </button>
          <p className="text-xs text-cream/50 mt-2">
            The address must be inside the hotel network the server allows; use “Check connection” before saving.
          </p>
        </div>
      )}
    </div>
  );
}
