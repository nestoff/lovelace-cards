export const COMPANION_MODULE_ID = "lightlab-ditbrowse";

export type CompanionModuleInstallState =
  | "not_configured"
  | "missing"
  | "outdated"
  | "current"
  | "newer"
  | "invalid"
  | "error";

export interface CompanionModuleInstallStatus {
  state: CompanionModuleInstallState;
  pathSource: "companion" | "manual" | null;
  bundledVersion: string | null;
  installedVersion: string | null;
  targetPath: string | null;
  message: string;
  canInstall: boolean;
}

export interface CompanionModuleInstallResult {
  outcome: "installed" | "updated" | "unchanged";
  status: CompanionModuleInstallStatus;
}
