import type { TileState, WorkspaceState } from "./types.js";

export type ControlApiBindHost = "127.0.0.1" | "0.0.0.0";

export interface ControlApiInfo {
  host: string;
  port: number;
  baseUrl: string;
  configuredPort: number | null;
  /** Address the control server listens on. */
  bindHost: ControlApiBindHost;
  /** True when the API accepts connections from the LAN (Blue Pill / Skaarhoj). */
  lanAccess: boolean;
  error?: string;
}

export interface ControlApiConfig {
  port: number | null;
  /** Loopback-only by default. Set to 0.0.0.0 for Blue Pill / Skaarhoj LAN control. */
  bindHost?: ControlApiBindHost;
}

export type ControlApiCommand =
  | { requestId: string; type: "status" }
  | { requestId: string; type: "focusTab"; specifier: string }
  | { requestId: string; type: "focusCamera"; cameraNumber: number }
  | { requestId: string; type: "showGrid" }
  | { requestId: string; type: "toggleExpansion" };

export interface ControlApiViewState {
  expansionEnabled: boolean;
  focusMode: boolean;
}

export interface ControlApiStatusTab {
  index: number;
  tileId: string;
  cameraId: string | null;
  cameraNumber: number | null;
  title: string;
  url: string;
}

export interface ControlApiStatus {
  expansionEnabled: boolean;
  focusMode: boolean;
  selectedCameraNumber: number | null;
  selectedTileId: string | null;
  selectedIndex: number | null;
  tabs: ControlApiStatusTab[];
}

export type ControlApiErrorCode =
  | "bad_request"
  | "not_found"
  | "renderer_unavailable"
  | "timeout"
  | "internal_error";

export type ControlApiResponse =
  | { ok: true; status?: ControlApiStatus }
  | { ok: false; error: ControlApiErrorCode; message: string };

function normalizeSpecifier(specifier: string): string {
  return specifier.trim().toLowerCase();
}

export function parsePositiveCameraNumber(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    return null;
  }

  return value;
}

export function parseStoredCameraNumber(value: string): number | null {
  const trimmed = value.trim();
  if (!/^\d+$/.test(trimmed)) {
    return null;
  }

  return parsePositiveCameraNumber(Number(trimmed));
}

function parseOneBasedIndex(specifier: string): number | null {
  const trimmed = specifier.trim();
  const tabMatch = /^tab[\s_-]*(\d+)$/i.exec(trimmed);
  const rawIndex = tabMatch?.[1] ?? trimmed;
  if (!/^\d+$/.test(rawIndex)) {
    return null;
  }

  const index = Number(rawIndex);
  return Number.isInteger(index) && index > 0 ? index : null;
}

export function resolveControlApiTab(
  tiles: TileState[],
  specifier: string
): TileState | null {
  const oneBasedIndex = parseOneBasedIndex(specifier);
  if (oneBasedIndex !== null) {
    return tiles[oneBasedIndex - 1] ?? null;
  }

  const normalized = normalizeSpecifier(specifier);
  if (!normalized) {
    return null;
  }

  return (
    tiles.find((tile) => {
      return (
        tile.id.toLowerCase() === normalized ||
        tile.cameraId?.toLowerCase() === normalized ||
        tile.title.toLowerCase() === normalized ||
        tile.url.toLowerCase() === normalized
      );
    }) ?? null
  );
}

function cameraLookupOrder(workspace: WorkspaceState): WorkspaceState["cameraLists"] {
  const activeList = workspace.cameraLists.find((list) => list.id === workspace.activeCameraListId);
  if (!activeList) {
    return workspace.cameraLists;
  }

  return [
    activeList,
    ...workspace.cameraLists.filter((list) => list.id !== workspace.activeCameraListId)
  ];
}

function cameraNumberById(workspace: WorkspaceState): Map<string, number> {
  const numbers = new Map<string, number>();
  for (const list of cameraLookupOrder(workspace)) {
    for (const camera of list.cameras) {
      const cameraNumber = parseStoredCameraNumber(camera.suffix);
      if (!numbers.has(camera.id) && cameraNumber !== null) {
        numbers.set(camera.id, cameraNumber);
      }
    }
  }

  return numbers;
}

export function resolveControlApiCamera(
  workspace: WorkspaceState,
  cameraNumber: number
): TileState | null {
  const normalized = parsePositiveCameraNumber(cameraNumber);
  if (normalized === null) {
    return null;
  }

  for (const list of cameraLookupOrder(workspace)) {
    const camera = list.cameras.find((candidate) => {
      return parseStoredCameraNumber(candidate.suffix) === normalized;
    });

    if (!camera) {
      continue;
    }

    const tile = workspace.tiles.find((candidate) => candidate.cameraId === camera.id);
    if (tile) {
      return tile;
    }
  }

  return null;
}

export function buildControlApiStatus(
  workspace: WorkspaceState,
  viewState: ControlApiViewState
): ControlApiStatus {
  const selectedIndex = workspace.selectedTileId
    ? workspace.tiles.findIndex((tile) => tile.id === workspace.selectedTileId)
    : -1;

  const cameraNumbers = cameraNumberById(workspace);
  const selectedTile = workspace.selectedTileId
    ? workspace.tiles.find((tile) => tile.id === workspace.selectedTileId) ?? null
    : null;
  const selectedCameraNumber = selectedTile?.cameraId
    ? cameraNumbers.get(selectedTile.cameraId) ?? null
    : null;

  return {
    expansionEnabled: viewState.expansionEnabled,
    focusMode: viewState.expansionEnabled && viewState.focusMode,
    selectedCameraNumber,
    selectedTileId: workspace.selectedTileId,
    selectedIndex: selectedIndex >= 0 ? selectedIndex + 1 : null,
    tabs: workspace.tiles.map((tile, index) => ({
      index: index + 1,
      tileId: tile.id,
      cameraId: tile.cameraId,
      cameraNumber: tile.cameraId ? cameraNumbers.get(tile.cameraId) ?? null : null,
      title: tile.title,
      url: tile.url
    }))
  };
}
