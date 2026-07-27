import type { CameraCsvRow } from "../../shared/csv";
import {
  defaultIndexForSuffix,
  isDefaultIndexForSuffix,
  nextCameraDefaults,
  normalizeCameraNumberSuffix
} from "../../shared/cameraIndex";
import { formatCameraLabel } from "../../shared/cameraLabel";
import { normalizeHostPingIntervalSeconds } from "../../shared/hostPing";
import { normalizeCredentialUrl } from "../../shared/credentials";
import {
  forgetCameraCredential,
  forgetCameraListCredentials
} from "../../shared/passwordRecords";
import {
  cameraBaseFromCommittedUrl,
  normalizeCameraPrefix,
  normalizeCameraUrl,
  resolveCameraAddressWithStablePath
} from "../../shared/url";
import {
  DEFAULT_VIEWPORT,
  LEGACY_DEFAULT_VIEWPORT,
  sameViewport
} from "../../shared/viewport";
import type {
  CameraEntry,
  CameraList,
  PasswordRecord,
  ViewportSize,
  WorkspaceState
} from "../../shared/types";

export type CameraEntryPatch = Partial<
  Pick<
    CameraEntry,
    | "name"
    | "url"
    | "suffix"
    | "prefixOverride"
    | "usesListPrefix"
    | "cameraType"
    | "lens"
    | "displayNote"
    | "notes"
    | "viewportOverride"
    | "zoomOverride"
  >
>;

export type WorkspaceAction =
  | { type: "hydrateWorkspace"; workspace: WorkspaceState }
  | { type: "selectTile"; tileId: string }
  | { type: "setGridColumns"; columns: number }
  | { type: "setPingIntervalSeconds"; seconds: number }
  | { type: "navigateSelectedTile"; url: string }
  | { type: "commitTileNavigationUrl"; tileId: string; url: string }
  | { type: "returnSelectedCameraToPrefix" }
  | { type: "openNewTile"; url: string }
  | { type: "replaceActiveListFromCsv"; rows: CameraCsvRow[] }
  | { type: "setGlobalZoom"; zoom: number }
  | { type: "setGlobalZoomRelative"; factor: number }
  | { type: "setSelectedTileZoom"; zoom: number }
  | { type: "setDefaultViewport"; width: number; height: number }
  | { type: "setGlobalViewport"; width: number; height: number }
  | { type: "setSelectedTileViewport"; width: number; height: number }
  | { type: "createJobWithList"; jobName: string; listName: string; defaultPrefix: string }
  | { type: "updateActiveJobName"; jobName: string }
  | { type: "deleteJob"; jobId: string }
  | { type: "selectCameraList"; cameraListId: string }
  | { type: "updateActiveListPrefix"; defaultPrefix: string }
  | { type: "saveActiveCameraListDraft"; list: CameraList }
  | { type: "updateCameraEntry"; cameraId: string; patch: CameraEntryPatch }
  | { type: "deleteCameraEntry"; cameraId: string }
  | {
      type: "saveCapturedCredential";
      tileId: string;
      url: string;
      username: string;
      password: string;
    }
  | { type: "discardTileCredential"; tileId: string }
  | {
      type: "addCredentialPreset";
      username: string;
      password: string;
      cameraType?: string;
    }
  | { type: "deleteCredentialPreset"; presetId: string }
  | { type: "deletePasswordRecord"; passwordRecordId: string }
  | {
      type: "forgetCameraCredential";
      jobId: string;
      cameraListId: string;
      cameraId: string | null;
      url: string;
    }
  | {
      type: "forgetCameraListCredentials";
      jobId: string;
      cameraListId: string;
    }
  | { type: "addCameraEntry" }
  | { type: "closeTile"; tileId: string }
  | { type: "moveTile"; tileId: string; direction: "left" | "right" }
  | { type: "moveTileToIndex"; tileId: string; toIndex: number }
  | { type: "moveCameraEntry"; cameraId: string; toIndex: number }
  | { type: "resetSelectedTileScale" }
  | { type: "resetGridToListOrder" };

function createTilesForList(
  state: WorkspaceState,
  list: WorkspaceState["cameraLists"][number]
): WorkspaceState["tiles"] {
  return list.cameras.map((camera) => ({
    id: `tile-${camera.id}`,
    cameraId: camera.id,
    url: camera.url,
    title: formatCameraLabel(camera),
    partition: `persist:ditbrowse-${list.jobId}-${list.id}`,
    viewport: camera.viewportOverride ?? state.defaultViewport,
    zoom: camera.zoomOverride ?? state.defaultZoom
  }));
}

function syncListPasswordRecords(
  state: WorkspaceState,
  list: WorkspaceState["cameraLists"][number]
): PasswordRecord[] {
  return state.passwordRecords.map((record) => {
    if (record.cameraListId !== list.id) {
      return record;
    }

    const camera = list.cameras.find(
      (candidate) => candidate.id === record.cameraId || candidate.url === record.url
    );
    return camera ? { ...record, cameraId: camera.id, url: camera.url } : record;
  });
}

function normalizeZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) {
    return 1;
  }

  return Number(Math.min(3, Math.max(0.25, zoom)).toFixed(2));
}

function normalizeViewportSize(width: number, height: number): ViewportSize {
  const normalizedWidth = Number.isFinite(width) ? Math.round(width) : DEFAULT_VIEWPORT.width;
  const normalizedHeight = Number.isFinite(height) ? Math.round(height) : DEFAULT_VIEWPORT.height;
  return {
    width: Math.max(1, normalizedWidth),
    height: Math.max(1, normalizedHeight)
  };
}

function urlHostEndsWithSuffix(url: string, suffix: string): boolean {
  if (!suffix) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.hostname === suffix || parsed.hostname.endsWith(`.${suffix}`);
  } catch {
    return false;
  }
}

function urlLooksLikePrivateIpv4Camera(url: string): boolean {
  try {
    const parsed = new URL(url);
    const octets = parsed.hostname.split(".").map(Number);
    if (
      octets.length !== 4 ||
      octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)
    ) {
      return false;
    }

    return (
      octets[0] === 10 ||
      (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) ||
      (octets[0] === 192 && octets[1] === 168)
    );
  } catch {
    return false;
  }
}

function cameraUsesListPrefix(camera: CameraEntry, listPrefix: string): boolean {
  if (camera.prefixOverride) {
    return false;
  }

  if (camera.usesListPrefix !== undefined) {
    return camera.usesListPrefix;
  }

  if (!camera.url) {
    return true;
  }

  return (
    camera.url === `${listPrefix}${camera.suffix}` ||
    camera.url === listPrefix ||
    (!!listPrefix && camera.url.startsWith(listPrefix)) ||
    urlHostEndsWithSuffix(camera.url, camera.suffix) ||
    (!!camera.suffix && /^\d+$/.test(camera.suffix) && urlLooksLikePrivateIpv4Camera(camera.url))
  );
}

function applyListPrefixUrl(camera: CameraEntry, listPrefix: string): CameraEntry {
  return {
    ...camera,
    url: resolveCameraAddressWithStablePath(listPrefix, camera.suffix, camera.url),
    usesListPrefix: true
  };
}

function updateDerivedCameraUrlForPrefix(
  camera: CameraEntry,
  previousPrefix: string,
  nextPrefix: string
): CameraEntry {
  if (!cameraUsesListPrefix(camera, previousPrefix)) {
    return camera;
  }

  return applyListPrefixUrl(camera, nextPrefix);
}

function applyCameraEntryPatch(
  camera: CameraEntry,
  patch: CameraEntryPatch,
  listPrefix: string
): CameraEntry {
  const normalizedListPrefix = normalizeCameraPrefix(listPrefix);
  const normalizedPatch = {
    ...patch,
    ...(patch.suffix !== undefined
      ? { suffix: normalizeCameraNumberSuffix(patch.suffix) }
      : {}),
    ...(patch.url !== undefined ? { url: normalizeCameraUrl(patch.url) } : {}),
    ...(patch.prefixOverride !== undefined
      ? { prefixOverride: normalizeCameraPrefix(patch.prefixOverride) }
      : {})
  };
  const wasUsingListPrefix = cameraUsesListPrefix(camera, listPrefix);
  const shouldUpdateDefaultIndex =
    "suffix" in normalizedPatch && isDefaultIndexForSuffix(camera.name, camera.suffix);
  let next: CameraEntry = { ...camera, ...normalizedPatch };

  if (shouldUpdateDefaultIndex) {
    next = { ...next, name: defaultIndexForSuffix(next.suffix) || next.name };
  }

  if ("usesListPrefix" in patch) {
    next = patch.usesListPrefix
      ? applyListPrefixUrl(next, normalizedListPrefix)
      : { ...next, usesListPrefix: false };
  } else if ("suffix" in patch && wasUsingListPrefix) {
    next = applyListPrefixUrl(next, normalizedListPrefix);
  }

  if ("url" in patch) {
    const isDerivedUrl =
      next.url === "" ||
      next.url === `${normalizedListPrefix}${next.suffix}` ||
      next.url === normalizedListPrefix;
    next = isDerivedUrl
      ? applyListPrefixUrl(next, normalizedListPrefix)
      : { ...next, usesListPrefix: false };
  }

  if ("zoomOverride" in patch) {
    next = {
      ...next,
      zoomOverride:
        patch.zoomOverride === null || patch.zoomOverride === undefined
          ? null
          : normalizeZoom(patch.zoomOverride)
    };
  }

  return next;
}

function normalizeWorkspaceState(workspace: WorkspaceState): WorkspaceState {
  const defaultViewport = sameViewport(workspace.defaultViewport, LEGACY_DEFAULT_VIEWPORT)
    ? DEFAULT_VIEWPORT
    : workspace.defaultViewport;
  const cameraLists = workspace.cameraLists.map((list) => {
    const defaultPrefix = normalizeCameraPrefix(list.defaultPrefix);
    return {
      ...list,
      defaultPrefix,
      cameras: list.cameras.map((camera) => {
        const normalizedCamera = {
          ...camera,
          url: normalizeCameraUrl(camera.url),
          prefixOverride: normalizeCameraPrefix(camera.prefixOverride)
        };
        return cameraUsesListPrefix(camera, list.defaultPrefix) ||
          cameraUsesListPrefix(normalizedCamera, defaultPrefix)
          ? applyListPrefixUrl(normalizedCamera, defaultPrefix)
          : normalizedCamera;
      })
    };
  });
  const camerasById = new Map(
    cameraLists.flatMap((list) => list.cameras.map((camera) => [camera.id, camera]))
  );
  const tiles = workspace.tiles.map((tile) => {
    const camera = tile.cameraId ? camerasById.get(tile.cameraId) : null;
    if (!camera) {
      return sameViewport(tile.viewport, LEGACY_DEFAULT_VIEWPORT)
        ? { ...tile, viewport: defaultViewport }
        : tile;
    }

    const viewport =
      camera.viewportOverride ??
      (sameViewport(tile.viewport, LEGACY_DEFAULT_VIEWPORT) ? defaultViewport : tile.viewport);
    return { ...tile, url: camera.url, title: formatCameraLabel(camera), viewport };
  });
  let passwordRecords = workspace.passwordRecords;

  for (const list of cameraLists) {
    passwordRecords = syncListPasswordRecords({ ...workspace, cameraLists, passwordRecords }, list);
  }

  return {
    ...workspace,
    globalZoom: normalizeZoom(workspace.globalZoom ?? 1),
    pingIntervalSeconds: normalizeHostPingIntervalSeconds(
      workspace.pingIntervalSeconds
    ),
    credentialPresets: (workspace.credentialPresets ?? []).map((preset) => ({
      ...preset,
      cameraType: preset.cameraType ?? ""
    })),
    defaultViewport,
    cameraLists,
    passwordRecords,
    tiles
  };
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }

  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function createCameraTile(
  state: WorkspaceState,
  list: CameraList,
  camera: CameraEntry,
  existingTile?: WorkspaceState["tiles"][number]
): WorkspaceState["tiles"][number] {
  return {
    id: existingTile?.id ?? `tile-${camera.id}`,
    cameraId: camera.id,
    url: camera.url,
    title: formatCameraLabel(camera),
    partition: `persist:ditbrowse-${list.jobId}-${list.id}`,
    viewport: camera.viewportOverride ?? state.defaultViewport,
    zoom: camera.zoomOverride ?? state.defaultZoom
  };
}

function reconcileTilesForList(state: WorkspaceState, list: CameraList): WorkspaceState["tiles"] {
  const existingCameraTiles = new Map(
    state.tiles
      .filter((tile) => tile.cameraId)
      .map((tile) => [tile.cameraId as string, tile])
  );
  const cameraTiles = list.cameras.map((camera) =>
    createCameraTile(state, list, camera, existingCameraTiles.get(camera.id))
  );
  let cameraIndex = 0;
  const tiles = state.tiles.flatMap((tile) => {
    if (!tile.cameraId) {
      return [tile];
    }

    if (cameraIndex >= cameraTiles.length) {
      return [];
    }

    const nextTile = cameraTiles[cameraIndex];
    cameraIndex += 1;
    return [nextTile];
  });

  return [...tiles, ...cameraTiles.slice(cameraIndex)];
}

function syncActiveListOrderFromTiles(
  state: WorkspaceState,
  tiles: WorkspaceState["tiles"]
): WorkspaceState["cameraLists"] {
  const activeList = state.cameraLists.find((list) => list.id === state.activeCameraListId);
  if (!activeList) {
    return state.cameraLists;
  }

  const activeCameraIds = new Set(activeList.cameras.map((camera) => camera.id));
  const orderedIds = tiles
    .map((tile) => tile.cameraId)
    .filter((cameraId): cameraId is string => !!cameraId && activeCameraIds.has(cameraId));
  const orderedIdSet = new Set(orderedIds);
  const cameraById = new Map(activeList.cameras.map((camera) => [camera.id, camera]));
  const orderedCameras = orderedIds
    .map((cameraId) => cameraById.get(cameraId))
    .filter((camera): camera is CameraEntry => camera !== undefined);
  const remainingCameras = activeList.cameras.filter((camera) => !orderedIdSet.has(camera.id));
  const orderedList = { ...activeList, cameras: [...orderedCameras, ...remainingCameras] };

  return state.cameraLists.map((list) => (list.id === activeList.id ? orderedList : list));
}

function normalizeDraftCamera(camera: CameraEntry, defaultPrefix: string): CameraEntry {
  const suffix = normalizeCameraNumberSuffix(camera.suffix);
  const baseCamera: CameraEntry = {
    ...camera,
    suffix,
    prefixOverride: normalizeCameraPrefix(camera.prefixOverride)
  };

  if (baseCamera.usesListPrefix !== false) {
    return applyListPrefixUrl(baseCamera, defaultPrefix);
  }

  return {
    ...baseCamera,
    url: normalizeCameraUrl(baseCamera.url),
    usesListPrefix: false
  };
}

function normalizeDraftList(list: CameraList): CameraList {
  const defaultPrefix = normalizeCameraPrefix(list.defaultPrefix);
  return {
    ...list,
    defaultPrefix,
    cameras: list.cameras.map((camera) => normalizeDraftCamera(camera, defaultPrefix))
  };
}

function createEmptyJobWorkspace(state: WorkspaceState): WorkspaceState {
  const jobId = `job-${crypto.randomUUID()}`;
  const listId = `list-${crypto.randomUUID()}`;
  return {
    ...state,
    jobs: [{ id: jobId, name: "New Job", listIds: [listId] }],
    cameraLists: [
      {
        id: listId,
        jobId,
        name: "Camera List",
        defaultPrefix: "http://192.168.1.",
        cameras: []
      }
    ],
    activeJobId: jobId,
    activeCameraListId: listId,
    tiles: [],
    selectedTileId: null
  };
}

export function workspaceReducer(
  state: WorkspaceState,
  action: WorkspaceAction
): WorkspaceState {
  switch (action.type) {
    case "hydrateWorkspace":
      return normalizeWorkspaceState(action.workspace);
    case "selectTile":
      return { ...state, selectedTileId: action.tileId };
    case "setGridColumns":
      return { ...state, gridColumns: Math.max(1, action.columns) };
    case "setPingIntervalSeconds":
      return {
        ...state,
        pingIntervalSeconds: normalizeHostPingIntervalSeconds(action.seconds)
      };
    case "navigateSelectedTile": {
      const url = normalizeCameraUrl(action.url);
      const selectedTile = state.tiles.find((tile) => tile.id === state.selectedTileId);
      if (!selectedTile?.cameraId) {
        return {
          ...state,
          tiles: state.tiles.map((tile) =>
            tile.id === state.selectedTileId
              ? { ...tile, url, title: url }
              : tile
          )
        };
      }

      const activeList = state.cameraLists.find((list) => list.id === state.activeCameraListId);
      const camera = activeList?.cameras.find((candidate) => candidate.id === selectedTile.cameraId);
      if (!activeList || !camera) {
        return {
          ...state,
          tiles: state.tiles.map((tile) =>
            tile.id === state.selectedTileId
              ? { ...tile, url, title: url }
              : tile
          )
        };
      }

      const updatedCamera = { ...camera, url, usesListPrefix: false };
      const updatedList = {
        ...activeList,
        cameras: activeList.cameras.map((candidate) =>
          candidate.id === updatedCamera.id ? updatedCamera : candidate
        )
      };
      const cameraLists = state.cameraLists.map((list) =>
        list.id === updatedList.id ? updatedList : list
      );

      return {
        ...state,
        cameraLists,
        passwordRecords: syncListPasswordRecords(state, updatedList),
        tiles: state.tiles.map((tile) =>
          tile.id === selectedTile.id
            ? {
                ...tile,
                url: updatedCamera.url,
                title: formatCameraLabel(updatedCamera),
                viewport: updatedCamera.viewportOverride ?? state.defaultViewport,
                zoom: updatedCamera.zoomOverride ?? state.defaultZoom
              }
            : tile
        )
      };
    }
    case "commitTileNavigationUrl": {
      const committedUrl = cameraBaseFromCommittedUrl(action.url);
      if (!committedUrl) {
        return state;
      }

      const targetTile = state.tiles.find((tile) => tile.id === action.tileId);
      if (!targetTile || targetTile.url === committedUrl) {
        return state;
      }

      if (!targetTile.cameraId) {
        return {
          ...state,
          tiles: state.tiles.map((tile) =>
            tile.id === action.tileId
              ? { ...tile, url: committedUrl, title: committedUrl }
              : tile
          )
        };
      }

      const listWithCamera = state.cameraLists.find((list) =>
        list.cameras.some((camera) => camera.id === targetTile.cameraId)
      );
      const camera = listWithCamera?.cameras.find(
        (candidate) => candidate.id === targetTile.cameraId
      );
      if (!listWithCamera || !camera) {
        return state;
      }

      return {
        ...state,
        tiles: state.tiles.map((tile) =>
          tile.id === action.tileId
            ? {
                ...tile,
                url: committedUrl,
                title: formatCameraLabel(camera),
                viewport: camera.viewportOverride ?? state.defaultViewport,
                zoom: camera.zoomOverride ?? state.defaultZoom
              }
            : tile
        )
      };
    }
    case "returnSelectedCameraToPrefix": {
      const selectedTile = state.tiles.find((tile) => tile.id === state.selectedTileId);
      if (!selectedTile?.cameraId) {
        return state;
      }

      const activeList = state.cameraLists.find((list) => list.id === state.activeCameraListId);
      const camera = activeList?.cameras.find((candidate) => candidate.id === selectedTile.cameraId);
      if (!activeList || !camera) {
        return state;
      }

      const updatedCamera = applyListPrefixUrl(camera, activeList.defaultPrefix);
      const updatedList = {
        ...activeList,
        cameras: activeList.cameras.map((candidate) =>
          candidate.id === updatedCamera.id ? updatedCamera : candidate
        )
      };
      const cameraLists = state.cameraLists.map((list) =>
        list.id === updatedList.id ? updatedList : list
      );

      return {
        ...state,
        cameraLists,
        passwordRecords: syncListPasswordRecords(state, updatedList),
        tiles: state.tiles.map((tile) =>
          tile.id === selectedTile.id
            ? {
                ...tile,
                url: updatedCamera.url,
                title: formatCameraLabel(updatedCamera),
                viewport: updatedCamera.viewportOverride ?? state.defaultViewport,
                zoom: updatedCamera.zoomOverride ?? state.defaultZoom
              }
            : tile
        )
      };
    }
    case "openNewTile": {
      const id = `tile-${crypto.randomUUID()}`;
      const url = normalizeCameraUrl(action.url);
      const activeJobId = state.activeJobId ?? "default-job";
      const activeCameraListId = state.activeCameraListId ?? "default-list";
      return {
        ...state,
        selectedTileId: id,
        tiles: [
          ...state.tiles,
          {
            id,
            cameraId: null,
            url,
            title: url,
            partition: `persist:ditbrowse-${activeJobId}-${activeCameraListId}`,
            viewport: state.defaultViewport,
            zoom: state.defaultZoom
          }
        ]
      };
    }
    case "replaceActiveListFromCsv": {
      const activeListId = state.activeCameraListId;
      const activeList = state.cameraLists.find((list) => list.id === activeListId);
      if (!activeList) {
        return state;
      }

      const cameras = action.rows.map((row) => {
        const url = row.url
          ? normalizeCameraUrl(row.url)
          : `${normalizeCameraPrefix(activeList.defaultPrefix)}${row.suffix}`;
        return {
          id: `camera-${crypto.randomUUID()}`,
          name: row.name,
          url,
          suffix: row.suffix,
          prefixOverride: "",
          usesListPrefix: !row.url,
          cameraType: row.cameraType,
          lens: row.lens,
          displayNote: row.displayNote,
          notes: row.notes,
          viewportOverride: null,
          zoomOverride: null
        };
      });

      const passwordRecords = state.passwordRecords.filter(
        (record) => record.cameraListId !== activeList.id
      );

      const tiles = cameras.map((camera) => ({
        id: `tile-${crypto.randomUUID()}`,
        cameraId: camera.id,
        url: camera.url,
        title: formatCameraLabel(camera),
        partition: `persist:ditbrowse-${activeList.jobId}-${activeList.id}`,
        viewport: camera.viewportOverride ?? state.defaultViewport,
        zoom: camera.zoomOverride ?? state.defaultZoom
      }));

      return {
        ...state,
        cameraLists: state.cameraLists.map((list) =>
          list.id === activeList.id ? { ...list, cameras } : list
        ),
        passwordRecords,
        tiles,
        selectedTileId: tiles[0]?.id ?? null
      };
    }
    case "setGlobalZoom": {
      const zoom = normalizeZoom(action.zoom);
      return {
        ...state,
        defaultZoom: zoom,
        cameraLists: state.cameraLists.map((list) => ({
          ...list,
          cameras: list.cameras.map((camera) => ({ ...camera, zoomOverride: null }))
        })),
        tiles: state.tiles.map((tile) => ({ ...tile, zoom }))
      };
    }
    case "setGlobalZoomRelative": {
      return {
        ...state,
        globalZoom: normalizeZoom(action.factor)
      };
    }
    case "setSelectedTileZoom": {
      const zoom = normalizeZoom(action.zoom);
      const selectedTile = state.tiles.find((tile) => tile.id === state.selectedTileId);
      return {
        ...state,
        cameraLists: selectedTile?.cameraId
          ? state.cameraLists.map((list) =>
              list.id === state.activeCameraListId
                ? {
                    ...list,
                    cameras: list.cameras.map((camera) =>
                      camera.id === selectedTile.cameraId
                        ? { ...camera, zoomOverride: zoom }
                        : camera
                    )
                  }
                : list
            )
          : state.cameraLists,
        tiles: state.tiles.map((tile) =>
          tile.id === state.selectedTileId ? { ...tile, zoom } : tile
        )
      };
    }
    case "setDefaultViewport": {
      const viewport = normalizeViewportSize(action.width, action.height);
      const camerasById = new Map(
        state.cameraLists.flatMap((list) => list.cameras.map((camera) => [camera.id, camera]))
      );

      return {
        ...state,
        defaultViewport: viewport,
        tiles: state.tiles.map((tile) => {
          const camera = tile.cameraId ? camerasById.get(tile.cameraId) : null;
          if (camera?.viewportOverride) {
            return { ...tile, viewport: camera.viewportOverride };
          }

          if (camera || sameViewport(tile.viewport, state.defaultViewport)) {
            return { ...tile, viewport };
          }

          return tile;
        })
      };
    }
    case "setGlobalViewport": {
      const viewport = normalizeViewportSize(action.width, action.height);
      return {
        ...state,
        defaultViewport: viewport,
        cameraLists: state.cameraLists.map((list) => ({
          ...list,
          cameras: list.cameras.map((camera) => ({ ...camera, viewportOverride: null }))
        })),
        tiles: state.tiles.map((tile) => ({ ...tile, viewport }))
      };
    }
    case "setSelectedTileViewport": {
      const viewport = normalizeViewportSize(action.width, action.height);
      const selectedTile = state.tiles.find((tile) => tile.id === state.selectedTileId);
      return {
        ...state,
        cameraLists: selectedTile?.cameraId
          ? state.cameraLists.map((list) =>
              list.id === state.activeCameraListId
                ? {
                    ...list,
                    cameras: list.cameras.map((camera) =>
                      camera.id === selectedTile.cameraId
                        ? { ...camera, viewportOverride: viewport }
                        : camera
                    )
                  }
                : list
            )
          : state.cameraLists,
        tiles: state.tiles.map((tile) =>
          tile.id === state.selectedTileId ? { ...tile, viewport } : tile
        )
      };
    }
    case "createJobWithList": {
      const jobId = `job-${crypto.randomUUID()}`;
      const listId = `list-${crypto.randomUUID()}`;
      const defaultPrefix = normalizeCameraPrefix(action.defaultPrefix);
      return {
        ...state,
        jobs: [...state.jobs, { id: jobId, name: action.jobName, listIds: [listId] }],
        cameraLists: [
          ...state.cameraLists,
          {
            id: listId,
            jobId,
            name: action.listName,
            defaultPrefix,
            cameras: []
          }
        ],
        activeJobId: jobId,
        activeCameraListId: listId,
        tiles: [],
        selectedTileId: null
      };
    }
    case "updateActiveJobName": {
      const jobName = action.jobName.trim();
      if (!jobName || !state.activeJobId) {
        return state;
      }

      return {
        ...state,
        jobs: state.jobs.map((job) =>
          job.id === state.activeJobId ? { ...job, name: jobName } : job
        )
      };
    }
    case "deleteJob": {
      const targetJob = state.jobs.find((job) => job.id === action.jobId);
      if (!targetJob) {
        return state;
      }

      const deletedListIds = new Set(
        state.cameraLists
          .filter((list) => list.jobId === targetJob.id)
          .map((list) => list.id)
      );
      const jobs = state.jobs.filter((job) => job.id !== targetJob.id);
      const cameraLists = state.cameraLists.filter((list) => list.jobId !== targetJob.id);
      const passwordRecords = state.passwordRecords.filter(
        (record) => record.jobId !== targetJob.id && !deletedListIds.has(record.cameraListId)
      );

      if (jobs.length === 0 || cameraLists.length === 0) {
        return createEmptyJobWorkspace({
          ...state,
          jobs: [],
          cameraLists: [],
          passwordRecords: [],
          tiles: [],
          selectedTileId: null,
          activeJobId: null,
          activeCameraListId: null
        });
      }

      const activeListDeleted =
        state.activeJobId === targetJob.id ||
        (!!state.activeCameraListId && deletedListIds.has(state.activeCameraListId));
      if (!activeListDeleted) {
        return {
          ...state,
          jobs,
          cameraLists,
          passwordRecords
        };
      }

      const nextList = cameraLists[0];
      const tiles = createTilesForList({ ...state, cameraLists, passwordRecords }, nextList);
      return {
        ...state,
        jobs,
        cameraLists,
        passwordRecords,
        activeJobId: nextList.jobId,
        activeCameraListId: nextList.id,
        tiles,
        selectedTileId: tiles[0]?.id ?? null
      };
    }
    case "selectCameraList": {
      const list = state.cameraLists.find((candidate) => candidate.id === action.cameraListId);
      if (!list) {
        return state;
      }

      const tiles = createTilesForList(state, list);
      return {
        ...state,
        activeJobId: list.jobId,
        activeCameraListId: list.id,
        tiles,
        selectedTileId: tiles[0]?.id ?? null
      };
    }
    case "updateActiveListPrefix": {
      const defaultPrefix = normalizeCameraPrefix(action.defaultPrefix);
      let updatedList: WorkspaceState["cameraLists"][number] | null = null;
      const cameraLists = state.cameraLists.map((list) => {
        if (list.id !== state.activeCameraListId) {
          return list;
        }

        const cameras = list.cameras.map((camera) =>
          updateDerivedCameraUrlForPrefix(camera, list.defaultPrefix, defaultPrefix)
        );
        updatedList = { ...list, defaultPrefix, cameras };
        return updatedList;
      });

      if (!updatedList) {
        return state;
      }

      return {
        ...state,
        cameraLists,
        passwordRecords: syncListPasswordRecords(state, updatedList),
        tiles: state.tiles.map((tile) => {
          const camera = updatedList?.cameras.find((candidate) => candidate.id === tile.cameraId);
          return camera ? { ...tile, url: camera.url, title: formatCameraLabel(camera) } : tile;
        })
      };
    }
    case "saveActiveCameraListDraft": {
      if (action.list.id !== state.activeCameraListId) {
        return state;
      }

      const currentList = state.cameraLists.find((list) => list.id === action.list.id);
      if (!currentList) {
        return state;
      }

      const savedList = normalizeDraftList({
        ...action.list,
        id: currentList.id,
        jobId: currentList.jobId
      });
      const savedCameraIds = new Set(savedList.cameras.map((camera) => camera.id));
      const cameraLists = state.cameraLists.map((list) =>
        list.id === savedList.id ? savedList : list
      );
      const passwordRecords = syncListPasswordRecords(
        {
          ...state,
          cameraLists,
          passwordRecords: state.passwordRecords.filter(
            (record) =>
              record.cameraListId !== savedList.id ||
              !record.cameraId ||
              savedCameraIds.has(record.cameraId)
          )
        },
        savedList
      );
      const tiles = reconcileTilesForList({ ...state, cameraLists }, savedList);
      const selectedTileId =
        tiles.some((tile) => tile.id === state.selectedTileId)
          ? state.selectedTileId
          : tiles[0]?.id ?? null;

      return {
        ...state,
        cameraLists,
        passwordRecords,
        tiles,
        selectedTileId
      };
    }
    case "updateCameraEntry": {
      let updatedList: WorkspaceState["cameraLists"][number] | null = null;
      const cameraLists = state.cameraLists.map((list) => {
        if (list.id !== state.activeCameraListId) {
          return list;
        }

        const cameras = list.cameras.map((camera) =>
          camera.id === action.cameraId
            ? applyCameraEntryPatch(camera, action.patch, list.defaultPrefix)
            : camera
        );
        updatedList = { ...list, cameras };
        return updatedList;
      });

      if (!updatedList) {
        return state;
      }

      return {
        ...state,
        cameraLists,
        passwordRecords: syncListPasswordRecords(state, updatedList),
        tiles: state.tiles.map((tile) => {
          const camera = updatedList?.cameras.find((candidate) => candidate.id === tile.cameraId);
          if (!camera) {
            return tile;
          }

          return {
            ...tile,
            title: formatCameraLabel(camera),
            url: camera.url,
            viewport: camera.viewportOverride ?? state.defaultViewport,
            zoom: camera.zoomOverride ?? state.defaultZoom
          };
        })
      };
    }
    case "deleteCameraEntry": {
      const activeList = state.cameraLists.find((list) => list.id === state.activeCameraListId);
      const camera = activeList?.cameras.find((candidate) => candidate.id === action.cameraId);
      if (!activeList || !camera) {
        return state;
      }

      const removedTileIndex = state.tiles.findIndex((tile) => tile.cameraId === action.cameraId);
      const updatedList = {
        ...activeList,
        cameras: activeList.cameras.filter((candidate) => candidate.id !== action.cameraId)
      };
      const tiles = state.tiles.filter((tile) => tile.cameraId !== action.cameraId);
      const removedSelectedTile =
        state.selectedTileId !== null &&
        state.tiles.some(
          (tile) => tile.id === state.selectedTileId && tile.cameraId === action.cameraId
        );
      const selectedTileId = removedSelectedTile
        ? tiles[Math.min(Math.max(removedTileIndex, 0), tiles.length - 1)]?.id ?? null
        : state.selectedTileId;

      return {
        ...state,
        cameraLists: state.cameraLists.map((list) =>
          list.id === activeList.id ? updatedList : list
        ),
        passwordRecords: state.passwordRecords.filter(
          (record) =>
            record.cameraListId !== activeList.id ||
            (record.cameraId !== action.cameraId &&
              normalizeCredentialUrl(record.url) !== normalizeCredentialUrl(camera.url))
        ),
        tiles,
        selectedTileId
      };
    }
    case "saveCapturedCredential": {
      const tile = state.tiles.find((candidate) => candidate.id === action.tileId);
      if (!tile || !state.activeJobId || !state.activeCameraListId || !action.password) {
        return state;
      }

      const url = normalizeCredentialUrl(action.url || tile.url);
      const matchesCredential = (record: PasswordRecord): boolean =>
        record.jobId === state.activeJobId &&
        record.cameraListId === state.activeCameraListId &&
        ((!!tile.cameraId && record.cameraId === tile.cameraId) ||
          normalizeCredentialUrl(record.url) === url);
      const existingRecord = [...state.passwordRecords].reverse().find(matchesCredential);
      const retainedRecords = state.passwordRecords.filter((record) => !matchesCredential(record));
      const nextRecord: PasswordRecord = {
        id: existingRecord?.id ?? `password-${crypto.randomUUID()}`,
        jobId: state.activeJobId,
        cameraListId: state.activeCameraListId,
        cameraId: tile.cameraId,
        url,
        username: action.username,
        password: action.password
      };

      return {
        ...state,
        passwordRecords: [...retainedRecords, nextRecord]
      };
    }
    case "discardTileCredential": {
      const tile = state.tiles.find((candidate) => candidate.id === action.tileId);
      if (!tile || !state.activeJobId || !state.activeCameraListId) {
        return state;
      }

      const url = normalizeCredentialUrl(tile.url);
      const shouldDiscard = (record: PasswordRecord): boolean =>
        record.jobId === state.activeJobId &&
        record.cameraListId === state.activeCameraListId &&
        ((!!tile.cameraId && record.cameraId === tile.cameraId) ||
          normalizeCredentialUrl(record.url) === url);

      return {
        ...state,
        passwordRecords: state.passwordRecords.filter((record) => !shouldDiscard(record))
      };
    }
    case "addCredentialPreset": {
      const username = action.username.trim();
      const password = action.password;
      const cameraType = action.cameraType?.trim() ?? "";
      if (!username || !password) {
        return state;
      }

      const duplicate = state.credentialPresets.some(
        (preset) =>
          preset.username === username &&
          preset.password === password &&
          preset.cameraType === cameraType
      );
      if (duplicate) {
        return state;
      }

      return {
        ...state,
        credentialPresets: [
          ...state.credentialPresets,
          {
            id: `credential-preset-${crypto.randomUUID()}`,
            username,
            password,
            cameraType
          }
        ]
      };
    }
    case "deleteCredentialPreset": {
      return {
        ...state,
        credentialPresets: state.credentialPresets.filter(
          (preset) => preset.id !== action.presetId
        )
      };
    }
    case "deletePasswordRecord": {
      return {
        ...state,
        passwordRecords: state.passwordRecords.filter(
          (record) => record.id !== action.passwordRecordId
        )
      };
    }
    case "forgetCameraCredential":
      return {
        ...state,
        passwordRecords: forgetCameraCredential(state.passwordRecords, action)
      };
    case "forgetCameraListCredentials":
      return {
        ...state,
        passwordRecords: forgetCameraListCredentials(state.passwordRecords, action)
      };
    case "addCameraEntry": {
      const activeList = state.cameraLists.find((list) => list.id === state.activeCameraListId);
      if (!activeList) {
        return state;
      }

      const { index, suffix } = nextCameraDefaults(activeList.cameras);
      const camera: CameraEntry = {
        id: `camera-${crypto.randomUUID()}`,
        name: index,
        url: `${normalizeCameraPrefix(activeList.defaultPrefix)}${suffix}`,
        suffix,
        prefixOverride: "",
        usesListPrefix: true,
        cameraType: "",
        lens: "",
        displayNote: "",
        notes: "",
        viewportOverride: null,
        zoomOverride: null
      };
      const updatedList = { ...activeList, cameras: [...activeList.cameras, camera] };
      const tile = createTilesForList(state, { ...updatedList, cameras: [camera] })[0];

      return {
        ...state,
        cameraLists: state.cameraLists.map((list) =>
          list.id === activeList.id ? updatedList : list
        ),
        tiles: [...state.tiles, tile],
        selectedTileId: tile.id
      };
    }
    case "moveTile": {
      const fromIndex = state.tiles.findIndex((tile) => tile.id === action.tileId);
      const toIndex = action.direction === "left" ? fromIndex - 1 : fromIndex + 1;
      const tiles = moveItem(state.tiles, fromIndex, toIndex);
      return {
        ...state,
        cameraLists: syncActiveListOrderFromTiles(state, tiles),
        tiles
      };
    }
    case "moveTileToIndex": {
      const fromIndex = state.tiles.findIndex((tile) => tile.id === action.tileId);
      const toIndex = Math.min(Math.max(action.toIndex, 0), state.tiles.length - 1);
      const tiles = moveItem(state.tiles, fromIndex, toIndex);
      return {
        ...state,
        cameraLists: syncActiveListOrderFromTiles(state, tiles),
        tiles
      };
    }
    case "moveCameraEntry": {
      const activeList = state.cameraLists.find((list) => list.id === state.activeCameraListId);
      if (!activeList) {
        return state;
      }

      const fromIndex = activeList.cameras.findIndex((camera) => camera.id === action.cameraId);
      const toIndex = Math.min(Math.max(action.toIndex, 0), activeList.cameras.length - 1);
      const updatedList = {
        ...activeList,
        cameras: moveItem(activeList.cameras, fromIndex, toIndex)
      };
      const cameraLists = state.cameraLists.map((list) =>
        list.id === activeList.id ? updatedList : list
      );
      return {
        ...state,
        cameraLists,
        tiles: reconcileTilesForList({ ...state, cameraLists }, updatedList)
      };
    }
    case "closeTile": {
      const closingIndex = state.tiles.findIndex((tile) => tile.id === action.tileId);
      if (closingIndex < 0) {
        return state;
      }

      const tiles = state.tiles.filter((tile) => tile.id !== action.tileId);
      const selectedTileId =
        state.selectedTileId === action.tileId
          ? tiles[Math.min(closingIndex, tiles.length - 1)]?.id ?? null
          : state.selectedTileId;

      return {
        ...state,
        tiles,
        selectedTileId
      };
    }
    case "resetSelectedTileScale":
      return {
        ...state,
        tiles: state.tiles.map((tile) =>
          tile.id === state.selectedTileId
            ? { ...tile, viewport: state.defaultViewport, zoom: state.defaultZoom }
            : tile
        )
      };
    case "resetGridToListOrder": {
      const list = state.cameraLists.find((candidate) => candidate.id === state.activeCameraListId);
      if (!list) {
        return state;
      }

      const tiles = createTilesForList(state, list);
      return {
        ...state,
        tiles,
        selectedTileId: tiles[0]?.id ?? null
      };
    }
    default:
      return state;
  }
}
