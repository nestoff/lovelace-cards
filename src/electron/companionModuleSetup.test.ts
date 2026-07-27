import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import type { CompanionModuleInstaller } from "./companionModuleInstaller";
import { chooseAndInstallCompanionModule } from "./companionModuleSetup";

function installerMock(): CompanionModuleInstaller {
  return {
    getStatus: vi.fn(),
    install: vi.fn(async () => ({
      outcome: "installed",
      status: {
        state: "current",
        pathSource: "manual",
        bundledVersion: "1.0.0",
        installedVersion: "1.0.0",
        targetPath: "/tmp/Companion Modules/lightlab-ditbrowse",
        message: "DIT Browse Companion module 1.0.0 is installed.",
        canInstall: false
      }
    })),
    setManualDeveloperModulesPath: vi.fn(async () => undefined)
  };
}

describe("chooseAndInstallCompanionModule", () => {
  it("returns null without changing anything when folder selection is cancelled", async () => {
    const installer = installerMock();
    const showOpenDialog = vi.fn(async () => ({ canceled: true, filePaths: [] }));

    await expect(
      chooseAndInstallCompanionModule({
        browserWindow: {} as never,
        installer,
        showOpenDialog
      })
    ).resolves.toBeNull();

    expect(showOpenDialog).toHaveBeenCalledWith(
      {},
      expect.objectContaining({
        title: "Choose Companion Developer Modules Folder",
        buttonLabel: "Choose Folder & Install",
        properties: ["openDirectory", "createDirectory"]
      })
    );
    expect(installer.setManualDeveloperModulesPath).not.toHaveBeenCalled();
    expect(installer.install).not.toHaveBeenCalled();
  });

  it("saves one selected absolute folder before installing", async () => {
    const installer = installerMock();
    const selectedPath = path.resolve("/tmp/Companion Modules");
    const showOpenDialog = vi.fn(async () => ({
      canceled: false,
      filePaths: [selectedPath]
    }));

    await expect(
      chooseAndInstallCompanionModule({
        browserWindow: {} as never,
        installer,
        showOpenDialog
      })
    ).resolves.toMatchObject({ outcome: "installed" });

    expect(installer.setManualDeveloperModulesPath).toHaveBeenCalledWith(selectedPath);
    expect(installer.install).toHaveBeenCalledOnce();
    expect(
      vi.mocked(installer.setManualDeveloperModulesPath).mock.invocationCallOrder[0]
    ).toBeLessThan(vi.mocked(installer.install).mock.invocationCallOrder[0]);
  });

  it("ignores invalid picker output", async () => {
    const installer = installerMock();
    const showOpenDialog = vi.fn(async () => ({
      canceled: false,
      filePaths: ["relative/modules"]
    }));

    await expect(
      chooseAndInstallCompanionModule({
        browserWindow: {} as never,
        installer,
        showOpenDialog
      })
    ).resolves.toBeNull();
    expect(installer.setManualDeveloperModulesPath).not.toHaveBeenCalled();
  });
});
