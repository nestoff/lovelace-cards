import type { WorkspaceState } from "../../shared/types";
import { sampleWorkspace } from "../../shared/sampleData";
import type { TemporaryViewGesture } from "../../shared/temporaryView";
import type {
  ControlApiBindHost,
  ControlApiCommand,
  ControlApiInfo,
  ControlApiResponse,
  ControlApiStatus
} from "../../shared/controlApi";
import type { HttpAuthRequest, HttpAuthResponse } from "../../shared/httpAuth";
import type { HostPingResult } from "../../shared/hostPing";
import type {
  CompanionModuleInstallResult,
  CompanionModuleInstallStatus
} from "../../shared/companionModule";

declare global {
  interface Window {
    ditbrowse: {
      version: string;
      webviewPreloadPath?: string;
      loadWorkspace?: () => Promise<WorkspaceState>;
      saveWorkspace?: (workspace: WorkspaceState) => Promise<void>;
      pingHost?: (host: string) => Promise<HostPingResult>;
      resetCameraSessionData?: (partition: string, origin: string) => Promise<void>;
      resetListSessionData?: (partition: string) => Promise<void>;
      onHostTemporaryViewGesture?: (
        callback: (gesture: TemporaryViewGesture) => void
      ) => () => void;
      getControlApiInfo?: () => Promise<ControlApiInfo>;
      setControlApiPort?: (port: number | null) => Promise<ControlApiInfo>;
      setControlApiBindHost?: (bindHost: ControlApiBindHost) => Promise<ControlApiInfo>;
      getCompanionModuleInstallStatus?: () => Promise<CompanionModuleInstallStatus>;
      installCompanionModule?: () => Promise<CompanionModuleInstallResult>;
      chooseAndInstallCompanionModule?: () => Promise<
        CompanionModuleInstallResult | null
      >;
      onControlApiInfo?: (callback: (info: ControlApiInfo) => void) => () => void;
      onControlApiCommand?: (callback: (command: ControlApiCommand) => void) => () => void;
      sendControlApiResponse?: (requestId: string, response: ControlApiResponse) => void;
      publishControlApiStatus?: (status: ControlApiStatus) => void;
      onReloadSelectedTileShortcut?: (callback: () => void) => () => void;
      onHttpAuthRequest?: (callback: (request: HttpAuthRequest) => void) => () => void;
      sendHttpAuthResponse?: (requestId: string, response: HttpAuthResponse) => void;
      clearHttpAuthCache?: () => void;
    };
  }
}

const fallbackStorageKey = "ditbrowse-workspace";

function parseFallbackWorkspace(): WorkspaceState | null {
  const stored = window.localStorage.getItem(fallbackStorageKey);
  return stored ? (JSON.parse(stored) as WorkspaceState) : null;
}

function sameWorkspace(left: WorkspaceState, right: WorkspaceState): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

function shouldMigrateFallbackWorkspace(
  electronWorkspace: WorkspaceState,
  fallbackWorkspace: WorkspaceState | null
): fallbackWorkspace is WorkspaceState {
  return (
    fallbackWorkspace !== null &&
    sameWorkspace(electronWorkspace, sampleWorkspace) &&
    !sameWorkspace(fallbackWorkspace, sampleWorkspace)
  );
}

export async function loadWorkspace(): Promise<WorkspaceState> {
  if (window.ditbrowse?.loadWorkspace) {
    const electronWorkspace = await window.ditbrowse.loadWorkspace();
    const fallbackWorkspace = parseFallbackWorkspace();
    if (shouldMigrateFallbackWorkspace(electronWorkspace, fallbackWorkspace)) {
      await window.ditbrowse.saveWorkspace?.(fallbackWorkspace);
      return fallbackWorkspace;
    }

    return electronWorkspace;
  }

  return parseFallbackWorkspace() ?? sampleWorkspace;
}

export async function saveWorkspace(workspace: WorkspaceState): Promise<void> {
  if (window.ditbrowse?.saveWorkspace) {
    await window.ditbrowse.saveWorkspace(workspace);
    return;
  }

  window.localStorage.setItem(fallbackStorageKey, JSON.stringify(workspace));
}

export async function resetCameraSessionData(
  partition: string,
  origin: string
): Promise<void> {
  await window.ditbrowse?.resetCameraSessionData?.(partition, origin);
}

export async function resetListSessionData(partition: string): Promise<void> {
  await window.ditbrowse?.resetListSessionData?.(partition);
}
