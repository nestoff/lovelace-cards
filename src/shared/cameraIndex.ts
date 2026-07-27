import type { CameraEntry } from "./types.js";

const ASCII_A = 65;
const ALPHABET_LENGTH = 26;

export interface CameraDefaults {
  index: string;
  suffix: string;
}

function parsePositiveInteger(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  const parsed = Number(trimmed);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function cameraNumberSuffix(value: number): string {
  if (!Number.isFinite(value) || value <= 0) {
    return "01";
  }

  return String(Math.trunc(value)).padStart(2, "0");
}

export function normalizeCameraNumberSuffix(value: string): string {
  const parsed = parsePositiveInteger(value);
  return parsed === null ? value.trim() : cameraNumberSuffix(parsed);
}

export function cameraIndexFromNumber(value: number): string {
  const normalized = Math.trunc(value);
  if (!Number.isFinite(normalized) || normalized <= 0) {
    return "A";
  }

  if (normalized <= ALPHABET_LENGTH) {
    return String.fromCharCode(ASCII_A + normalized - 1);
  }

  return `Z${cameraIndexFromNumber(normalized - ALPHABET_LENGTH)}`;
}

export function cameraNumberFromIndex(index: string): number | null {
  const normalized = index.trim().toUpperCase();
  if (!/^[A-Z]+$/.test(normalized)) {
    return null;
  }

  if (normalized.length === 1) {
    return normalized.charCodeAt(0) - ASCII_A + 1;
  }

  if (!normalized.startsWith("Z")) {
    return null;
  }

  const rest = cameraNumberFromIndex(normalized.slice(1));
  return rest === null ? null : ALPHABET_LENGTH + rest;
}

export function cameraDefaultsFromNumber(value: number): CameraDefaults {
  const normalized = Math.max(1, Math.trunc(value));
  return {
    index: cameraIndexFromNumber(normalized),
    suffix: cameraNumberSuffix(normalized)
  };
}

export function defaultIndexForSuffix(suffix: string): string {
  const parsed = parsePositiveInteger(suffix);
  return parsed === null ? "" : cameraIndexFromNumber(parsed);
}

export function isDefaultIndexForSuffix(index: string, suffix: string): boolean {
  const defaultIndex = defaultIndexForSuffix(suffix);
  return !!defaultIndex && index.trim().toUpperCase() === defaultIndex;
}

export function nextCameraDefaults(cameras: Pick<CameraEntry, "name" | "suffix">[]): CameraDefaults {
  const numbers = cameras
    .flatMap((camera) => [
      parsePositiveInteger(camera.suffix),
      parsePositiveInteger(camera.name),
      cameraNumberFromIndex(camera.name)
    ])
    .filter((value): value is number => value !== null);

  const nextNumber = numbers.length === 0 ? 1 : Math.max(...numbers) + 1;
  return cameraDefaultsFromNumber(nextNumber);
}
