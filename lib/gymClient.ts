// Client-side calls for the Gym page and its settings (components/admin/Gym*.tsx). Every call goes
// through adminRequest, so a failure is a visible message next to the control that asked - and, on
// the Tuya-backed ones, the backend's own plain-language reason (e.g. "Tuya integration is unavailable…").
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

// refresh=true bypasses the server's ~30 s cache: it is what the "Refresh" button sends.
export function loadGymDevices(refresh: boolean) {
  return call<GymDeviceList>(`/gym/devices${refresh ? "?refresh=true" : ""}`, undefined, "Could not load the devices.");
}

export function setGymRelay(id: string, isOn: boolean) {
  return call<GymDevice>(`/gym/devices/${id}/relay`, adminJsonInit("POST", { isOn }), "Could not switch the relay.");
}

export function sendGymAcCommand(id: string, command: GymAcCommandInput) {
  return call<GymDevice>(`/gym/devices/${id}/ac`, adminJsonInit("POST", command), "Could not send the command to the air conditioner.");
}

// ---- settings (ADMIN) ----

export function loadGymDeviceConfigs() {
  return call<GymDeviceConfig[]>("/gym/settings/devices", undefined, "Could not load the settings.");
}

export function createGymDeviceConfig(input: GymDeviceConfigInput) {
  return call<GymDeviceConfig>("/gym/settings/devices", adminJsonInit("POST", input), "Could not add the device.");
}

// PUT is a full replacement on this API.
export function updateGymDeviceConfig(id: string, input: GymDeviceConfigInput) {
  return call<GymDeviceConfig>(`/gym/settings/devices/${id}`, adminJsonInit("PUT", input), "Could not save the device.");
}

export function deleteGymDeviceConfig(id: string) {
  return call<{ ok: boolean }>(`/gym/settings/devices/${id}`, { method: "DELETE" }, "Could not delete the device.");
}

export function reorderGymDeviceConfigs(ids: string[]) {
  return call<GymDeviceConfig[]>("/gym/settings/devices/reorder", adminJsonInit("POST", { ids }), "Could not save the order.");
}

// These three spend Tuya calls - the screen asks only when the admin opens the corresponding step.
export function loadTuyaDevices() {
  return call<TuyaDiscoveredDevice[]>("/gym/settings/tuya/devices", undefined, "Could not get the Tuya device list.");
}

export function loadTuyaSwitchCodes(tuyaDeviceId: string) {
  return call<string[]>(`/gym/settings/tuya/devices/${tuyaDeviceId}/switch-codes`, undefined, "Could not get the switch codes.");
}

export function loadTuyaRemotes(infraredId: string) {
  return call<TuyaRemote[]>(`/gym/settings/tuya/infrareds/${infraredId}/remotes`, undefined, "Could not get the hub's remotes.");
}

export function loadGymUsage() {
  return call<GymTuyaUsage>("/gym/settings/usage", undefined, "Could not get the call counter.");
}
