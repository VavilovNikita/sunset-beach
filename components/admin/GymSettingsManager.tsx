"use client";

import { useState } from "react";
import ConfirmDialog from "@/components/admin/ConfirmDialog";
import {
  createGymDeviceConfig,
  deleteGymDeviceConfig,
  loadTuyaDevices,
  loadTuyaRemotes,
  loadTuyaSwitchCodes,
  reorderGymDeviceConfigs,
  updateGymDeviceConfig,
} from "@/lib/gymClient";
import { defaultTypeForCategory, formatCalls, isIrHub, moveId } from "@/lib/gym";
import type { GymDeviceConfig, GymDeviceConfigInput, GymDeviceType, GymTuyaUsage, TuyaDiscoveredDevice, TuyaRemote } from "@/lib/types";

// Touch targets of at least 44px, like the Gym page itself.
const TOUCH = "min-h-[44px]";
const CARD = "bg-ink2/40 border border-cream/10 rounded-xl p-4";
const INPUT = "w-full min-h-[44px] bg-transparent border-b border-cream/25 py-2 text-cream text-sm placeholder:text-cream/40 focus:outline-none focus:border-coral";
const PRIMARY = `${TOUCH} rounded-full bg-coral hover:bg-coraldeep transition-colors px-5 text-sm font-medium disabled:opacity-60`;
const LINK = `${TOUCH} min-w-[44px] px-2 text-sm text-sea hover:text-coral transition-colors disabled:opacity-40`;

const TYPE_LABEL: Record<GymDeviceType, string> = { RELAY: "Реле (вентилятор)", AC_IR: "Кондиционер (ИК)" };

function toInput(c: GymDeviceConfig, patch: Partial<GymDeviceConfigInput> = {}): GymDeviceConfigInput {
  return {
    name: c.name,
    type: c.type,
    tuyaDeviceId: c.tuyaDeviceId,
    infraredId: c.infraredId ?? undefined,
    remoteId: c.remoteId ?? undefined,
    switchCode: c.switchCode ?? undefined,
    active: c.active,
    ...patch,
  };
}

function UsageCard({ usage }: { usage: GymTuyaUsage | null }) {
  if (!usage) return <p className="text-sm text-amber-400 mb-6">Счётчик вызовов Tuya сейчас недоступен.</p>;
  return (
    <div className={`${CARD} mb-6`}>
      <p className="eyebrow text-cream/60 mb-1">Вызовы Tuya в этом месяце ({usage.month})</p>
      <p className="font-display text-2xl">
        {formatCalls(usage.calls)} <span className="text-base text-cream/50">из ~{formatCalls(usage.quotaHint)}</span>
      </p>
      <p className="text-xs text-cream/50 mt-1">
        Пробная версия Tuya отключается до конца месяца, когда квота исчерпана. Автоматического опроса нет: вызовы тратятся только при открытии страницы,
        нажатии «Обновить» и отправке команд. Счётчик обновляется при загрузке этой страницы.
      </p>
    </div>
  );
}

function ConfigRow({
  config,
  index,
  total,
  busy,
  onMove,
  onSave,
  onDeleted,
}: {
  config: GymDeviceConfig;
  index: number;
  total: number;
  busy: boolean;
  onMove: (step: -1 | 1) => void;
  onSave: (input: GymDeviceConfigInput) => Promise<string | null>;
  onDeleted: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [values, setValues] = useState<GymDeviceConfigInput>(toInput(config));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function remove() {
    setDeleting(true);
    setDeleteError(null);
    const result = await deleteGymDeviceConfig(config.id);
    setDeleting(false);
    if (!result.ok) {
      setDeleteError(result.error);
      return;
    }
    setConfirmingDelete(false);
    onDeleted();
  }

  async function save(input: GymDeviceConfigInput) {
    setSaving(true);
    setError(null);
    const message = await onSave(input);
    setSaving(false);
    if (message) setError(message);
    else setEditing(false);
  }

  if (editing) {
    return (
      <div className={`${CARD} space-y-3`}>
        <div>
          <label className="eyebrow text-cream/60 block mb-1">Название</label>
          <input type="text" required maxLength={120} value={values.name} onChange={(e) => setValues({ ...values, name: e.target.value })} className={INPUT} />
        </div>
        {config.type === "RELAY" ? (
          <div>
            <label className="eyebrow text-cream/60 block mb-1">Код переключателя</label>
            <input type="text" required maxLength={64} value={values.switchCode ?? ""} onChange={(e) => setValues({ ...values, switchCode: e.target.value })} className={INPUT} />
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-3">
            <div>
              <label className="eyebrow text-cream/60 block mb-1">ИК-хаб (id)</label>
              <input type="text" required maxLength={64} value={values.infraredId ?? ""} onChange={(e) => setValues({ ...values, infraredId: e.target.value })} className={INPUT} />
            </div>
            <div>
              <label className="eyebrow text-cream/60 block mb-1">Пульт (id)</label>
              <input type="text" maxLength={64} value={values.remoteId ?? ""} onChange={(e) => setValues({ ...values, remoteId: e.target.value })} className={INPUT} />
            </div>
          </div>
        )}
        <label className={`${TOUCH} flex items-center gap-2 text-sm text-cream/70`}>
          <input type="checkbox" checked={values.active ?? true} onChange={(e) => setValues({ ...values, active: e.target.checked })} className="accent-coral w-5 h-5" />
          Показывать на странице Gym
        </label>
        <div className="flex gap-3 items-center">
          <button type="button" disabled={saving} onClick={() => save(values)} className={PRIMARY}>
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              setEditing(false);
              setValues(toInput(config));
              setError(null);
            }}
            className={`${TOUCH} px-3 text-sm text-cream/50 hover:text-cream transition-colors`}
          >
            Отмена
          </button>
        </div>
        {error && <p className="text-sm text-coral">{error}</p>}
      </div>
    );
  }

  return (
    <div className={CARD}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        <div className="flex-1 min-w-[12rem]">
          <p className="font-display text-lg break-words">
            {config.name}
            {!config.active && <span className="ml-2 text-xs text-cream/40">· скрыто</span>}
          </p>
          <p className="text-xs text-cream/50 break-all">
            {TYPE_LABEL[config.type]} · {config.tuyaDeviceId}
            {config.type === "RELAY" && config.switchCode ? ` · ${config.switchCode}` : ""}
            {config.type === "AC_IR" && config.infraredId ? ` · хаб ${config.infraredId}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <button type="button" aria-label="Выше" disabled={busy || index === 0} onClick={() => onMove(-1)} className={LINK}>
            ↑
          </button>
          <button type="button" aria-label="Ниже" disabled={busy || index === total - 1} onClick={() => onMove(1)} className={LINK}>
            ↓
          </button>
          <button type="button" disabled={busy || saving} onClick={() => save(toInput(config, { active: !config.active }))} className={LINK}>
            {config.active ? "Скрыть" : "Показать"}
          </button>
          <button type="button" disabled={busy} onClick={() => setEditing(true)} className={LINK}>
            Изменить
          </button>
          <button type="button" disabled={busy} onClick={() => setConfirmingDelete(true)} className={`${LINK} text-coral`}>
            Удалить
          </button>
        </div>
      </div>
      {error && <p className="text-sm text-coral mt-2">{error}</p>}
      {confirmingDelete && (
        <ConfirmDialog
          eyebrow="Удаление"
          title={`Удалить «${config.name}» со страницы Gym? Записи в журнале останутся.`}
          confirmLabel="Удалить"
          busyLabel="Удаляем…"
          backLabel="Отмена"
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

function AddFromTuya({
  candidates,
  hubs,
  onAdded,
}: {
  candidates: TuyaDiscoveredDevice[];
  hubs: TuyaDiscoveredDevice[];
  onAdded: (config: GymDeviceConfig) => void;
}) {
  const [picked, setPicked] = useState<TuyaDiscoveredDevice | null>(null);
  const [name, setName] = useState("");
  const [type, setType] = useState<GymDeviceType>("RELAY");
  const [switchCode, setSwitchCode] = useState("switch_1");
  const [codes, setCodes] = useState<string[] | null>(null);
  const [hub, setHub] = useState("");
  const [remoteId, setRemoteId] = useState("");
  const [remotes, setRemotes] = useState<TuyaRemote[] | null>(null);
  const [checkError, setCheckError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function pick(device: TuyaDiscoveredDevice) {
    const t = defaultTypeForCategory(device.category) ?? "RELAY";
    setPicked(device);
    setName(device.name);
    setType(t);
    setRemoteId(device.id);
    setHub(hubs[0]?.id ?? "");
    setRemotes(null);
    setCodes(null);
    setCheckError(null);
    setError(null);
    if (t === "RELAY") {
      setChecking(true);
      const result = await loadTuyaSwitchCodes(device.id);
      setChecking(false);
      if (result.ok) {
        setCodes(result.data);
        if (result.data.length > 0) setSwitchCode(result.data.includes("switch_1") ? "switch_1" : result.data[0]);
      } else {
        setCheckError(result.error);
      }
    }
  }

  async function checkRemotes() {
    if (!hub) return;
    setChecking(true);
    setCheckError(null);
    const result = await loadTuyaRemotes(hub);
    setChecking(false);
    if (result.ok) setRemotes(result.data);
    else setCheckError(result.error);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!picked) return;
    setSubmitting(true);
    setError(null);
    const input: GymDeviceConfigInput =
      type === "RELAY"
        ? { name, type, tuyaDeviceId: picked.id, switchCode, active: true }
        : { name, type, tuyaDeviceId: picked.id, infraredId: hub, remoteId: remoteId || picked.id, active: true };
    const result = await createGymDeviceConfig(input);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    onAdded(result.data);
    setPicked(null);
  }

  return (
    <div>
      {candidates.length === 0 ? (
        <p className="text-sm text-cream/60">В проекте Tuya нет не добавленных реле и кондиционеров.</p>
      ) : (
        <ul className="grid sm:grid-cols-2 gap-2">
          {candidates.map((d) => (
            <li key={d.id}>
              <button
                type="button"
                onClick={() => pick(d)}
                className={`${TOUCH} w-full text-left rounded-xl border px-4 py-2 text-sm transition-colors ${
                  picked?.id === d.id ? "border-coral bg-coral/10" : "border-cream/15 hover:border-coral"
                }`}
              >
                <span className="block">{d.name}</span>
                <span className="block text-xs text-cream/50">
                  {defaultTypeForCategory(d.category) === "AC_IR" ? "ИК-пульт (кондиционер)" : "Реле"} · {d.online ? "в сети" : "не в сети"}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {picked && (
        <form onSubmit={submit} className={`${CARD} space-y-3 mt-4`}>
          <p className="eyebrow text-cream/60">Новое устройство</p>
          <div>
            <label className="eyebrow text-cream/60 block mb-1">Название на странице</label>
            <input type="text" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={INPUT} />
          </div>
          <div>
            <label className="eyebrow text-cream/60 block mb-1">Тип</label>
            <select value={type} onChange={(e) => setType(e.target.value as GymDeviceType)} className={`${INPUT} bg-ink`}>
              <option value="RELAY">{TYPE_LABEL.RELAY}</option>
              <option value="AC_IR">{TYPE_LABEL.AC_IR}</option>
            </select>
          </div>

          {type === "RELAY" ? (
            <div>
              <label className="eyebrow text-cream/60 block mb-1">Код переключателя</label>
              {codes && codes.length > 0 ? (
                <select value={switchCode} onChange={(e) => setSwitchCode(e.target.value)} className={`${INPUT} bg-ink`}>
                  {codes.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              ) : (
                <input type="text" required maxLength={64} value={switchCode} onChange={(e) => setSwitchCode(e.target.value)} className={INPUT} />
              )}
              <p className="text-xs text-cream/50 mt-1">{checking ? "Читаем коды устройства…" : "Код определяется по состоянию устройства в Tuya."}</p>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <label className="eyebrow text-cream/60 block mb-1">ИК-хаб, под которым стоит кондиционер</label>
                <select required value={hub} onChange={(e) => setHub(e.target.value)} className={`${INPUT} bg-ink`}>
                  {hubs.length === 0 && <option value="">В проекте нет ИК-хабов</option>}
                  {hubs.map((h) => (
                    <option key={h.id} value={h.id}>
                      {h.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="eyebrow text-cream/60 block mb-1">Пульт (remote_id)</label>
                <input type="text" maxLength={64} value={remoteId} onChange={(e) => setRemoteId(e.target.value)} className={INPUT} />
                <p className="text-xs text-cream/50 mt-1">По умолчанию — id самого устройства. Проверьте по списку пультов хаба.</p>
              </div>
              <button type="button" disabled={checking || !hub} onClick={checkRemotes} className={`${TOUCH} rounded-full border border-cream/25 hover:border-coral px-5 text-sm transition-colors disabled:opacity-50`}>
                {checking ? "Проверяем…" : "Показать пульты хаба"}
              </button>
              {remotes && (
                <ul className="text-sm text-cream/70 space-y-1">
                  {remotes.length === 0 && <li>У хаба нет пультов.</li>}
                  {remotes.map((r) => (
                    <li key={r.remoteId}>
                      <button type="button" onClick={() => setRemoteId(r.remoteId)} className={`${TOUCH} text-left text-sea hover:text-coral transition-colors break-all`}>
                        {r.name ?? "Без названия"} · {r.remoteId}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
          {checkError && <p className="text-sm text-coral">{checkError}</p>}

          <div className="flex gap-3 items-center">
            <button type="submit" disabled={submitting || (type === "AC_IR" && !hub)} className={PRIMARY}>
              {submitting ? "Добавляем…" : "Добавить"}
            </button>
            <button type="button" onClick={() => setPicked(null)} className={`${TOUCH} px-3 text-sm text-cream/50 hover:text-cream transition-colors`}>
              Отмена
            </button>
          </div>
          {error && <p className="text-sm text-coral">{error}</p>}
        </form>
      )}
    </div>
  );
}

export default function GymSettingsManager({ initialConfigs, usage }: { initialConfigs: GymDeviceConfig[]; usage: GymTuyaUsage | null }) {
  const [configs, setConfigs] = useState(initialConfigs);
  const [reordering, setReordering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tuyaDevices, setTuyaDevices] = useState<TuyaDiscoveredDevice[] | null>(null);
  const [loadingTuya, setLoadingTuya] = useState(false);
  const [tuyaError, setTuyaError] = useState<string | null>(null);

  async function handleMove(id: string, step: -1 | 1) {
    const ids = moveId(configs.map((c) => c.id), id, step);
    setReordering(true);
    setError(null);
    const result = await reorderGymDeviceConfigs(ids);
    setReordering(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setConfigs(result.data);
  }

  async function handleSave(config: GymDeviceConfig, input: GymDeviceConfigInput): Promise<string | null> {
    const result = await updateGymDeviceConfig(config.id, input);
    if (!result.ok) return result.error;
    setConfigs((prev) => prev.map((c) => (c.id === config.id ? result.data : c)));
    return null;
  }

  async function handleLoadTuya() {
    setLoadingTuya(true);
    setTuyaError(null);
    const result = await loadTuyaDevices();
    setLoadingTuya(false);
    if (!result.ok) {
      setTuyaError(result.error);
      return;
    }
    setTuyaDevices(result.data);
  }

  const configured = new Set(configs.map((c) => c.tuyaDeviceId));
  const candidates = (tuyaDevices ?? []).filter((d) => defaultTypeForCategory(d.category) !== null && !configured.has(d.id));
  const hubs = (tuyaDevices ?? []).filter((d) => isIrHub(d.category));

  return (
    <div className="max-w-4xl">
      <UsageCard usage={usage} />

      <h2 className="eyebrow text-cream/60 mb-3">Устройства на странице Gym</h2>
      {configs.length === 0 && <p className="text-sm text-cream/60 mb-3">Пока ничего не добавлено — загрузите список из Tuya ниже.</p>}
      <div className="space-y-2">
        {configs.map((c, i) => (
          <ConfigRow
            key={c.id}
            config={c}
            index={i}
            total={configs.length}
            busy={reordering}
            onMove={(step) => handleMove(c.id, step)}
            onSave={(input) => handleSave(c, input)}
            onDeleted={() => setConfigs((prev) => prev.filter((x) => x.id !== c.id))}
          />
        ))}
      </div>
      {error && <p className="text-sm text-coral mt-2">{error}</p>}

      <h2 className="eyebrow text-cream/60 mt-8 mb-3">Добавить из проекта Tuya</h2>
      {tuyaDevices === null ? (
        <div>
          <button type="button" onClick={handleLoadTuya} disabled={loadingTuya} className={PRIMARY}>
            {loadingTuya ? "Загружаем…" : "Загрузить список из Tuya"}
          </button>
          <p className="text-xs text-cream/50 mt-2">Список запрашивается у Tuya только по этой кнопке: это расходует вызовы квоты.</p>
        </div>
      ) : (
        <AddFromTuya candidates={candidates} hubs={hubs} onAdded={(c) => setConfigs((prev) => [...prev, c])} />
      )}
      {tuyaError && <p className="text-sm text-coral mt-2">{tuyaError}</p>}
    </div>
  );
}
