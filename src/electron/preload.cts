import { contextBridge, ipcRenderer } from "electron";
import type {
  ControlApiBindHost,
  ControlApiCommand,
  ControlApiInfo,
  ControlApiResponse,
  ControlApiStatus
} from "../shared/controlApi.js";
import type { HttpAuthRequest, HttpAuthResponse } from "../shared/httpAuth.js";
import type { HostPingResult } from "../shared/hostPing.js";
import type { TemporaryViewGesture } from "../shared/temporaryView.js";
import type { WorkspaceState } from "../shared/types.js";
import type {
  CompanionModuleInstallResult,
  CompanionModuleInstallStatus
} from "../shared/companionModule.js";
import type { Swp08Config, Swp08Info } from "../shared/swp08Config.js";

const api = {
  version: "0.1.0",
  webviewPreloadPath: `${__dirname}/webviewPreload.cjs`,
  loadWorkspace: () => ipcRenderer.invoke("workspace:load") as Promise<WorkspaceState>,
  saveWorkspace: (workspace: WorkspaceState) =>
    ipcRenderer.invoke("workspace:save", workspace) as Promise<void>,
  pingHost: (host: string) =>
    ipcRenderer.invoke("host:ping", host) as Promise<HostPingResult>,
  resetCameraSessionData: (partition: string, origin: string) =>
    ipcRenderer.invoke("session:resetCamera", partition, origin) as Promise<void>,
  resetListSessionData: (partition: string) =>
    ipcRenderer.invoke("session:resetList", partition) as Promise<void>,
  getControlApiInfo: () => ipcRenderer.invoke("control-api:info") as Promise<ControlApiInfo>,
  setControlApiPort: (port: number | null) =>
    ipcRenderer.invoke("control-api:setPort", port) as Promise<ControlApiInfo>,
  setControlApiBindHost: (bindHost: ControlApiBindHost) =>
    ipcRenderer.invoke("control-api:setBindHost", bindHost) as Promise<ControlApiInfo>,
  getSwp08Info: () => ipcRenderer.invoke("swp08:info") as Promise<Swp08Info | null>,
  setSwp08Config: (patch: Partial<Swp08Config>) =>
    ipcRenderer.invoke("swp08:setConfig", patch) as Promise<Swp08Info>,
  getCompanionModuleInstallStatus: () =>
    ipcRenderer.invoke("companion-module:status") as Promise<CompanionModuleInstallStatus>,
  installCompanionModule: () =>
    ipcRenderer.invoke("companion-module:install") as Promise<CompanionModuleInstallResult>,
  chooseAndInstallCompanionModule: () =>
    ipcRenderer.invoke("companion-module:choose-and-install") as Promise<
      CompanionModuleInstallResult | null
    >,
  onControlApiInfo: (callback: (info: ControlApiInfo) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, info: ControlApiInfo): void => {
      callback(info);
    };
    ipcRenderer.on("control-api:ready", listener);
    return () => ipcRenderer.removeListener("control-api:ready", listener);
  },
  onSwp08Info: (callback: (info: Swp08Info) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, info: Swp08Info): void => {
      callback(info);
    };
    ipcRenderer.on("swp08:ready", listener);
    return () => ipcRenderer.removeListener("swp08:ready", listener);
  },
  onControlApiCommand: (callback: (command: ControlApiCommand) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, command: ControlApiCommand): void => {
      callback(command);
    };
    ipcRenderer.on("control-api:command", listener);
    return () => ipcRenderer.removeListener("control-api:command", listener);
  },
  sendControlApiResponse: (requestId: string, response: ControlApiResponse) => {
    ipcRenderer.send("control-api:response", requestId, response);
  },
  publishControlApiStatus: (status: ControlApiStatus) => {
    ipcRenderer.send("control-api:status", status);
  },
  onHttpAuthRequest: (callback: (request: HttpAuthRequest) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, request: HttpAuthRequest): void => {
      callback(request);
    };
    ipcRenderer.on("http-auth:request", listener);
    return () => ipcRenderer.removeListener("http-auth:request", listener);
  },
  sendHttpAuthResponse: (requestId: string, response: HttpAuthResponse) => {
    ipcRenderer.send("http-auth:response", requestId, response);
  },
  clearHttpAuthCache: () => {
    ipcRenderer.send("http-auth:clear-cache");
  },
  onHostTemporaryViewGesture: (callback: (gesture: TemporaryViewGesture) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, gesture: TemporaryViewGesture): void => {
      callback(gesture);
    };
    ipcRenderer.on("ditbrowse:host-temporary-view-gesture", listener);
    return () => ipcRenderer.removeListener("ditbrowse:host-temporary-view-gesture", listener);
  },
  onReloadSelectedTileShortcut: (callback: () => void) => {
    const listener = (): void => {
      callback();
    };
    ipcRenderer.on("ditbrowse:reload-selected-tile", listener);
    return () => ipcRenderer.removeListener("ditbrowse:reload-selected-tile", listener);
  }
};

contextBridge.exposeInMainWorld("ditbrowse", api);

export type DITBrowseApi = typeof api;
