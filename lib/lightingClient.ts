// Client-side calls for the Lighting pages (components/admin/Lighting*.tsx). Every call goes through
// adminRequest, so a failure is a visible message next to the control that asked - on the controller
// calls the backend's own sentence naming the controller (a 502: `Controller "Pool bar" did not answer
// in time`). A failure keeps its status and parsed body so the settings form can put a 400/409 under
// its field (lib/lighting.ts#settingsFieldError).
import { adminRequest, adminJsonInit } from "@/lib/adminFetch";
import type {
  LightingDevice,
  LightingDeviceCheckInput,
  LightingDeviceCheckResult,
  LightingDeviceConfig,
  LightingDeviceCreateInput,
  LightingDeviceList,
  LightingDeviceUpdateInput,
  LightingStateInput,
} from "@/lib/types";

export type LightingResult<T> = { ok: true; data: T } | { ok: false; error: string; status: number; body?: unknown };

async function call<T>(path: string, init: RequestInit | undefined, fallback: string): Promise<LightingResult<T>> {
  const result = await adminRequest<T>(path, init, fallback);
  return result.ok ? { ok: true, data: result.data } : { ok: false, error: result.error, status: result.status, body: result.body };
}

// refresh=true bypasses the server's ~10 s cache: it is what the "Refresh" button sends.
export function loadLightingDevices(refresh: boolean) {
  return call<LightingDeviceList>(`/lighting/devices${refresh ? "?refresh=true" : ""}`, undefined, "Could not load the controllers.");
}

export function setLightingState(id: string, input: LightingStateInput) {
  return call<LightingDevice>(`/lighting/devices/${id}/state`, adminJsonInit("POST", input), "Could not send the command.");
}

// ---- settings (ADMIN) ----

export function createLightingDeviceConfig(input: LightingDeviceCreateInput) {
  return call<LightingDeviceConfig>("/lighting/settings/devices", adminJsonInit("POST", input), "Could not add the controller.");
}

// PATCH: only the fields present change.
export function updateLightingDeviceConfig(id: string, input: LightingDeviceUpdateInput) {
  return call<LightingDeviceConfig>(`/lighting/settings/devices/${id}`, adminJsonInit("PATCH", input), "Could not save the controller.");
}

export function deleteLightingDeviceConfig(id: string) {
  return call<{ ok: boolean }>(`/lighting/settings/devices/${id}`, { method: "DELETE" }, "Could not delete the controller.");
}

export function reorderLightingDeviceConfigs(ids: string[]) {
  return call<LightingDeviceConfig[]>("/lighting/settings/devices/reorder", adminJsonInit("POST", { ids }), "Could not save the order.");
}

// Asks the controller at host:port for /json/info without saving anything.
export function checkLightingDevice(input: LightingDeviceCheckInput) {
  return call<LightingDeviceCheckResult>("/lighting/settings/devices/check", adminJsonInit("POST", input), "Could not check the connection.");
}
