import type { BrowserWindowConstructorOptions } from "electron";
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

export interface SavedWindowState {
  width: number;
  height: number;
  x?: number;
  y?: number;
}

const fallbackState: SavedWindowState = {
  width: 1440,
  height: 900
};

function fallbackWindowState(): SavedWindowState {
  return { ...fallbackState };
}

function finiteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function parseWindowState(value: unknown): SavedWindowState | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Partial<SavedWindowState>;
  if (
    !finiteNumber(candidate.width) ||
    candidate.width <= 0 ||
    !finiteNumber(candidate.height) ||
    candidate.height <= 0
  ) {
    return null;
  }

  const state: SavedWindowState = {
    width: candidate.width,
    height: candidate.height
  };
  if (finiteNumber(candidate.x) && finiteNumber(candidate.y)) {
    state.x = candidate.x;
    state.y = candidate.y;
  }
  return state;
}

export async function loadWindowState(userDataPath: string): Promise<SavedWindowState> {
  const statePath = path.join(userDataPath, "window-state.json");
  try {
    const parsed = JSON.parse(await fs.readFile(statePath, "utf8")) as unknown;
    return parseWindowState(parsed) ?? fallbackWindowState();
  } catch {
    return fallbackWindowState();
  }
}

export async function saveWindowState(
  userDataPath: string,
  bounds: SavedWindowState
): Promise<void> {
  const statePath = path.join(userDataPath, "window-state.json");
  const temporaryPath = `${statePath}.tmp-${process.pid}-${randomUUID()}`;
  await fs.mkdir(path.dirname(statePath), { recursive: true });
  try {
    await fs.writeFile(temporaryPath, `${JSON.stringify(bounds, null, 2)}\n`, "utf8");
    await fs.rename(temporaryPath, statePath);
  } catch (error) {
    await fs.rm(temporaryPath, { force: true }).catch(() => undefined);
    throw error;
  }
}

export function toBrowserWindowOptions(
  saved: SavedWindowState
): Pick<BrowserWindowConstructorOptions, "width" | "height" | "x" | "y"> {
  return saved;
}
