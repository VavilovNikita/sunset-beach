import { describe, expect, it } from "vitest";
import {
  brightnessChanged,
  brightnessToPercent,
  cardControls,
  diffUpdate,
  parsePort,
  percentToBrightness,
  powerLabel,
  presetOptions,
  presetSelectValue,
  settingsFieldError,
  valuesOf,
} from "./lighting";
import type { LightingDevice, LightingDeviceConfig } from "./types";

const device = (patch: Partial<LightingDevice> = {}): LightingDevice => ({
  id: "d1",
  name: "Pool bar",
  online: true,
  isOn: true,
  brightness: 128,
  presetId: null,
  presets: [{ id: 1, name: "Warm" }, { id: 3, name: "Party" }],
  ...patch,
});

describe("brightness <-> percent", () => {
  it("maps the ends and the middle", () => {
    expect(brightnessToPercent(0)).toBe(0);
    expect(brightnessToPercent(255)).toBe(100);
    expect(brightnessToPercent(128)).toBe(50);
    expect(percentToBrightness(0)).toBe(0);
    expect(percentToBrightness(100)).toBe(255);
    expect(percentToBrightness(50)).toBe(128);
  });

  it("never builds a value the server would refuse", () => {
    expect(percentToBrightness(-5)).toBe(0);
    expect(percentToBrightness(140)).toBe(255);
    expect(percentToBrightness(Number.NaN)).toBe(0);
    expect(brightnessToPercent(-1)).toBe(0);
    expect(brightnessToPercent(300)).toBe(100);
  });

  it("every slider position survives the round trip to the same percentage", () => {
    for (let p = 0; p <= 100; p++) {
      const bri = percentToBrightness(p);
      expect(bri).toBeGreaterThanOrEqual(0);
      expect(bri).toBeLessThanOrEqual(255);
      expect(brightnessToPercent(bri)).toBe(p);
    }
  });

  it("releasing the slider where the controller already is sends nothing", () => {
    expect(brightnessChanged(128, 50)).toBe(false);
    expect(brightnessChanged(129, 51)).toBe(false); // 129 is 51 % too
    expect(brightnessChanged(128, 60)).toBe(true);
    expect(brightnessChanged(undefined, 50)).toBe(true);
  });
});

describe("cardControls - which controls of a card work", () => {
  it("an online, idle controller has them all", () => {
    expect(cardControls(device(), false)).toEqual({ power: true, brightness: true, preset: true });
  });

  it("an offline controller has none, whatever else is true", () => {
    expect(cardControls(device({ online: false, brightness: undefined, isOn: undefined }), false)).toEqual({ power: false, brightness: false, preset: false });
  });

  it("while a command is in flight (or the list refreshes) none work", () => {
    expect(cardControls(device(), true)).toEqual({ power: false, brightness: false, preset: false });
  });

  it("with no brightness known the slider has nothing to start from, the rest still work", () => {
    expect(cardControls(device({ brightness: undefined, isOn: undefined }), false)).toEqual({ power: true, brightness: false, preset: true });
  });

  it("a controller with no presets has no picker", () => {
    expect(cardControls(device({ presets: [] }), false).preset).toBe(false);
  });
});

describe("the preset picker", () => {
  it("nothing is selected when no preset is applied", () => {
    expect(presetSelectValue(device({ presetId: null }))).toBe("");
    expect(presetSelectValue(device({ presetId: undefined }))).toBe("");
    expect(presetSelectValue(device({ presetId: 3 }))).toBe("3");
  });

  it("offers the controller's own presets, and an applied one that is no longer in the list", () => {
    expect(presetOptions(device()).map((p) => p.id)).toEqual([1, 3]);
    expect(presetOptions(device({ presetId: 2 })).map((p) => p.name)).toEqual(["Warm", "Preset 2", "Party"]);
    expect(presetOptions(device({ presetId: 3 })).map((p) => p.id)).toEqual([1, 3]);
  });
});

describe("powerLabel", () => {
  it("says what is known", () => {
    expect(powerLabel({ online: false })).toBe("Offline");
    expect(powerLabel({ online: true, isOn: true })).toBe("On");
    expect(powerLabel({ online: true, isOn: false })).toBe("Off");
    expect(powerLabel({ online: true })).toBe("State unknown");
  });
});

describe("settings form", () => {
  const config: LightingDeviceConfig = { id: "d1", name: "Pool bar", host: "192.168.1.50", port: 80, location: "Roof", active: true, sortOrder: 0 };

  it("parsePort accepts 1-65535 only", () => {
    expect(parsePort("80")).toBe(80);
    expect(parsePort(" 8080 ")).toBe(8080);
    for (const bad of ["", "0", "65536", "-1", "80.5", "abc", "99999", "1e3"]) expect(parsePort(bad)).toBeNull();
  });

  it("an unchanged form is an empty diff, so a rename never re-sends the address", () => {
    expect(diffUpdate(config, valuesOf(config))).toEqual({});
    expect(diffUpdate(config, { ...valuesOf(config), name: "  Pool terrace " })).toEqual({ name: "Pool terrace" });
  });

  it("only what changed is sent; an emptied location clears it", () => {
    expect(diffUpdate(config, { ...valuesOf(config), host: " 192.168.1.51 ", port: "8080" })).toEqual({ host: "192.168.1.51", port: 8080 });
    expect(diffUpdate(config, { ...valuesOf(config), location: "  " })).toEqual({ location: "" });
    expect(diffUpdate(config, { ...valuesOf(config), active: false })).toEqual({ active: false });
    expect(diffUpdate({ ...config, location: null }, { ...valuesOf(config), location: "" })).toEqual({});
  });

  it("a port that does not parse is left out of the diff", () => {
    expect(diffUpdate(config, { ...valuesOf(config), port: "abc" })).toEqual({});
  });

  it("a 400 on host goes under the host field, a 409 on the name under the name field", () => {
    const body = { error: { formErrors: [], fieldErrors: { host: ["The address must be a private LAN address"] } } };
    expect(settingsFieldError(400, "The address must be a private LAN address", body)).toEqual({
      field: "host",
      message: "The address must be a private LAN address",
    });
    expect(settingsFieldError(409, "Another controller already has this name", { error: "Another controller already has this name" })).toEqual({
      field: "name",
      message: "Another controller already has this name",
    });
  });

  it("anything else is a message for the form as a whole", () => {
    expect(settingsFieldError(409, "Lighting is not configured on the server", { error: "Lighting is not configured on the server" })).toEqual({
      field: "form",
      message: "Lighting is not configured on the server",
    });
    expect(settingsFieldError(500, "Could not save the controller.", null).field).toBe("form");
    expect(settingsFieldError(400, "x", { error: "plain" }).field).toBe("form");
  });
});
