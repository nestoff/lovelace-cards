import { describe, expect, it } from "vitest";
import type { CredentialPreset } from "../../shared/types";
import { buildHttpAuthPresetActions } from "./httpAuthPresets";

const presets: CredentialPreset[] = [
  {
    id: "preset-alexa",
    username: "alexa-admin",
    password: "alexa-password",
    cameraType: "ALEXA 35"
  },
  {
    id: "preset-venice-first",
    username: "venice-admin",
    password: "venice-first-password",
    cameraType: "  VENICE 2  "
  },
  {
    id: "preset-manual",
    username: "manual-admin",
    password: "manual-password",
    cameraType: ""
  },
  {
    id: "preset-venice-second",
    username: "venice-operator",
    password: "venice-second-password",
    cameraType: "venice 2"
  }
];

describe("buildHttpAuthPresetActions", () => {
  it("stable-partitions normalized exact camera-type matches first", () => {
    const actions = buildHttpAuthPresetActions(presets, "VeNiCe 2");

    expect(actions.map((action) => action.preset.id)).toEqual([
      "preset-venice-first",
      "preset-venice-second",
      "preset-alexa",
      "preset-manual"
    ]);
  });

  it("marks only the first exact camera-type match as recommended", () => {
    const actions = buildHttpAuthPresetActions(presets, "venice 2");

    expect(actions.map((action) => action.recommended)).toEqual([true, false, false, false]);
    expect(actions[0].label).toBe("Use VENICE 2 login & Sign In");
    expect(actions[1].label).toBe("Use venice 2 · venice-operator & Sign In");
  });

  it("preserves preset order and recommends nothing without an exact camera type", () => {
    const actions = buildHttpAuthPresetActions(presets, "BURANO");

    expect(actions.map((action) => action.preset.id)).toEqual(presets.map((preset) => preset.id));
    expect(actions.every((action) => !action.recommended)).toBe(true);
  });

  it("never exposes a preset password in its action label", () => {
    const actions = buildHttpAuthPresetActions(presets, "VENICE 2");

    for (const action of actions) {
      for (const preset of presets) {
        expect(action.label).not.toContain(preset.password);
      }
    }
    expect(actions.at(-1)?.label).toBe("Use saved login · manual-admin & Sign In");
  });
});
