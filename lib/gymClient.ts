// Client-side calls for the Gym page and its settings (components/admin/Gym*.tsx). Every call goes
// through adminRequest, so a failure is a visible message next to the control that asked - and, on
// the Tuya-backed ones, the backend's own plain-language reason (e.g. "Интеграция Tuya недоступна…").
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import type {
  GymAcCommandInput,
  GymDevice,
  GymDeviceConfig,
  GymDeviceConfigInput,
  GymDeviceList,
  GymTuyaUsage,
  TuyaDiscoveredDevice,
  TuyaRemote,
} from "@/lib/types";

type Result<T> = { ok: true; data: T } | { ok: false; error: string };

async function call<T>(path: string, init: RequestInit | undefined, fallback: string): Promise<Result<T>> {
  const result = await adminRequest<T>(path, init, fallback);
  return result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error };
}

// refresh=true bypasses the server's ~30 s cache: it is what the "Обновить" button sends.
export function loadGymDevices(refresh: boolean) {
  return call<GymDeviceList>(`/gym/devices${refresh ? "?refresh=true" : ""}`, undefined, "Не удалось загрузить устройства.");
}

export function setGymRelay(id: string, isOn: boolean) {
  return call<GymDevice>(`/gym/devices/${id}/relay`, adminJsonInit("POST", { isOn }), "Не удалось переключить реле.");
}

export function sendGymAcCommand(id: string, command: GymAcCommandInput) {
  return call<GymDevice>(`/gym/devices/${id}/ac`, adminJsonInit("POST", command), "Не удалось отправить команду кондиционеру.");
}

// ---- settings (ADMIN) ----

export function loadGymDeviceConfigs() {
  return call<GymDeviceConfig[]>("/gym/settings/devices", undefined, "Не удалось загрузить настройки.");
}

export function createGymDeviceConfig(input: GymDeviceConfigInput) {
  return call<GymDeviceConfig>("/gym/settings/devices", adminJsonInit("POST", input), "Не удалось добавить устройство.");
}

// PUT is a full replacement on this API.
export function updateGymDeviceConfig(id: string, input: GymDeviceConfigInput) {
  return call<GymDeviceConfig>(`/gym/settings/devices/${id}`, adminJsonInit("PUT", input), "Не удалось сохранить устройство.");
}

export function deleteGymDeviceConfig(id: string) {
  return call<{ ok: boolean }>(`/gym/settings/devices/${id}`, { method: "DELETE" }, "Не удалось удалить устройство.");
}

export function reorderGymDeviceConfigs(ids: string[]) {
  return call<GymDeviceConfig[]>("/gym/settings/devices/reorder", adminJsonInit("POST", { ids }), "Не удалось сохранить порядок.");
}

// These three spend Tuya calls - the screen asks only when the admin opens the corresponding step.
export function loadTuyaDevices() {
  return call<TuyaDiscoveredDevice[]>("/gym/settings/tuya/devices", undefined, "Не удалось получить список устройств Tuya.");
}

export function loadTuyaSwitchCodes(tuyaDeviceId: string) {
  return call<string[]>(`/gym/settings/tuya/devices/${tuyaDeviceId}/switch-codes`, undefined, "Не удалось получить коды переключателя.");
}

export function loadTuyaRemotes(infraredId: string) {
  return call<TuyaRemote[]>(`/gym/settings/tuya/infrareds/${infraredId}/remotes`, undefined, "Не удалось получить пульты хаба.");
}

export function loadGymUsage() {
  return call<GymTuyaUsage>("/gym/settings/usage", undefined, "Не удалось получить счётчик вызовов.");
}
