import {
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  writeFile
} from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { COMPANION_MODULE_ID } from "../shared/companionModule";
import { createCompanionModuleInstaller } from "./companionModuleInstaller";

interface ModuleFixtureOptions {
  id?: string;
  packageVersion?: string;
  manifestVersion?: string;
  apiVersion?: string;
  baseVersion?: string;
  includeMain?: boolean;
}

let rootPath: string;
let configPath: string;
let manualConfigPath: string;
let bundledModulePath: string;
let developerModulesPath: string;

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeModuleFixture(
  modulePath: string,
  version: string,
  options: ModuleFixtureOptions = {}
): Promise<void> {
  const packageVersion = options.packageVersion ?? version;
  const manifestVersion = options.manifestVersion ?? version;
  const apiVersion = options.apiVersion ?? "2.0.4";
  const baseVersion = options.baseVersion ?? "2.0.4";

  await mkdir(path.join(modulePath, "companion"), { recursive: true });
  await mkdir(path.join(modulePath, "node_modules/@companion-module/base"), {
    recursive: true
  });
  if (options.includeMain !== false) {
    await writeFile(path.join(modulePath, "main.js"), "export {};\n", "utf8");
  }
  await writeFile(path.join(modulePath, "companion/HELP.md"), "# DIT Browse\n", "utf8");
  await writeJson(path.join(modulePath, "package.json"), {
    name: "DIT Browse",
    version: packageVersion,
    type: "module"
  });
  await writeJson(path.join(modulePath, "companion/manifest.json"), {
    id: options.id ?? COMPANION_MODULE_ID,
    version: manifestVersion,
    runtime: {
      apiVersion,
      entrypoint: "../main.js"
    }
  });
  await writeJson(path.join(modulePath, "node_modules/@companion-module/base/package.json"), {
    name: "@companion-module/base",
    version: baseVersion
  });
}

async function writeCompanionConfig(
  overrides: Record<string, unknown> = {}
): Promise<void> {
  await writeJson(configPath, {
    enable_developer: true,
    dev_modules_path: developerModulesPath,
    ...overrides
  });
}

function createInstaller(
  options: Partial<Parameters<typeof createCompanionModuleInstaller>[0]> = {}
) {
  return createCompanionModuleInstaller({
    configPath,
    manualConfigPath,
    bundledModulePath,
    ...options
  });
}

async function targetVersion(): Promise<string> {
  const raw = await readFile(
    path.join(developerModulesPath, COMPANION_MODULE_ID, "package.json"),
    "utf8"
  );
  return (JSON.parse(raw) as { version: string }).version;
}

async function temporaryEntries(): Promise<string[]> {
  const entries = await readdir(developerModulesPath);
  return entries.filter(
    (entry) =>
      entry.startsWith(`.${COMPANION_MODULE_ID}.install-`) ||
      entry.startsWith(`.${COMPANION_MODULE_ID}.backup-`)
  );
}

beforeEach(async () => {
  rootPath = await mkdtemp(path.join(os.tmpdir(), "ditbrowse-companion-installer-"));
  configPath = path.join(rootPath, "Library/Application Support/companion/config.json");
  manualConfigPath = path.join(rootPath, "DITBrowse/companion-module.json");
  bundledModulePath = path.join(rootPath, "bundled", COMPANION_MODULE_ID);
  developerModulesPath = path.join(rootPath, "Documents/Companion/Devmodules");
  await writeModuleFixture(bundledModulePath, "0.2.0");
  await writeCompanionConfig();
});

afterEach(async () => {
  await rm(rootPath, { recursive: true, force: true });
});

describe("companionModuleInstaller", () => {
  it("installs a missing module and reports the installed version", async () => {
    const installer = createInstaller();

    await expect(installer.getStatus()).resolves.toMatchObject({
      state: "missing",
      bundledVersion: "0.2.0",
      installedVersion: null,
      targetPath: path.join(developerModulesPath, COMPANION_MODULE_ID),
      canInstall: true
    });

    await expect(installer.install()).resolves.toMatchObject({
      outcome: "installed",
      status: {
        state: "current",
        bundledVersion: "0.2.0",
        installedVersion: "0.2.0",
        canInstall: false
      }
    });
    await expect(targetVersion()).resolves.toBe("0.2.0");
    await expect(
      lstat(
        path.join(
          developerModulesPath,
          COMPANION_MODULE_ID,
          "node_modules/@companion-module/base/package.json"
        )
      )
    ).resolves.toBeDefined();
    await expect(temporaryEntries()).resolves.toEqual([]);
  });

  it("updates an older module and removes obsolete files", async () => {
    const targetPath = path.join(developerModulesPath, COMPANION_MODULE_ID);
    await writeModuleFixture(targetPath, "0.1.0");
    await writeFile(path.join(targetPath, "obsolete.txt"), "old", "utf8");
    const installer = createInstaller();

    await expect(installer.getStatus()).resolves.toMatchObject({
      state: "outdated",
      bundledVersion: "0.2.0",
      installedVersion: "0.1.0",
      canInstall: true
    });
    await expect(installer.install()).resolves.toMatchObject({ outcome: "updated" });
    await expect(targetVersion()).resolves.toBe("0.2.0");
    await expect(lstat(path.join(targetPath, "obsolete.txt"))).rejects.toMatchObject({
      code: "ENOENT"
    });
    await expect(temporaryEntries()).resolves.toEqual([]);
  });

  it("leaves an equal installed version untouched", async () => {
    const targetPath = path.join(developerModulesPath, COMPANION_MODULE_ID);
    await writeModuleFixture(targetPath, "0.2.0");
    await writeFile(path.join(targetPath, "operator-note.txt"), "keep", "utf8");
    const installer = createInstaller();

    await expect(installer.getStatus()).resolves.toMatchObject({
      state: "current",
      canInstall: false
    });
    await expect(installer.install()).resolves.toMatchObject({
      outcome: "unchanged",
      status: { state: "current" }
    });
    await expect(readFile(path.join(targetPath, "operator-note.txt"), "utf8")).resolves.toBe(
      "keep"
    );
  });

  it("leaves a newer installed version untouched", async () => {
    const targetPath = path.join(developerModulesPath, COMPANION_MODULE_ID);
    await writeModuleFixture(targetPath, "0.3.0");
    const installer = createInstaller();

    await expect(installer.getStatus()).resolves.toMatchObject({
      state: "newer",
      bundledVersion: "0.2.0",
      installedVersion: "0.3.0",
      canInstall: false
    });
    await expect(installer.install()).resolves.toMatchObject({
      outcome: "unchanged",
      status: { state: "newer" }
    });
    await expect(targetVersion()).resolves.toBe("0.3.0");
  });

  it("uses semantic-version prerelease precedence", async () => {
    await rm(bundledModulePath, { recursive: true, force: true });
    await writeModuleFixture(bundledModulePath, "1.0.0");
    await writeModuleFixture(
      path.join(developerModulesPath, COMPANION_MODULE_ID),
      "1.0.0-beta.10"
    );

    await expect(createInstaller().getStatus()).resolves.toMatchObject({
      state: "outdated",
      bundledVersion: "1.0.0",
      installedVersion: "1.0.0-beta.10"
    });
  });

  it("reports missing, disabled, and relative Companion configuration", async () => {
    await rm(configPath, { force: true });
    await expect(createInstaller().getStatus()).resolves.toMatchObject({
      state: "not_configured",
      bundledVersion: "0.2.0",
      targetPath: null,
      canInstall: false
    });

    await writeCompanionConfig({ enable_developer: false });
    await expect(createInstaller().getStatus()).resolves.toMatchObject({
      state: "not_configured",
      canInstall: false
    });

    await writeCompanionConfig({ dev_modules_path: "relative/Devmodules" });
    await expect(createInstaller().getStatus()).resolves.toMatchObject({
      state: "not_configured",
      canInstall: false
    });
  });

  it("uses a saved manual path when Companion configuration is unavailable", async () => {
    const manualDeveloperModulesPath = path.join(rootPath, "Manual Companion Modules");
    await rm(configPath, { force: true });
    const installer = createInstaller();

    await installer.setManualDeveloperModulesPath(manualDeveloperModulesPath);
    await expect(installer.getStatus()).resolves.toMatchObject({
      state: "missing",
      pathSource: "manual",
      targetPath: path.join(manualDeveloperModulesPath, COMPANION_MODULE_ID),
      canInstall: true
    });
    await expect(lstat(manualDeveloperModulesPath)).rejects.toMatchObject({ code: "ENOENT" });

    await expect(installer.install()).resolves.toMatchObject({
      outcome: "installed",
      status: { state: "current", pathSource: "manual" }
    });
  });

  it("prefers a valid Companion configuration over the saved manual path", async () => {
    const manualDeveloperModulesPath = path.join(rootPath, "Manual Companion Modules");
    const installer = createInstaller();
    await installer.setManualDeveloperModulesPath(manualDeveloperModulesPath);

    await expect(installer.getStatus()).resolves.toMatchObject({
      state: "missing",
      pathSource: "companion",
      targetPath: path.join(developerModulesPath, COMPANION_MODULE_ID)
    });
  });

  it("rejects a relative manual developer-module path", async () => {
    await expect(
      createInstaller().setManualDeveloperModulesPath("relative/modules")
    ).rejects.toThrow(/absolute/i);
  });

  it("does not overwrite foreign or malformed installed modules", async () => {
    const targetPath = path.join(developerModulesPath, COMPANION_MODULE_ID);
    await writeModuleFixture(targetPath, "0.1.0", { id: "someone-else-module" });
    const installer = createInstaller();

    await expect(installer.getStatus()).resolves.toMatchObject({
      state: "invalid",
      canInstall: false
    });
    await expect(installer.install()).rejects.toThrow(/cannot be installed/i);
    await expect(targetVersion()).resolves.toBe("0.1.0");

    await rm(targetPath, { recursive: true, force: true });
    await writeModuleFixture(targetPath, "not-a-version");
    await expect(installer.getStatus()).resolves.toMatchObject({
      state: "invalid",
      installedVersion: null,
      canInstall: false
    });
  });

  it("reports an invalid bundled payload without touching Companion", async () => {
    await rm(path.join(bundledModulePath, "main.js"));
    const installer = createInstaller();

    await expect(installer.getStatus()).resolves.toMatchObject({
      state: "error",
      bundledVersion: null,
      installedVersion: null,
      targetPath: null,
      canInstall: false
    });
    await expect(installer.install()).rejects.toThrow(/bundled Companion module/i);
    await expect(lstat(developerModulesPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("restores the previous module when the final rename fails", async () => {
    const targetPath = path.join(developerModulesPath, COMPANION_MODULE_ID);
    await writeModuleFixture(targetPath, "0.1.0");
    const renameWithFailure: typeof rename = vi.fn(async (from, to) => {
      if (
        String(from).includes(`.${COMPANION_MODULE_ID}.install-`) &&
        String(to) === targetPath
      ) {
        throw new Error("simulated final rename failure");
      }
      await rename(from, to);
    });
    const installer = createInstaller({ rename: renameWithFailure });

    await expect(installer.install()).rejects.toThrow(/simulated final rename failure/i);
    await expect(targetVersion()).resolves.toBe("0.1.0");
    await expect(temporaryEntries()).resolves.toEqual([]);
  });
});
