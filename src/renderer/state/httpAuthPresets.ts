import type { CredentialPreset } from "../../shared/types";

export interface HttpAuthPresetAction {
  preset: CredentialPreset;
  recommended: boolean;
  label: string;
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function buildHttpAuthPresetActions(
  presets: CredentialPreset[],
  cameraType: string | null | undefined
): HttpAuthPresetAction[] {
  const expectedType = normalize(cameraType);
  const matching = expectedType
    ? presets.filter((preset) => normalize(preset.cameraType) === expectedType)
    : [];
  const matchingIds = new Set(matching.map((preset) => preset.id));
  const ordered = [...matching, ...presets.filter((preset) => !matchingIds.has(preset.id))];

  return ordered.map((preset, index) => {
    const type = preset.cameraType.trim();
    const recommended = index === 0 && matchingIds.has(preset.id);
    return {
      preset,
      recommended,
      label: recommended
        ? `Use ${type} login & Sign In`
        : type
          ? `Use ${type} · ${preset.username} & Sign In`
          : `Use saved login · ${preset.username} & Sign In`
    };
  });
}
