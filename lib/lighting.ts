// Pure rules of the Lighting pages (components/admin/LightingBoard.tsx, LightingSettingsManager.tsx):
// brightness as a percentage, which controls of a card are usable, what the preset picker shows, and
// how a rejected settings request is attributed to a field. Kept out of the components so the rules
// that decide what gets sent to a real controller are tested (lighting.test.ts).
import type { LightingDevice, LightingDeviceConfig, LightingDeviceUpdateInput, LightingPreset } from "@/lib/types";

export const BRIGHTNESS_MAX = 255;

// WLED's bri is 0-255; the slider shows 0-100 %. Both directions clamp, so a value the server
// would refuse (-1, 256, NaN) is never built.
export function brightnessToPercent(bri: number): number {
  if (!Number.isFinite(bri)) return 0;
  return Math.round((Math.min(BRIGHTNESS_MAX, Math.max(0, bri)) / BRIGHTNESS_MAX) * 100);
}

export function percentToBrightness(percent: number): number {
  if (!Number.isFinite(percent)) return 0;
  return Math.round((Math.min(100, Math.max(0, percent)) / 100) * BRIGHTNESS_MAX);
}

// Whether releasing the slider at `percent` is a command at all: the percentage of what the
// controller reports is the same position, so nothing is sent (WLED brightness 0-255 has more steps
// than the slider, and a click on the thumb must not re-send what is already set).
export function brightnessChanged(currentBri: number | undefined, percent: number): boolean {
  if (currentBri === undefined) return true;
  return brightnessToPercent(currentBri) !== Math.round(percent);
}

// Which controls of a card can be used. A controller that is offline or has a command in flight
// (or while the whole list is refreshing) gets none; one that answered the command but whose state
// could not be confirmed (online, no brightness) can still be switched and given a preset, only the
// slider has nothing to start from.
export type CardControls = { power: boolean; brightness: boolean; preset: boolean };

export function cardControls(device: Pick<LightingDevice, "online" | "brightness" | "presets">, busy: boolean): CardControls {
  const usable = device.online && !busy;
  return {
    power: usable,
    brightness: usable && device.brightness !== undefined,
    preset: usable && device.presets.length > 0,
  };
}

// The picker's options: the controller's own presets, plus the applied one when it is not in the list
// (a preset deleted on the controller after it was applied) so the select never shows a wrong name.
export function presetOptions(device: Pick<LightingDevice, "presets" | "presetId">): LightingPreset[] {
  const options = [...device.presets];
  if (typeof device.presetId === "number" && !options.some((p) => p.id === device.presetId)) {
    options.push({ id: device.presetId, name: `Preset ${device.presetId}` });
    options.sort((a, b) => a.id - b.id);
  }
  return options;
}

// "" = none selected (no preset applied).
export function presetSelectValue(device: Pick<LightingDevice, "presetId">): string {
  return typeof device.presetId === "number" ? String(device.presetId) : "";
}

export function powerLabel(device: Pick<LightingDevice, "online" | "isOn">): string {
  if (!device.online) return "Offline";
  if (device.isOn === true) return "On";
  if (device.isOn === false) return "Off";
  return "State unknown";
}

// ---- settings ----

export function parsePort(text: string): number | null {
  const t = text.trim();
  if (!/^\d{1,5}$/.test(t)) return null;
  const n = Number(t);
  return n >= 1 && n <= 65535 ? n : null;
}

export type SettingsValues = { name: string; host: string; port: string; location: string; active: boolean };

export function valuesOf(c: LightingDeviceConfig): SettingsValues {
  return { name: c.name, host: c.host, port: String(c.port), location: c.location ?? "", active: c.active };
}

// Only what changed goes to the PATCH, so renaming a controller never re-sends (and the server never
// re-checks) an address that did not change - which keeps a rename working while lighting is not
// configured. Empty = nothing to save. A port that does not parse is left out: the form refuses it first.
export function diffUpdate(config: LightingDeviceConfig, values: SettingsValues): LightingDeviceUpdateInput {
  const diff: LightingDeviceUpdateInput = {};
  const name = values.name.trim();
  const host = values.host.trim();
  const port = parsePort(values.port);
  const location = values.location.trim();
  if (name !== config.name) diff.name = name;
  if (host !== config.host) diff.host = host;
  if (port !== null && port !== config.port) diff.port = port;
  if (location !== (config.location ?? "")) diff.location = location; // "" clears it
  if (values.active !== config.active) diff.active = values.active;
  return diff;
}

export type SettingsFieldError = { field: "name" | "host" | "port" | "form"; message: string };

// A rejected create/update, attributed: a 400 carries { error: { fieldErrors: { host: [...] } } } and
// a 409 on the name is the backend's own sentence. Anything else is a message for the form as a whole.
export function settingsFieldError(status: number, error: string, body: unknown): SettingsFieldError {
  if (status === 400 && body && typeof body === "object" && "error" in body) {
    const inner = (body as { error: unknown }).error;
    if (inner && typeof inner === "object") {
      const fields = (inner as { fieldErrors?: Record<string, string[]> }).fieldErrors ?? {};
      for (const field of ["name", "host", "port"] as const) {
        const first = fields[field]?.[0];
        if (first) return { field, message: first };
      }
    }
  }
  if (status === 409 && /already has this name/i.test(error)) return { field: "name", message: error };
  return { field: "form", message: error };
}
