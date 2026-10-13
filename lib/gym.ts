// Pure rules of the Gym page (components/admin/GymBoard.tsx): the air conditioner's settings, what
// a command is built from, how the last command reads, and reordering. Kept out of the component so
// the rules that decide what gets sent to a real air conditioner are tested (gym.test.ts).
import { formatTimestamp } from "@/lib/formatDate";
import type { GymAcCommand, GymAcCommandInput, GymDevice } from "@/lib/types";

export const AC_TEMP_MIN = 16;
export const AC_TEMP_MAX = 30;

// Values are the Tuya IR scene command's own (openapi.yaml GymAcCommandInput).
export const AC_MODES: { value: number; label: string }[] = [
  { value: 0, label: "Cool" },
  { value: 1, label: "Heat" },
  { value: 2, label: "Auto" },
  { value: 3, label: "Fan" },
  { value: 4, label: "Dry" },
];

export const AC_WINDS: { value: number; label: string }[] = [
  { value: 0, label: "Auto" },
  { value: 1, label: "1" },
  { value: 2, label: "2" },
  { value: 3, label: "3" },
];

// The settings the three controls edit; power is a separate decision (the on/off buttons).
export type AcSetting = Pick<GymAcCommandInput, "mode" | "temp" | "wind">;

const DEFAULT_SETTING: AcSetting = { mode: 0, temp: 24, wind: 0 };

export function clampTemp(temp: number): number {
  if (!Number.isFinite(temp)) return DEFAULT_SETTING.temp;
  return Math.min(AC_TEMP_MAX, Math.max(AC_TEMP_MIN, Math.round(temp)));
}

// Where the controls start: the last command that was sent, else a sensible default. Never a guess
// about the unit's real state - there is none to read.
export function initialAcSetting(device: Pick<GymDevice, "lastCommand">): AcSetting {
  const last = device.lastCommand;
  if (!last) return { ...DEFAULT_SETTING };
  return { mode: last.mode, temp: clampTemp(last.temp), wind: last.wind };
}

export function acCommand(power: 0 | 1, setting: AcSetting): GymAcCommandInput {
  return { power, mode: setting.mode, temp: clampTemp(setting.temp), wind: setting.wind };
}

export function sameSetting(a: AcSetting, b: AcSetting): boolean {
  return a.mode === b.mode && a.temp === b.temp && a.wind === b.wind;
}

// True when the last command switched the unit on - the only case in which changing a setting can be
// sent as it is (otherwise the change waits for the next "Turn on").
export function lastKnownOn(device: Pick<GymDevice, "lastCommand">): boolean {
  return device.lastCommand?.power === 1;
}

export function modeLabel(mode: number): string {
  return AC_MODES.find((m) => m.value === mode)?.label ?? `mode ${mode}`;
}

export function windLabel(wind: number): string {
  return wind === 0 ? "fan auto" : `fan ${wind}`;
}

export function describeCommand(cmd: Pick<GymAcCommand, "power" | "mode" | "temp" | "wind">): string {
  if (cmd.power === 0) return "off";
  return `on, ${modeLabel(cmd.mode).toLowerCase()}, ${cmd.temp}°, ${windLabel(cmd.wind)}`;
}

// "last command: on, cool, 24°, fan auto (13 Oct 2026, 14:05, Nok)" - or that none
// was sent yet. The caption is the honest part of the card: it is what was sent, not what the unit does.
export function lastCommandCaption(cmd: GymAcCommand | null | undefined): string {
  if (!cmd) return "last command: none sent yet";
  const who = cmd.sentBy ? `, ${cmd.sentBy}` : "";
  return `last command: ${describeCommand(cmd)} (${formatTimestamp(cmd.sentAt)}${who})`;
}

// Moves one id a step up (-1) or down (+1); out of range leaves the list as it is.
export function moveId(ids: readonly string[], id: string, step: -1 | 1): string[] {
  const from = ids.indexOf(id);
  const to = from + step;
  if (from < 0 || to < 0 || to >= ids.length) return [...ids];
  const next = [...ids];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}

// Tuya's category codes the add screen understands (seen on the project): kg is a Wi-Fi switch/relay,
// qt an IR remote (a virtual device under a hub, here the air conditioners), wnykq an IR hub.
export function defaultTypeForCategory(category: string): "RELAY" | "AC_IR" | null {
  if (category === "kg") return "RELAY";
  if (category === "qt") return "AC_IR";
  return null;
}

export function isIrHub(category: string): boolean {
  return category === "wnykq";
}

export function formatCalls(n: number): string {
  return n.toLocaleString("en-US");
}
