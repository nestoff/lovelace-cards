import type { FormEvent, ReactElement } from "react";
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import {
  buildControlApiStatus,
  parseStoredCameraNumber,
  resolveControlApiCamera,
  resolveControlApiTab,
  type ControlApiCommand,
  type ControlApiInfo,
  type ControlApiResponse
} from "../shared/controlApi";
import { findCredentialRecord } from "../shared/credentials";
import { normalizeCredentialUrl } from "../shared/credentials";
import type { CapturedCredential, CredentialFill } from "../shared/credentials";
import type { HttpAuthRequest, HttpAuthResponse } from "../shared/httpAuth";
import type { CompanionModuleInstallStatus } from "../shared/companionModule";
import type { Swp08Config, Swp08Info } from "../shared/swp08Config";
import type { CameraList, TileState, WorkspaceState } from "../shared/types";
import { resolveCameraAddress } from "../shared/url";
import {
  clearTileRuntimeSession,
  findTileIdForWebContentsId,
  loadTileBaseAddress,
  runAllTileCommand,
  runSelectedTileCommand
} from "./browserControls";
import { BrowserChrome } from "./components/BrowserChrome";
import { CameraListEditor } from "./components/CameraListEditor";
import { TileGrid } from "./components/TileGrid";
import { Button } from "./components/ui/Button";
import { Dialog } from "./components/ui/Dialog";
import { StatusNotice } from "./components/ui/StatusNotice";
import { HelpGuide } from "./help/HelpGuide";
import {
  resetCameraList,
  resetSelectedCamera,
  type SessionResetDependencies,
  type SessionResetResult
} from "./sessionReset";
import {
  loadWorkspace,
  resetCameraSessionData,
  resetListSessionData,
  saveWorkspace
} from "./state/workspaceStorage";
import { workspaceReducer } from "./state/workspaceReducer";
import { useDebouncedWorkspaceSave } from "./state/useDebouncedWorkspaceSave";
import { useHostPingStatuses } from "./state/useHostPingStatuses";
import {
  OneShotManualAuthGate,
  enqueueHttpAuthPrompt,
  removeHttpAuthPrompts,
  shiftHttpAuthPrompt,
  updateCurrentHttpAuthPrompt,
  type HttpAuthPromptState
} from "./state/httpAuthQueue";
import { buildHttpAuthPresetActions } from "./state/httpAuthPresets";

function authUrlFromRequest(request: HttpAuthRequest): string {
  if (request.url) {
    return request.url;
  }

  const port = request.port && ![80, 443].includes(request.port) ? `:${request.port}` : "";
  return `http://${request.host}${port}`;
}

function findTileForAuthRequest(
  workspace: WorkspaceState,
  request: HttpAuthRequest
): TileState | null {
  const guestTileId = findTileIdForWebContentsId(request.webContentsId);
  const requestOrigin = normalizeCredentialUrl(authUrlFromRequest(request));
  return (
    workspace.tiles.find((tile) => tile.id === guestTileId) ??
    workspace.tiles.find((tile) => normalizeCredentialUrl(tile.url) === requestOrigin) ??
    workspace.tiles.find((tile) => tile.id === workspace.selectedTileId) ??
    null
  );
}

type WorkspaceBootstrapState =
  | { status: "loading" }
  | { status: "ready"; workspace: WorkspaceState }
  | { status: "error" };

interface WorkspaceLoadAttempt {
  attempt: number;
  promise: Promise<WorkspaceState>;
}

export function App(): ReactElement {
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [bootstrapState, setBootstrapState] = useState<WorkspaceBootstrapState>({
    status: "loading"
  });
  const inFlightLoadRef = useRef<WorkspaceLoadAttempt | null>(null);

  useEffect(() => {
    const existingAttempt = inFlightLoadRef.current;
    const currentAttempt =
      existingAttempt?.attempt === loadAttempt
        ? existingAttempt
        : {
            attempt: loadAttempt,
            promise: Promise.resolve().then(() => loadWorkspace())
          };
    inFlightLoadRef.current = currentAttempt;
    let cancelled = false;

    void currentAttempt.promise.then(
      (workspace) => {
        if (!cancelled && inFlightLoadRef.current === currentAttempt) {
          setBootstrapState({ status: "ready", workspace });
        }
      },
      () => {
        if (!cancelled && inFlightLoadRef.current === currentAttempt) {
          setBootstrapState({ status: "error" });
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  const retryLoad = useCallback((): void => {
    inFlightLoadRef.current = null;
    setBootstrapState({ status: "loading" });
    setLoadAttempt((attempt) => attempt + 1);
  }, []);

  if (bootstrapState.status === "loading") {
    return (
      <main className="workspace-boot">
        <p role="status">Loading workspace…</p>
      </main>
    );
  }

  if (bootstrapState.status === "error") {
    return (
      <main className="workspace-boot">
        <div className="workspace-boot-error" role="alert">
          <strong>Workspace could not be loaded</strong>
          <Button type="button" variant="subtle" size="compact" onClick={retryLoad}>
            Retry
          </Button>
        </div>
      </main>
    );
  }

  return <WorkspaceApp initialWorkspace={bootstrapState.workspace} />;
}

interface WorkspaceAppProps {
  initialWorkspace: WorkspaceState;
}

function hydrateInitialWorkspace(workspace: WorkspaceState): WorkspaceState {
  return workspaceReducer(workspace, { type: "hydrateWorkspace", workspace });
}

function WorkspaceApp({ initialWorkspace }: WorkspaceAppProps): ReactElement {
  const [workspace, dispatch] = useReducer(
    workspaceReducer,
    initialWorkspace,
    hydrateInitialWorkspace
  );
  const [editorOpen, setEditorOpen] = useState(false);
  const [helpSelected, setHelpSelected] = useState(false);
  const [focusMode, setFocusMode] = useState(false);
  const [expansionEnabled, setExpansionEnabled] = useState(true);
  const [httpAuthQueue, setHttpAuthQueue] = useState<HttpAuthPromptState[]>([]);
  const [controlApiInfo, setControlApiInfo] = useState<ControlApiInfo | null>(null);
  const [swp08Info, setSwp08Info] = useState<Swp08Info | null>(null);
  const [companionModuleStatus, setCompanionModuleStatus] =
    useState<CompanionModuleInstallStatus | null>(null);
  const [companionModuleBusy, setCompanionModuleBusy] = useState(false);
  const [companionModuleError, setCompanionModuleError] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetProgressMessage, setResetProgressMessage] = useState("");
  const [resetNotice, setResetNotice] = useState<
    SessionResetResult | { tone: "error"; message: string } | null
  >(null);
  const [confirmListReset, setConfirmListReset] = useState(false);
  const selectedTileIdRef = useRef(workspace.selectedTileId);
  const workspaceRef = useRef(workspace);
  const httpAuthQueueRef = useRef(httpAuthQueue);
  const manualAuthGateRef = useRef(new OneShotManualAuthGate());
  const resetBusyRef = useRef(false);
  const activeWorkspaceKeyRef = useRef("");
  const effectiveFocusMode = expansionEnabled && focusMode && !!workspace.selectedTileId;
  const focusModeRef = useRef(effectiveFocusMode);
  const expansionEnabledRef = useRef(expansionEnabled);
  const httpAuthPrompt = httpAuthQueue[0] ?? null;
  const httpAuthPresetActions = useMemo(
    () =>
      buildHttpAuthPresetActions(
        workspace.credentialPresets,
        httpAuthPrompt?.cameraType
      ),
    [httpAuthPrompt?.cameraType, workspace.credentialPresets]
  );

  workspaceRef.current = workspace;
  httpAuthQueueRef.current = httpAuthQueue;
  focusModeRef.current = effectiveFocusMode;
  expansionEnabledRef.current = expansionEnabled;
  activeWorkspaceKeyRef.current = `${workspace.activeJobId ?? ""}:${workspace.activeCameraListId ?? ""}`;

  const refreshCompanionModuleStatus = useCallback(async (): Promise<void> => {
    const getStatus = window.ditbrowse?.getCompanionModuleInstallStatus;
    if (!getStatus) {
      setCompanionModuleError("Companion module installation is unavailable in this build.");
      return;
    }

    try {
      setCompanionModuleError("");
      setCompanionModuleStatus(await getStatus());
    } catch (error) {
      setCompanionModuleError(
        error instanceof Error ? error.message : "Could not check the Companion module."
      );
    }
  }, []);

  useEffect(() => {
    if (editorOpen) {
      void refreshCompanionModuleStatus();
    }
  }, [editorOpen, refreshCompanionModuleStatus]);

  const installCompanionModule = useCallback(async (): Promise<void> => {
    const install = window.ditbrowse?.installCompanionModule;
    if (!install) {
      setCompanionModuleError("Companion module installation is unavailable in this build.");
      return;
    }

    setCompanionModuleBusy(true);
    setCompanionModuleError("");
    try {
      const result = await install();
      setCompanionModuleStatus(result.status);
    } catch (error) {
      setCompanionModuleError(
        error instanceof Error ? error.message : "Could not install the Companion module."
      );
    } finally {
      setCompanionModuleBusy(false);
    }
  }, []);

  const chooseAndInstallCompanionModule = useCallback(async (): Promise<boolean> => {
    const chooseAndInstall = window.ditbrowse?.chooseAndInstallCompanionModule;
    if (!chooseAndInstall) {
      setCompanionModuleError("Companion module folder setup is unavailable in this build.");
      return false;
    }

    setCompanionModuleBusy(true);
    setCompanionModuleError("");
    try {
      const result = await chooseAndInstall();
      if (!result) {
        return false;
      }
      setCompanionModuleStatus(result.status);
      return true;
    } catch (error) {
      setCompanionModuleError(
        error instanceof Error ? error.message : "Could not set up the Companion module."
      );
      return false;
    } finally {
      setCompanionModuleBusy(false);
    }
  }, []);

  useDebouncedWorkspaceSave({ loaded: true, workspace, saveWorkspace });

  const controlApiStatus = useMemo(
    () =>
      buildControlApiStatus(workspace, {
        expansionEnabled,
        focusMode: effectiveFocusMode
      }),
    [
      effectiveFocusMode,
      expansionEnabled,
      workspace.activeCameraListId,
      workspace.cameraLists,
      workspace.selectedTileId,
      workspace.tiles
    ]
  );

  useEffect(() => {
    window.ditbrowse?.publishControlApiStatus?.(controlApiStatus);
  }, [controlApiStatus]);

  useEffect(() => {
    let active = true;
    window.ditbrowse?.getControlApiInfo?.().then((info) => {
      if (active) {
        setControlApiInfo(info);
      }
    });
    const unsubscribe = window.ditbrowse?.onControlApiInfo?.((info) => {
      setControlApiInfo(info);
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    let active = true;
    window.ditbrowse?.getSwp08Info?.().then((info) => {
      if (active && info) {
        setSwp08Info(info);
      }
    });
    const unsubscribe = window.ditbrowse?.onSwp08Info?.((info) => {
      setSwp08Info(info);
    });

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    selectedTileIdRef.current = workspace.selectedTileId;
  }, [workspace.selectedTileId]);

  useEffect(() => {
    window.ditbrowse?.clearHttpAuthCache?.();
    const queued = httpAuthQueueRef.current;
    queued.forEach((prompt) => {
      window.ditbrowse?.sendHttpAuthResponse?.(prompt.request.requestId, {});
    });
    httpAuthQueueRef.current = [];
    setHttpAuthQueue([]);
    manualAuthGateRef.current.clear();
  }, [workspace.activeJobId, workspace.activeCameraListId]);

  const selectedTile = useMemo(
    () => workspace.tiles.find((tile) => tile.id === workspace.selectedTileId) ?? null,
    [workspace.selectedTileId, workspace.tiles]
  );

  const activeList = workspace.cameraLists.find(
    (list) => list.id === workspace.activeCameraListId
  );
  const cameraNumbersById = useMemo(() => {
    const numbers = new Map<string, number>();
    for (const camera of activeList?.cameras ?? []) {
      const cameraNumber = parseStoredCameraNumber(camera.suffix);
      if (cameraNumber !== null) {
        numbers.set(camera.id, cameraNumber);
      }
    }
    return numbers;
  }, [activeList]);
  const pingStatusesByHost = useHostPingStatuses(
    workspace.tiles.map((tile) => tile.url),
    workspace.pingIntervalSeconds * 1_000
  );
  const webviewPreloadPath = window.ditbrowse?.webviewPreloadPath ?? null;

  const sessionResetDependencies = useMemo<SessionResetDependencies>(
    () => ({
      clearRuntime: clearTileRuntimeSession,
      resetCameraData: resetCameraSessionData,
      resetListData: resetListSessionData,
      loadBase: loadTileBaseAddress,
      markManualAuth: (tileIds) => manualAuthGateRef.current.mark(tileIds),
      clearManualAuth: (tileIds) => manualAuthGateRef.current.clear(tileIds),
      isCurrent: (operationKey) => activeWorkspaceKeyRef.current === operationKey,
      wait: (delayMs) =>
        delayMs <= 0
          ? Promise.resolve()
          : new Promise((resolve) => window.setTimeout(resolve, delayMs))
    }),
    []
  );

  const credentialsByTileId = useMemo(() => {
    const credentials = new Map<string, CredentialFill>();
    if (!workspace.activeJobId || !workspace.activeCameraListId) {
      return credentials;
    }

    for (const tile of workspace.tiles) {
      const record = findCredentialRecord(workspace.passwordRecords, {
        jobId: workspace.activeJobId,
        cameraListId: workspace.activeCameraListId,
        cameraId: tile.cameraId,
        url: tile.url
      });
      if (record) {
        credentials.set(tile.id, {
          username: record.username,
          password: record.password
        });
      }
    }

    return credentials;
  }, [
    workspace.activeCameraListId,
    workspace.activeJobId,
    workspace.passwordRecords,
    workspace.tiles
  ]);

  useEffect(() => {
    const unsubscribe = window.ditbrowse?.onHttpAuthRequest?.((request) => {
      const currentWorkspace = workspaceRef.current;
      const authUrl = authUrlFromRequest(request);
      const tile = findTileForAuthRequest(currentWorkspace, request);
      const activeList = currentWorkspace.cameraLists.find(
        (list) => list.id === currentWorkspace.activeCameraListId
      );
      const camera = tile?.cameraId
        ? activeList?.cameras.find((candidate) => candidate.id === tile.cameraId) ?? null
        : null;
      const record =
        currentWorkspace.activeJobId && currentWorkspace.activeCameraListId
          ? findCredentialRecord(currentWorkspace.passwordRecords, {
              jobId: currentWorkspace.activeJobId,
              cameraListId: currentWorkspace.activeCameraListId,
              cameraId: tile?.cameraId ?? null,
              url: authUrl
            })
          : null;
      const requiresManualSignIn = tile
        ? manualAuthGateRef.current.consume(tile.id)
        : false;

      if (record && !requiresManualSignIn) {
        window.ditbrowse?.sendHttpAuthResponse?.(request.requestId, {
          username: record.username,
          password: record.password
        });
        return;
      }

      setHttpAuthQueue((queue) => {
        const nextQueue = enqueueHttpAuthPrompt(queue, {
          request,
          tileId: tile?.id ?? currentWorkspace.selectedTileId,
          cameraLabel: tile?.title || authUrl,
          cameraType: camera?.cameraType ?? "",
          username: record?.username ?? "",
          password: record?.password ?? "",
          save: true
        });
        httpAuthQueueRef.current = nextQueue;
        return nextQueue;
      });
    });

    return () => {
      unsubscribe?.();
      httpAuthQueueRef.current.forEach((prompt) => {
        window.ditbrowse?.sendHttpAuthResponse?.(prompt.request.requestId, {});
      });
      httpAuthQueueRef.current = [];
    };
  }, []);

  const navigate = useCallback(
    (input: string, target: "selected" | "new"): void => {
      const url = resolveCameraAddress(activeList?.defaultPrefix ?? "", input);
      dispatch(
        target === "selected"
          ? { type: "navigateSelectedTile", url }
          : { type: "openNewTile", url }
      );
    },
    [activeList?.defaultPrefix]
  );

  const selectTile = useCallback((tileId: string): void => {
    selectedTileIdRef.current = tileId;
    dispatch({ type: "selectTile", tileId });
  }, []);

  const toggleFocusMode = useCallback((): void => {
    if (!expansionEnabledRef.current) {
      return;
    }
    setFocusMode((active) => {
      const next = !active;
      focusModeRef.current = next;
      return next;
    });
  }, []);

  const setControlApiPort = useCallback(async (port: number | null): Promise<void> => {
    const nextInfo = await window.ditbrowse?.setControlApiPort?.(port);
    if (nextInfo) {
      setControlApiInfo(nextInfo);
    }
  }, []);

  const setControlApiBindHost = useCallback(
    async (bindHost: "127.0.0.1" | "0.0.0.0"): Promise<void> => {
      const nextInfo = await window.ditbrowse?.setControlApiBindHost?.(bindHost);
      if (nextInfo) {
        setControlApiInfo(nextInfo);
      }
    },
    []
  );

  const setSwp08Config = useCallback(async (patch: Partial<Swp08Config>): Promise<void> => {
    const nextInfo = await window.ditbrowse?.setSwp08Config?.(patch);
    if (nextInfo) {
      setSwp08Info(nextInfo);
    }
  }, []);

  const moveTileToIndex = useCallback((tileId: string, toIndex: number): void => {
    dispatch({ type: "moveTileToIndex", tileId, toIndex });
  }, []);

  const closeTile = useCallback((tileId: string): void => {
    const { kept, removed } = removeHttpAuthPrompts(
      httpAuthQueueRef.current,
      (prompt) => prompt.tileId === tileId
    );
    removed.forEach((prompt) => {
      window.ditbrowse?.sendHttpAuthResponse?.(prompt.request.requestId, {});
    });
    httpAuthQueueRef.current = kept;
    setHttpAuthQueue(kept);
    manualAuthGateRef.current.clear([tileId]);
    dispatch({ type: "closeTile", tileId });
  }, []);

  const addBlankTile = useCallback((): void => {
    dispatch({ type: "openNewTile", url: "about:blank" });
  }, []);

  const returnSelectedCameraToPrefix = useCallback((): void => {
    dispatch({ type: "returnSelectedCameraToPrefix" });
  }, []);

  const saveSelectedTileUrlToCamera = useCallback((): void => {
    if (!selectedTile?.cameraId || !selectedTile.url) {
      return;
    }

    dispatch({
      type: "updateCameraEntry",
      cameraId: selectedTile.cameraId,
      patch: { url: selectedTile.url }
    });
  }, [selectedTile?.cameraId, selectedTile?.url]);

  const setColumns = useCallback((columns: number): void => {
    dispatch({ type: "setGridColumns", columns });
  }, []);

  const setRelativeGlobalZoom = useCallback((factor: number): void => {
    dispatch({ type: "setGlobalZoomRelative", factor });
  }, []);

  const setGlobalViewport = useCallback((viewport: { width: number; height: number }): void => {
    dispatch({
      type: "setGlobalViewport",
      width: viewport.width,
      height: viewport.height
    });
  }, []);

  const setSelectedZoom = useCallback((zoom: number): void => {
    dispatch({ type: "setSelectedTileZoom", zoom });
  }, []);

  const setSelectedViewport = useCallback((viewport: { width: number; height: number }): void => {
    dispatch({
      type: "setSelectedTileViewport",
      width: viewport.width,
      height: viewport.height
    });
  }, []);

  const selectCameraList = useCallback((cameraListId: string): void => {
    dispatch({ type: "selectCameraList", cameraListId });
  }, []);

  const createJob = useCallback(
    (jobName: string, listName: string, defaultPrefix: string): void => {
      dispatch({ type: "createJobWithList", jobName, listName, defaultPrefix });
    },
    []
  );

  const updateJobName = useCallback((jobName: string): void => {
    dispatch({ type: "updateActiveJobName", jobName });
  }, []);

  const deleteJob = useCallback((jobId: string): void => {
    dispatch({ type: "deleteJob", jobId });
  }, []);

  const saveCameraListDraft = useCallback((list: CameraList): void => {
    dispatch({ type: "saveActiveCameraListDraft", list });
  }, []);

  const resetSelectedScale = useCallback((): void => {
    dispatch({ type: "resetSelectedTileScale" });
  }, []);

  const resetGridOrder = useCallback((): void => {
    dispatch({ type: "resetGridToListOrder" });
  }, []);

  const setPingIntervalSeconds = useCallback((seconds: number): void => {
    dispatch({ type: "setPingIntervalSeconds", seconds });
  }, []);

  const saveCapturedCredential = useCallback(
    (tileId: string, credential: CapturedCredential): void => {
      dispatch({
        type: "saveCapturedCredential",
        tileId,
        url: credential.url,
        username: credential.username,
        password: credential.password
      });
    },
    []
  );

  const addCredentialPreset = useCallback(
    (username: string, password: string, cameraType?: string): void => {
      dispatch({ type: "addCredentialPreset", username, password, cameraType });
    },
    []
  );

  const deleteCredentialPreset = useCallback((presetId: string): void => {
    dispatch({ type: "deleteCredentialPreset", presetId });
  }, []);

  const deletePasswordRecord = useCallback((passwordRecordId: string): void => {
    window.ditbrowse?.clearHttpAuthCache?.();
    dispatch({ type: "deletePasswordRecord", passwordRecordId });
  }, []);

  const fillHttpAuthUsername = useCallback((username: string): void => {
    setHttpAuthQueue((queue) => {
      const nextQueue = updateCurrentHttpAuthPrompt(queue, { username });
      httpAuthQueueRef.current = nextQueue;
      return nextQueue;
    });
  }, []);

  const fillHttpAuthPassword = useCallback((password: string): void => {
    setHttpAuthQueue((queue) => {
      const nextQueue = updateCurrentHttpAuthPrompt(queue, { password });
      httpAuthQueueRef.current = nextQueue;
      return nextQueue;
    });
  }, []);

  const discardTileCredential = useCallback((tileId: string): void => {
    window.ditbrowse?.clearHttpAuthCache?.();
    dispatch({ type: "discardTileCredential", tileId });
  }, []);

  const cancelQueuedAuthForTiles = useCallback((tileIds: string[]): void => {
    const affectedTileIds = new Set(tileIds);
    const { kept, removed } = removeHttpAuthPrompts(
      httpAuthQueueRef.current,
      (prompt) => !!prompt.tileId && affectedTileIds.has(prompt.tileId)
    );
    removed.forEach((prompt) => {
      window.ditbrowse?.sendHttpAuthResponse?.(prompt.request.requestId, {});
    });
    httpAuthQueueRef.current = kept;
    setHttpAuthQueue(kept);
  }, []);

  const resetSelectedCameraData = useCallback(async (): Promise<void> => {
    if (resetBusyRef.current) {
      return;
    }

    const currentWorkspace = workspaceRef.current;
    const tile = currentWorkspace.tiles.find(
      (candidate) => candidate.id === currentWorkspace.selectedTileId
    );
    const jobId = currentWorkspace.activeJobId;
    const cameraListId = currentWorkspace.activeCameraListId;
    if (!tile || !jobId || !cameraListId) {
      return;
    }

    const operationKey = `${jobId}:${cameraListId}`;
    cancelQueuedAuthForTiles([tile.id]);
    resetBusyRef.current = true;
    setResetBusy(true);
    setResetProgressMessage(`Clearing data for ${tile.title}...`);
    setResetNotice(null);

    try {
      const result = await resetSelectedCamera(
        {
          tile,
          operationKey,
          onSessionCleared: () => {
            const action = {
              type: "forgetCameraCredential",
              jobId,
              cameraListId,
              cameraId: tile.cameraId,
              url: tile.url
            } as const;
            workspaceRef.current = workspaceReducer(workspaceRef.current, action);
            dispatch(action);
          }
        },
        sessionResetDependencies
      );
      setResetNotice(result);
    } catch (error) {
      setResetNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Camera data could not be cleared."
      });
    } finally {
      resetBusyRef.current = false;
      setResetBusy(false);
      setResetProgressMessage("");
    }
  }, [cancelQueuedAuthForTiles, sessionResetDependencies]);

  const resetEveryCameraData = useCallback(async (): Promise<void> => {
    if (resetBusyRef.current) {
      return;
    }

    const currentWorkspace = workspaceRef.current;
    const jobId = currentWorkspace.activeJobId;
    const cameraListId = currentWorkspace.activeCameraListId;
    if (!jobId || !cameraListId) {
      setConfirmListReset(false);
      setResetNotice({ tone: "error", message: "Select a camera list before clearing data." });
      return;
    }

    const tiles = [...currentWorkspace.tiles];
    const operationKey = `${jobId}:${cameraListId}`;
    const partition = `persist:ditbrowse-${jobId}-${cameraListId}`;
    setConfirmListReset(false);
    cancelQueuedAuthForTiles(tiles.map((tile) => tile.id));
    resetBusyRef.current = true;
    setResetBusy(true);
    setResetProgressMessage(`Clearing data and reloading ${tiles.length} cameras...`);
    setResetNotice(null);

    try {
      const result = await resetCameraList(
        {
          tiles,
          partition,
          operationKey,
          onSessionCleared: () => {
            const action = {
              type: "forgetCameraListCredentials",
              jobId,
              cameraListId
            } as const;
            workspaceRef.current = workspaceReducer(workspaceRef.current, action);
            dispatch(action);
          }
        },
        sessionResetDependencies
      );
      setResetNotice(result);
    } catch (error) {
      setResetNotice({
        tone: "error",
        message:
          error instanceof Error ? error.message : "Camera list data could not be cleared."
      });
    } finally {
      resetBusyRef.current = false;
      setResetBusy(false);
      setResetProgressMessage("");
    }
  }, [cancelQueuedAuthForTiles, sessionResetDependencies]);

  const completeHttpAuthPrompt = useCallback(
    (
      expectedRequestId: string,
      response: HttpAuthResponse,
      saveCredential: boolean
    ): void => {
      const prompt = httpAuthQueueRef.current[0];
      if (!prompt || prompt.request.requestId !== expectedRequestId) {
        return;
      }

      const nextQueue = shiftHttpAuthPrompt(httpAuthQueueRef.current);
      httpAuthQueueRef.current = nextQueue;
      setHttpAuthQueue(nextQueue);
      window.ditbrowse?.sendHttpAuthResponse?.(expectedRequestId, response);

      if (saveCredential && prompt.save && prompt.tileId && response.password) {
        dispatch({
          type: "saveCapturedCredential",
          tileId: prompt.tileId,
          url: authUrlFromRequest(prompt.request),
          username: response.username?.trim() ?? "",
          password: response.password
        });
      }
    },
    []
  );

  const cancelHttpAuth = useCallback((): void => {
    if (httpAuthPrompt) {
      completeHttpAuthPrompt(httpAuthPrompt.request.requestId, {}, false);
    }
  }, [completeHttpAuthPrompt, httpAuthPrompt]);

  const submitHttpAuth = useCallback(
    (event: FormEvent<HTMLFormElement>): void => {
      event.preventDefault();
      if (!httpAuthPrompt || !httpAuthPrompt.password) {
        return;
      }

      completeHttpAuthPrompt(
        httpAuthPrompt.request.requestId,
        {
          username: httpAuthPrompt.username.trim(),
          password: httpAuthPrompt.password
        },
        true
      );
    },
    [completeHttpAuthPrompt, httpAuthPrompt]
  );

  const commitTileNavigationUrl = useCallback((tileId: string, url: string): void => {
    dispatch({ type: "commitTileNavigationUrl", tileId, url });
  }, []);

  useEffect(() => {
    if (!workspace.selectedTileId) {
      setFocusMode(false);
    }
  }, [workspace.selectedTileId]);

  const sendControlApiResponse = useCallback(
    (requestId: string, response: ControlApiResponse): void => {
      window.ditbrowse?.sendControlApiResponse?.(requestId, response);
    },
    []
  );

  const handleControlApiCommand = useCallback(
    (command: ControlApiCommand): void => {
      const currentWorkspace = workspaceRef.current;
      const currentFocusMode = focusModeRef.current && !!currentWorkspace.selectedTileId;
      const currentExpansionEnabled = expansionEnabledRef.current;

      const buildStatus = (
        workspaceState: WorkspaceState,
        expansionIsEnabled: boolean,
        focusIsActive: boolean
      ) =>
        buildControlApiStatus(workspaceState, {
          expansionEnabled: expansionIsEnabled,
          focusMode: focusIsActive
        });

      if (command.type === "status") {
        sendControlApiResponse(command.requestId, {
          ok: true,
          status: buildStatus(
            currentWorkspace,
            currentExpansionEnabled,
            currentFocusMode
          )
        });
        return;
      }

      if (command.type === "showGrid") {
        focusModeRef.current = false;
        setFocusMode(false);
        sendControlApiResponse(command.requestId, {
          ok: true,
          status: buildStatus(currentWorkspace, currentExpansionEnabled, false)
        });
        return;
      }

      if (command.type === "toggleExpansion") {
        const nextExpansionEnabled = !currentExpansionEnabled;
        expansionEnabledRef.current = nextExpansionEnabled;
        setExpansionEnabled(nextExpansionEnabled);
        if (!nextExpansionEnabled) {
          focusModeRef.current = false;
          setFocusMode(false);
        }
        sendControlApiResponse(command.requestId, {
          ok: true,
          status: buildStatus(
            currentWorkspace,
            nextExpansionEnabled,
            nextExpansionEnabled ? currentFocusMode : false
          )
        });
        return;
      }

      if (!currentExpansionEnabled) {
        sendControlApiResponse(command.requestId, {
          ok: true,
          status: buildStatus(currentWorkspace, false, false)
        });
        return;
      }

      const tile =
        command.type === "focusCamera"
          ? resolveControlApiCamera(currentWorkspace, command.cameraNumber)
          : resolveControlApiTab(currentWorkspace.tiles, command.specifier);
      if (!tile) {
        const label = command.type === "focusCamera" ? "camera number" : "tab";
        const value = command.type === "focusCamera" ? command.cameraNumber : command.specifier;
        sendControlApiResponse(command.requestId, {
          ok: false,
          error: "not_found",
          message: `No ${label} matches ${value}`
        });
        return;
      }

      selectedTileIdRef.current = tile.id;
      dispatch({ type: "selectTile", tileId: tile.id });
      focusModeRef.current = true;
      setFocusMode(true);
      sendControlApiResponse(command.requestId, {
        ok: true,
        status: buildStatus(
          { ...currentWorkspace, selectedTileId: tile.id },
          true,
          true
        )
      });
    },
    [sendControlApiResponse]
  );

  useEffect(() => {
    return window.ditbrowse?.onControlApiCommand?.(handleControlApiCommand);
  }, [handleControlApiCommand]);

  useEffect(() => {
    return window.ditbrowse?.onReloadSelectedTileShortcut?.(() => {
      runSelectedTileCommand(selectedTileIdRef.current, "reload");
    });
  }, []);

  return (
    <main className="app-shell">
      <BrowserChrome
        workspace={workspace}
        selectedTile={selectedTile}
        activeList={activeList ?? null}
        onOpenCameraList={() => setEditorOpen(true)}
        helpSelected={helpSelected}
        onOpenHelp={() => setHelpSelected(true)}
        onCloseHelp={() => setHelpSelected(false)}
        onSelectTile={(tileId) => {
          setHelpSelected(false);
          selectTile(tileId);
        }}
        onMoveTileToIndex={moveTileToIndex}
        onCloseTile={closeTile}
        onAddTile={addBlankTile}
        onNavigate={navigate}
        onSaveSelectedUrl={saveSelectedTileUrlToCamera}
        onReturnSelectedCameraToPrefix={returnSelectedCameraToPrefix}
        onBack={() => runSelectedTileCommand(selectedTileIdRef.current, "back")}
        onForward={() => runSelectedTileCommand(selectedTileIdRef.current, "forward")}
        onReload={() => runSelectedTileCommand(selectedTileIdRef.current, "reload")}
        onReloadAll={() => runAllTileCommand("reload")}
        sessionBusy={resetBusy}
        onSignOutSelected={() => void resetSelectedCameraData()}
        onRequestSignOutAll={() => setConfirmListReset(true)}
        onColumnsChange={setColumns}
        onRelativeGlobalZoomChange={setRelativeGlobalZoom}
        onGlobalViewportChange={setGlobalViewport}
        onZoomChange={setSelectedZoom}
        onViewportChange={setSelectedViewport}
        focusMode={effectiveFocusMode}
        expansionEnabled={expansionEnabled}
        onFocusModeToggle={toggleFocusMode}
      />
      <div
        className={helpSelected ? "camera-workspace help-hidden" : "camera-workspace"}
        aria-hidden={helpSelected || undefined}
      >
        {resetBusy && (
          <StatusNotice tone="progress" message={resetProgressMessage} />
        )}
        {!resetBusy && resetNotice && (
          <StatusNotice
            tone={resetNotice.tone}
            message={resetNotice.message}
            onDismiss={() => setResetNotice(null)}
          />
        )}
        <TileGrid
          tiles={workspace.tiles}
          cameraNumbersById={cameraNumbersById}
          pingStatusesByHost={pingStatusesByHost}
          pingIntervalSeconds={workspace.pingIntervalSeconds}
          globalZoom={workspace.globalZoom}
          columns={workspace.gridColumns}
          selectedTileId={workspace.selectedTileId}
          focusMode={effectiveFocusMode}
          onSelectTile={selectTile}
          onUrlCommitted={commitTileNavigationUrl}
          onCredentialCaptured={saveCapturedCredential}
          onCredentialRejected={discardTileCredential}
          credentialsByTileId={credentialsByTileId}
          webviewPreloadPath={webviewPreloadPath}
        />
      </div>
      {helpSelected && <HelpGuide />}
      {editorOpen && (
        <CameraListEditor
          activeList={activeList ?? null}
          workspaceSettings={{
            jobs: workspace.jobs,
            cameraLists: workspace.cameraLists,
            activeCameraListId: workspace.activeCameraListId,
            onSelectCameraList: selectCameraList,
            onCreateJob: createJob,
            onUpdateJobName: updateJobName,
            onDeleteJob: deleteJob,
            credentialPresets: workspace.credentialPresets,
            passwordRecords: workspace.passwordRecords,
            onAddCredentialPreset: addCredentialPreset,
            onDeleteCredentialPreset: deleteCredentialPreset,
            onDeletePasswordRecord: deletePasswordRecord,
            onResetSelectedScale: resetSelectedScale,
            onResetGridOrder: resetGridOrder,
            pingIntervalSeconds: workspace.pingIntervalSeconds,
            onSetPingIntervalSeconds: setPingIntervalSeconds,
            controlApiInfo,
            onSetControlApiPort: setControlApiPort,
            onSetControlApiBindHost: setControlApiBindHost,
            swp08Info,
            onSetSwp08Config: setSwp08Config,
            companionModuleStatus,
            companionModuleBusy,
            companionModuleError,
            onRefreshCompanionModuleStatus: refreshCompanionModuleStatus,
            onInstallCompanionModule: installCompanionModule,
            onChooseAndInstallCompanionModule: chooseAndInstallCompanionModule
          }}
          onClose={() => setEditorOpen(false)}
          onSaveList={saveCameraListDraft}
        />
      )}
      {confirmListReset && (
        <Dialog
          title="Sign out, forget logins, and reload every camera?"
          description="This clears camera session data, forgets saved logins for the active camera list, and reloads every camera from its base address. Password presets and logins saved for other lists stay unchanged."
          onClose={() => setConfirmListReset(false)}
          actions={
            <>
              <Button variant="ghost" onClick={() => setConfirmListReset(false)}>
                Cancel
              </Button>
              <Button variant="primary" onClick={() => void resetEveryCameraData()}>
                Sign Out & Reload All
              </Button>
            </>
          }
        />
      )}
      {httpAuthPrompt && (
        <Dialog
          title="Camera sign in"
          description="Enter the credentials for this camera to continue."
          className="http-auth-dialog"
          onClose={cancelHttpAuth}
          actions={
            <>
              <Button variant="ghost" onClick={cancelHttpAuth}>
                Cancel
              </Button>
              <Button
                type="submit"
                form="camera-sign-in-form"
                variant="primary"
                disabled={!httpAuthPrompt.password}
              >
                Sign In
              </Button>
            </>
          }
        >
          <form
            id="camera-sign-in-form"
            className="http-auth-form"
            aria-label="Camera sign in"
            onSubmit={submitHttpAuth}
          >
            <div className="http-auth-details">
              <strong>{httpAuthPrompt.cameraLabel}</strong>
              <span>{httpAuthPrompt.request.realm || httpAuthPrompt.request.host}</span>
            </div>
            {httpAuthPresetActions.length > 0 && (
              <div
                className="http-auth-preset-actions"
                aria-label="Saved credential suggestions"
              >
                {httpAuthPresetActions.map((action) => (
                  <Button
                    key={action.preset.id}
                    type="button"
                    variant={action.recommended ? "primary" : "subtle"}
                    className={action.recommended ? "http-auth-preset-recommended" : ""}
                    onClick={() =>
                      completeHttpAuthPrompt(
                        httpAuthPrompt.request.requestId,
                        {
                          username: action.preset.username,
                          password: action.preset.password
                        },
                        true
                      )
                    }
                  >
                    {action.label}
                  </Button>
                ))}
              </div>
            )}
            <label className="http-auth-field">
              <span>Username</span>
              <input
                autoFocus
                value={httpAuthPrompt.username}
                onChange={(event) => fillHttpAuthUsername(event.target.value)}
              />
            </label>
            <label className="http-auth-field">
              <span>Password</span>
              <input
                type="text"
                value={httpAuthPrompt.password}
                onChange={(event) => fillHttpAuthPassword(event.target.value)}
              />
            </label>
            <label className="http-auth-save">
              <input
                type="checkbox"
                checked={httpAuthPrompt.save}
                onChange={(event) =>
                  setHttpAuthQueue((queue) => {
                    const nextQueue = updateCurrentHttpAuthPrompt(queue, {
                      save: event.target.checked
                    });
                    httpAuthQueueRef.current = nextQueue;
                    return nextQueue;
                  })
                }
              />
              <span>Save for this camera</span>
            </label>
          </form>
        </Dialog>
      )}
    </main>
  );
}
