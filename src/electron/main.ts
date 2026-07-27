import { BrowserWindow, Menu, app, dialog, ipcMain } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { AuthInfo, AuthenticationResponseDetails, WebContents } from "electron";
import { resetCameraSessionData, resetListSessionData } from "./session.js";
import { createCompanionModuleInstaller } from "./companionModuleInstaller.js";
import { companionModuleConfigPath } from "./companionModuleConfig.js";
import { chooseAndInstallCompanionModule } from "./companionModuleSetup.js";
import {
  buildControlApiInfo,
  DEFAULT_CONTROL_API_BIND_HOST,
  loadControlApiConfig,
  normalizeControlApiBindHost,
  normalizeControlApiPort,
  removeControlApiRuntimeInfo,
  resolveAdvertisedControlApiHost,
  saveControlApiConfig,
  writeControlApiRuntimeInfo
} from "./controlApiConfig.js";
import type { ControlApiServer } from "./controlApiServer.js";
import { startControlApiServer } from "./controlApiServer.js";
import {
  createHttpAuthRequest,
  HttpAuthCredentialCache,
  type HttpAuthChallenge
} from "./httpAuthCache.js";
import { installProcessStreamGuards } from "./processStreamGuards.js";
import { getMainPreloadPath } from "./preloadPaths.js";
import { installSonyCameraWebviewPatch } from "./sonyCameraPatch.js";
import { createJsonStorage } from "./storage.js";
import {
  DEFAULT_SWP08_CONFIG,
  loadSwp08Config,
  normalizeSwp08Config,
  saveSwp08Config,
  type Swp08Config,
  type Swp08Info
} from "./swp08Config.js";
import { startSwp08Server, type Swp08Server } from "./swp08Server.js";
import { loadWindowState, saveWindowState, toBrowserWindowOptions } from "./windowState.js";
import { lockWebContentsZoom } from "./zoomGuard.js";
import { installMainWindowShortcuts } from "./shortcuts.js";
import { pingHost } from "./hostPing.js";
import type {
  ControlApiBindHost,
  ControlApiCommand,
  ControlApiInfo,
  ControlApiResponse,
  ControlApiStatus
} from "../shared/controlApi.js";
import type { HttpAuthResponse } from "../shared/httpAuth.js";
import type { WorkspaceState } from "../shared/types.js";
import { COMPANION_MODULE_ID } from "../shared/companionModule.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

installProcessStreamGuards(process);
installSonyCameraWebviewPatch(app);

const pendingControlResponses = new Map<
  string,
  {
    resolve: (response: ControlApiResponse) => void;
    timeout: NodeJS.Timeout;
  }
>();

let controlApiServer: ControlApiServer | null = null;
let controlApiInfo: ControlApiInfo | null = null;
let latestControlApiStatus: ControlApiStatus | null = null;
let controlApiStatusRevision = 0;
let swp08Server: Swp08Server | null = null;
let swp08Info: Swp08Info | null = null;
let savedSwp08Config: Swp08Config = { ...DEFAULT_SWP08_CONFIG };
let appWindow: BrowserWindow | null = null;

function buildSwp08Info(options: {
  config: Swp08Config;
  listening: boolean;
  host: string;
  port: number;
  clientCount: number;
  error?: string;
}): Swp08Info {
  return {
    enabled: options.config.enabled,
    host: options.host,
    port: options.port,
    matrix: options.config.matrix,
    levels: options.config.levels,
    sources: options.config.sources,
    destinations: options.config.destinations,
    focusDestination: options.config.focusDestination,
    listening: options.listening,
    clientCount: options.clientCount,
    ...(options.error ? { error: options.error } : {})
  };
}

function isControlApiStatus(value: unknown): value is ControlApiStatus {
  if (!value || typeof value !== "object") {
    return false;
  }

  const status = value as Partial<ControlApiStatus>;
  return (
    typeof status.expansionEnabled === "boolean" &&
    typeof status.focusMode === "boolean" &&
    (status.selectedCameraNumber === null ||
      (typeof status.selectedCameraNumber === "number" &&
        Number.isSafeInteger(status.selectedCameraNumber) &&
        status.selectedCameraNumber >= 1)) &&
    (status.selectedTileId === null || typeof status.selectedTileId === "string") &&
    (status.selectedIndex === null || typeof status.selectedIndex === "number") &&
    Array.isArray(status.tabs)
  );
}

function publishControlApiStatus(status: ControlApiStatus): void {
  if (
    latestControlApiStatus &&
    JSON.stringify(latestControlApiStatus) === JSON.stringify(status)
  ) {
    return;
  }

  latestControlApiStatus = status;
  controlApiStatusRevision += 1;
  controlApiServer?.publishStatus(status, controlApiStatusRevision);
  swp08Server?.syncFromStatus(status);
}

function sendControlApiCommand(
  webContents: WebContents,
  command: Omit<ControlApiCommand, "requestId">
): Promise<ControlApiResponse> {
  if (webContents.isDestroyed()) {
    return Promise.resolve({
      ok: false,
      error: "renderer_unavailable",
      message: "DITBrowse window is not available"
    });
  }

  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const fullCommand = { ...command, requestId } as ControlApiCommand;

  return new Promise<ControlApiResponse>((resolve) => {
    const timeout = setTimeout(() => {
      pendingControlResponses.delete(requestId);
      resolve({
        ok: false,
        error: "timeout",
        message: "DITBrowse did not respond to the control API command"
      });
    }, 2500);

    pendingControlResponses.set(requestId, { resolve, timeout });
    webContents.send("control-api:command", fullCommand);
  });
}

const pendingHttpAuthResponses = new Map<
  string,
  {
    resolve: (response: HttpAuthResponse) => void;
    timeout: NodeJS.Timeout;
  }
>();
const httpAuthCredentialCache = new HttpAuthCredentialCache();

function httpAuthChallengeFrom(
  details: AuthenticationResponseDetails,
  authInfo: AuthInfo,
  webContents: WebContents | null
): HttpAuthChallenge {
  return {
    url: details.url,
    host: authInfo.host,
    port: authInfo.port,
    ...(authInfo.realm ? { realm: authInfo.realm } : {}),
    ...(authInfo.scheme ? { scheme: authInfo.scheme } : {}),
    ...(authInfo.isProxy !== undefined ? { isProxy: authInfo.isProxy } : {}),
    ...(webContents?.id ? { webContentsId: webContents.id } : {})
  };
}

function sendHttpAuthRequest(
  webContents: WebContents,
  challenge: HttpAuthChallenge
): Promise<HttpAuthResponse> {
  if (webContents.isDestroyed()) {
    return Promise.resolve({});
  }

  const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  const request = createHttpAuthRequest(requestId, challenge);

  return new Promise<HttpAuthResponse>((resolve) => {
    const timeout = setTimeout(() => {
      pendingHttpAuthResponses.delete(requestId);
      resolve({});
    }, 120_000);

    pendingHttpAuthResponses.set(requestId, { resolve, timeout });
    webContents.send("http-auth:request", request);
  });
}

ipcMain.on(
  "control-api:response",
  (_event, requestId: string, response: ControlApiResponse): void => {
    const pending = pendingControlResponses.get(requestId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    pendingControlResponses.delete(requestId);
    if (response.ok && response.status) {
      publishControlApiStatus(response.status);
    }
    pending.resolve(response);
  }
);

ipcMain.on("control-api:status", (_event, status: unknown): void => {
  if (isControlApiStatus(status)) {
    publishControlApiStatus(status);
  }
});

ipcMain.on(
  "http-auth:response",
  (_event, requestId: string, response: HttpAuthResponse): void => {
    const pending = pendingHttpAuthResponses.get(requestId);
    if (!pending) {
      return;
    }

    clearTimeout(pending.timeout);
    pendingHttpAuthResponses.delete(requestId);
    pending.resolve(response);
  }
);

ipcMain.on("http-auth:clear-cache", (): void => {
  httpAuthCredentialCache.clear();
});

function workspaceForE2E(workspace: WorkspaceState, cameraUrl: string): WorkspaceState {
  const job = workspace.jobs[0];
  const list = workspace.cameraLists.find((candidate) => candidate.jobId === job?.id);
  const camera = list?.cameras[0];
  const tile = workspace.tiles[0];
  if (!job || !list || !camera || !tile) {
    return workspace;
  }

  const partition = `persist:ditbrowse-${job.id}-${list.id}`;
  return {
    ...workspace,
    jobs: [{ ...job, listIds: [list.id] }],
    cameraLists: [
      {
        ...list,
        defaultPrefix: "",
        cameras: [{ ...camera, url: cameraUrl, usesListPrefix: false }]
      }
    ],
    tiles: [
      {
        ...tile,
        cameraId: camera.id,
        url: cameraUrl,
        title: "Camera 01",
        partition
      }
    ],
    selectedTileId: tile.id,
    activeJobId: job.id,
    activeCameraListId: list.id
  };
}

const createWindow = async (): Promise<void> => {
  const userDataPath = app.getPath("userData");
  const storage = createJsonStorage(userDataPath);
  const savedWindowState = await loadWindowState(userDataPath);
  const savedControlApiConfig = await loadControlApiConfig(userDataPath);
  savedSwp08Config = await loadSwp08Config(userDataPath);
  const companionInstaller = createCompanionModuleInstaller({
    configPath: path.join(
      app.getPath("home"),
      "Library",
      "Application Support",
      "companion",
      "config.json"
    ),
    manualConfigPath: companionModuleConfigPath(userDataPath),
    bundledModulePath: app.isPackaged
      ? path.join(process.resourcesPath, "companion-module", COMPANION_MODULE_ID)
      : path.join(
          app.getAppPath(),
          "resources",
          "companion-module",
          COMPANION_MODULE_ID
        )
  });

  ipcMain.handle("workspace:load", async () => {
    const workspace = await storage.loadWorkspace();
    const cameraUrl = process.env.DITBROWSE_E2E_CAMERA_URL?.trim();
    return cameraUrl ? workspaceForE2E(workspace, cameraUrl) : workspace;
  });
  ipcMain.handle("workspace:save", (_event, workspace: WorkspaceState) =>
    storage.saveWorkspace(workspace)
  );
  ipcMain.handle("host:ping", (_event, host: string) => pingHost(host));
  ipcMain.handle(
    "session:resetCamera",
    async (_event, partition: string, origin: string): Promise<void> => {
      await resetCameraSessionData(partition, origin);
      httpAuthCredentialCache.clear();
    }
  );
  ipcMain.handle(
    "session:resetList",
    async (_event, partition: string): Promise<void> => {
      await resetListSessionData(partition);
      httpAuthCredentialCache.clear();
    }
  );
  ipcMain.handle("control-api:info", () => controlApiInfo);
  ipcMain.handle("swp08:info", () => swp08Info);
  ipcMain.handle("companion-module:status", () => companionInstaller.getStatus());
  ipcMain.handle("companion-module:install", async () => {
    try {
      return await companionInstaller.install();
    } catch (error) {
      console.error("Companion module installation failed", error);
      throw new Error(error instanceof Error ? error.message : "Companion installation failed");
    }
  });

  const mainWindow = new BrowserWindow({
    ...toBrowserWindowOptions(savedWindowState),
    minWidth: 960,
    minHeight: 640,
    title: "DITBrowse",
    webPreferences: {
      preload: getMainPreloadPath(__dirname),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webviewTag: true
    }
  });
  ipcMain.handle("companion-module:choose-and-install", async () => {
    try {
      return await chooseAndInstallCompanionModule({
        browserWindow: mainWindow,
        installer: companionInstaller,
        showOpenDialog: dialog.showOpenDialog
      });
    } catch (error) {
      console.error("Companion module folder setup failed", error);
      throw new Error(error instanceof Error ? error.message : "Companion setup failed");
    }
  });
  appWindow = mainWindow;
  lockWebContentsZoom(mainWindow.webContents, (gesture) => {
    mainWindow.webContents.send("ditbrowse:host-temporary-view-gesture", gesture);
  });
  installMainWindowShortcuts(mainWindow, Menu);

  const startOrRestartSwp08 = async (
    nextConfig: Swp08Config,
    options: { persist: boolean }
  ): Promise<Swp08Info> => {
    const normalized = normalizeSwp08Config(nextConfig);
    const previous = swp08Server;
    swp08Server = null;

    if (!normalized.enabled) {
      await previous?.close();
      savedSwp08Config = normalized;
      if (options.persist) {
        await saveSwp08Config(userDataPath, normalized);
      }
      swp08Info = buildSwp08Info({
        config: normalized,
        listening: false,
        host: resolveAdvertisedControlApiHost("0.0.0.0"),
        port: normalized.port,
        clientCount: 0
      });
      mainWindow.webContents.send("swp08:ready", swp08Info);
      return swp08Info;
    }

    try {
      const nextServer = await startSwp08Server({
        config: normalized,
        advertisedHost: resolveAdvertisedControlApiHost("0.0.0.0"),
        dispatch: (command) => sendControlApiCommand(mainWindow.webContents, command)
      });
      if (latestControlApiStatus) {
        nextServer.syncFromStatus(latestControlApiStatus);
      }
      await previous?.close();
      swp08Server = nextServer;
      savedSwp08Config = normalized;
      if (options.persist) {
        await saveSwp08Config(userDataPath, normalized);
      }
      swp08Info = buildSwp08Info({
        config: normalized,
        listening: true,
        host: nextServer.host,
        port: nextServer.port,
        clientCount: nextServer.clientCount
      });
      mainWindow.webContents.send("swp08:ready", swp08Info);
      return swp08Info;
    } catch (error) {
      await previous?.close();
      savedSwp08Config = normalized;
      if (options.persist) {
        await saveSwp08Config(userDataPath, normalized);
      }
      swp08Info = buildSwp08Info({
        config: normalized,
        listening: false,
        host: resolveAdvertisedControlApiHost("0.0.0.0"),
        port: normalized.port,
        clientCount: 0,
        error: error instanceof Error ? error.message : "Could not start SW-P-08 server"
      });
      mainWindow.webContents.send("swp08:ready", swp08Info);
      return swp08Info;
    }
  };

  ipcMain.handle("swp08:setConfig", async (_event, patch: Partial<Swp08Config>) => {
    return startOrRestartSwp08(
      {
        ...savedSwp08Config,
        ...patch
      },
      { persist: true }
    );
  });

  const startOrRestartControlApi = async (
    configuredPort: number | null,
    configuredBindHost: ControlApiBindHost,
    options: { persist: boolean; fallbackToAuto: boolean }
  ): Promise<ControlApiInfo> => {
    const normalizedPort = normalizeControlApiPort(configuredPort);
    const normalizedBindHost = normalizeControlApiBindHost(configuredBindHost);
    let nextServer: ControlApiServer;
    let startupError: string | undefined;

    try {
      nextServer = await startControlApiServer({
        port: normalizedPort,
        host: normalizedBindHost,
        appVersion: app.getVersion(),
        dispatch: (command) => sendControlApiCommand(mainWindow.webContents, command)
      });
    } catch (error) {
      if (!options.fallbackToAuto || normalizedPort === null) {
        throw error;
      }

      startupError =
        error instanceof Error
          ? `Port ${normalizedPort} was unavailable: ${error.message}`
          : `Port ${normalizedPort} was unavailable`;
      nextServer = await startControlApiServer({
        port: null,
        host: normalizedBindHost,
        appVersion: app.getVersion(),
        dispatch: (command) => sendControlApiCommand(mainWindow.webContents, command)
      });
    }

    const previousServer = controlApiServer;
    if (latestControlApiStatus) {
      nextServer.publishStatus(latestControlApiStatus, controlApiStatusRevision);
    }
    controlApiServer = nextServer;
    controlApiInfo = buildControlApiInfo({
      bindHost: normalizedBindHost,
      port: nextServer.port,
      configuredPort: normalizedPort,
      ...(startupError ? { error: startupError } : {})
    });

    if (options.persist) {
      await saveControlApiConfig(userDataPath, {
        port: normalizedPort,
        bindHost: normalizedBindHost
      });
    }
    await writeControlApiRuntimeInfo(userDataPath, controlApiInfo);
    mainWindow.webContents.send("control-api:ready", controlApiInfo);
    await previousServer?.close();

    return controlApiInfo;
  };

  ipcMain.handle("control-api:setPort", async (_event, port: number | null) => {
    const bindHost = controlApiInfo?.bindHost ?? savedControlApiConfig.bindHost ?? DEFAULT_CONTROL_API_BIND_HOST;
    return startOrRestartControlApi(port, bindHost, { persist: true, fallbackToAuto: false });
  });

  ipcMain.handle(
    "control-api:setBindHost",
    async (_event, bindHost: ControlApiBindHost) => {
      const port = controlApiInfo?.configuredPort ?? savedControlApiConfig.port ?? null;
      return startOrRestartControlApi(port, bindHost, { persist: true, fallbackToAuto: false });
    }
  );

  await startOrRestartControlApi(
    savedControlApiConfig.port,
    savedControlApiConfig.bindHost ?? DEFAULT_CONTROL_API_BIND_HOST,
    {
      persist: false,
      fallbackToAuto: true
    }
  );

  await startOrRestartSwp08(savedSwp08Config, { persist: false });

  mainWindow.on("close", () => {
    void saveWindowState(userDataPath, mainWindow.getBounds());
  });

  mainWindow.on("closed", () => {
    if (appWindow === mainWindow) {
      appWindow = null;
    }
  });

  const devServerUrl = process.env.VITE_DEV_SERVER_URL;
  if (devServerUrl) {
    await mainWindow.loadURL(devServerUrl);
    mainWindow.webContents.openDevTools({ mode: "detach" });
    return;
  }

  await mainWindow.loadFile(path.join(app.getAppPath(), "dist-renderer/index.html"));
};

app.whenReady().then(createWindow);

app.on("login", (event, webContents, details, authInfo, callback) => {
  event.preventDefault();
  const challenge = httpAuthChallengeFrom(details, authInfo, webContents ?? null);
  const cached = httpAuthCredentialCache.get(challenge);
  if (cached) {
    callback(cached.username, cached.password);
    return;
  }

  const targetWindow = appWindow ?? BrowserWindow.getAllWindows()[0] ?? null;
  if (!targetWindow) {
    callback();
    return;
  }

  void sendHttpAuthRequest(targetWindow.webContents, challenge).then((response) => {
    httpAuthCredentialCache.set(challenge, response);
    callback(response.username, response.password);
  });
});

app.on("window-all-closed", () => {
  app.quit();
});

app.on("before-quit", () => {
  const userDataPath = app.getPath("userData");
  void controlApiServer?.close();
  controlApiServer = null;
  void swp08Server?.close();
  swp08Server = null;
  void removeControlApiRuntimeInfo(userDataPath);
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    void createWindow();
  }
});
