import path from "node:path";
import type {
  BrowserWindow,
  OpenDialogOptions,
  OpenDialogReturnValue
} from "electron";
import type { CompanionModuleInstallResult } from "../shared/companionModule.js";
import type { CompanionModuleInstaller } from "./companionModuleInstaller.js";

export type ShowOpenDialog = (
  browserWindow: BrowserWindow,
  options: OpenDialogOptions
) => Promise<OpenDialogReturnValue>;

export interface ChooseAndInstallCompanionModuleOptions {
  browserWindow: BrowserWindow;
  installer: CompanionModuleInstaller;
  showOpenDialog: ShowOpenDialog;
}

export async function chooseAndInstallCompanionModule(
  options: ChooseAndInstallCompanionModuleOptions
): Promise<CompanionModuleInstallResult | null> {
  const result = await options.showOpenDialog(options.browserWindow, {
    title: "Choose Companion Developer Modules Folder",
    buttonLabel: "Choose Folder & Install",
    properties: ["openDirectory", "createDirectory"]
  });
  const selectedPath = result.filePaths.length === 1 ? result.filePaths[0] : "";
  if (result.canceled || !selectedPath || !path.isAbsolute(selectedPath)) {
    return null;
  }

  await options.installer.setManualDeveloperModulesPath(selectedPath);
  return options.installer.install();
}
