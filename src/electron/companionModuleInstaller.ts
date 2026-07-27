import { randomUUID } from "node:crypto";
import * as fs from "node:fs/promises";
import path from "node:path";
import {
  COMPANION_MODULE_ID,
  type CompanionModuleInstallResult,
  type CompanionModuleInstallStatus
} from "../shared/companionModule.js";
import {
  loadCompanionModuleConfig,
  saveCompanionModuleConfig
} from "./companionModuleConfig.js";

interface CompanionConfig {
  enable_developer?: unknown;
  dev_modules_path?: unknown;
}

interface ModuleMetadata {
  version: string;
  apiVersion: string;
}

interface ParsedSemver {
  core: [bigint, bigint, bigint];
  prerelease: Array<bigint | string> | null;
}

export interface CompanionModuleInstallerOptions {
  configPath: string;
  manualConfigPath: string;
  bundledModulePath: string;
  rename?: typeof fs.rename;
}

export interface CompanionModuleInstaller {
  getStatus(): Promise<CompanionModuleInstallStatus>;
  install(): Promise<CompanionModuleInstallResult>;
  setManualDeveloperModulesPath(developerModulesPath: string): Promise<void>;
}

const semverPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function parseSemver(version: string): ParsedSemver | null {
  const match = semverPattern.exec(version);
  if (!match) {
    return null;
  }

  const prerelease = match[4]
    ? match[4].split(".").map((identifier): bigint | string => {
        if (/^\d+$/.test(identifier)) {
          if (identifier.length > 1 && identifier.startsWith("0")) {
            throw new Error(`Invalid semantic version ${version}`);
          }
          return BigInt(identifier);
        }
        return identifier;
      })
    : null;

  return {
    core: [BigInt(match[1]), BigInt(match[2]), BigInt(match[3])],
    prerelease
  };
}

function requireSemver(version: unknown, label: string): string {
  if (typeof version !== "string" || !version.trim()) {
    throw new Error(`${label} does not declare a version`);
  }
  try {
    if (!parseSemver(version)) {
      throw new Error(`${label} version ${version} is not valid semantic versioning`);
    }
  } catch {
    throw new Error(`${label} version ${version} is not valid semantic versioning`);
  }
  return version;
}

function compareIdentifiers(left: bigint | string, right: bigint | string): number {
  if (typeof left === "bigint" && typeof right === "bigint") {
    return left < right ? -1 : left > right ? 1 : 0;
  }
  if (typeof left === "bigint") {
    return -1;
  }
  if (typeof right === "bigint") {
    return 1;
  }
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareSemver(leftVersion: string, rightVersion: string): number {
  const left = parseSemver(leftVersion);
  const right = parseSemver(rightVersion);
  if (!left || !right) {
    throw new Error("Cannot compare invalid semantic versions");
  }

  for (let index = 0; index < left.core.length; index += 1) {
    if (left.core[index] < right.core[index]) {
      return -1;
    }
    if (left.core[index] > right.core[index]) {
      return 1;
    }
  }

  if (!left.prerelease && !right.prerelease) {
    return 0;
  }
  if (!left.prerelease) {
    return 1;
  }
  if (!right.prerelease) {
    return -1;
  }

  const length = Math.max(left.prerelease.length, right.prerelease.length);
  for (let index = 0; index < length; index += 1) {
    if (left.prerelease[index] === undefined) {
      return -1;
    }
    if (right.prerelease[index] === undefined) {
      return 1;
    }
    const comparison = compareIdentifiers(left.prerelease[index], right.prerelease[index]);
    if (comparison !== 0) {
      return comparison;
    }
  }

  return 0;
}

async function readJsonObject(filePath: string, label: string): Promise<Record<string, unknown>> {
  const raw = await fs.readFile(filePath, "utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!isRecord(parsed)) {
    throw new Error(`${label} is not a JSON object`);
  }
  return parsed;
}

async function requireRegularFile(filePath: string, label: string): Promise<void> {
  const stats = await fs.lstat(filePath);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error(`${label} is not a regular file`);
  }
}

async function readModuleMetadata(modulePath: string): Promise<ModuleMetadata> {
  const mainPath = path.join(modulePath, "main.js");
  const helpPath = path.join(modulePath, "companion", "HELP.md");
  const packagePath = path.join(modulePath, "package.json");
  const manifestPath = path.join(modulePath, "companion", "manifest.json");
  const basePackagePath = path.join(
    modulePath,
    "node_modules",
    "@companion-module",
    "base",
    "package.json"
  );

  await Promise.all([
    requireRegularFile(mainPath, "Module entrypoint"),
    requireRegularFile(helpPath, "Module help"),
    requireRegularFile(packagePath, "Module package"),
    requireRegularFile(manifestPath, "Module manifest"),
    requireRegularFile(basePackagePath, "Companion base package metadata")
  ]);

  const [packageManifest, manifest, baseManifest] = await Promise.all([
    readJsonObject(packagePath, "Module package"),
    readJsonObject(manifestPath, "Module manifest"),
    readJsonObject(basePackagePath, "Companion base package metadata")
  ]);
  const runtime = manifest.runtime;
  if (!isRecord(runtime)) {
    throw new Error("Module manifest does not declare a runtime");
  }
  if (manifest.id !== COMPANION_MODULE_ID) {
    throw new Error(`Module manifest ID is not ${COMPANION_MODULE_ID}`);
  }
  if (runtime.entrypoint !== "../main.js") {
    throw new Error("Module manifest entrypoint is not ../main.js");
  }
  if (baseManifest.name !== "@companion-module/base") {
    throw new Error("Companion base package metadata has the wrong package name");
  }

  const packageVersion = requireSemver(packageManifest.version, "Module package");
  const manifestVersion = requireSemver(manifest.version, "Module manifest");
  const apiVersion = requireSemver(runtime.apiVersion, "Module API");
  const baseVersion = requireSemver(baseManifest.version, "Companion base package");
  if (packageVersion !== manifestVersion) {
    throw new Error("Module package and manifest versions do not match");
  }
  if (apiVersion !== baseVersion) {
    throw new Error("Module API and Companion base package versions do not match");
  }

  return { version: packageVersion, apiVersion };
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await fs.lstat(filePath);
    return true;
  } catch (error) {
    if (isRecord(error) && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

function status(
  values: Omit<
    CompanionModuleInstallStatus,
    "installedVersion" | "targetPath" | "pathSource"
  > &
    Partial<
      Pick<
        CompanionModuleInstallStatus,
        "installedVersion" | "targetPath" | "pathSource"
      >
    >
): CompanionModuleInstallStatus {
  return {
    installedVersion: null,
    targetPath: null,
    pathSource: null,
    ...values
  };
}

export function createCompanionModuleInstaller(
  options: CompanionModuleInstallerOptions
): CompanionModuleInstaller {
  const renamePath = options.rename ?? fs.rename;

  const getStatus = async (): Promise<CompanionModuleInstallStatus> => {
    let bundledMetadata: ModuleMetadata;
    try {
      bundledMetadata = await readModuleMetadata(options.bundledModulePath);
    } catch (error) {
      return status({
        state: "error",
        bundledVersion: null,
        message: `Bundled Companion module is unavailable or invalid: ${errorMessage(error)}`,
        canInstall: false
      });
    }

    let developerModulesPath: string | null = null;
    let pathSource: CompanionModuleInstallStatus["pathSource"] = null;
    let companionConfigError = "";
    try {
      const companionConfig = (await readJsonObject(
        options.configPath,
        "Companion configuration"
      )) as CompanionConfig;
      if (
        companionConfig.enable_developer === true &&
        typeof companionConfig.dev_modules_path === "string" &&
        path.isAbsolute(companionConfig.dev_modules_path)
      ) {
        developerModulesPath = companionConfig.dev_modules_path;
        pathSource = "companion";
      } else {
        companionConfigError =
          "Enable developer modules and select an absolute developer-module path in Companion.";
      }
    } catch (error) {
      companionConfigError = `Companion developer modules are not configured: ${errorMessage(error)}`;
    }

    if (!developerModulesPath) {
      const manualConfig = await loadCompanionModuleConfig(
        path.dirname(options.manualConfigPath)
      );
      if (manualConfig.developerModulesPath) {
        developerModulesPath = manualConfig.developerModulesPath;
        pathSource = "manual";
      }
    }

    if (!developerModulesPath) {
      return status({
        state: "not_configured",
        bundledVersion: bundledMetadata.version,
        message: companionConfigError,
        canInstall: false
      });
    }

    const targetPath = path.join(developerModulesPath, COMPANION_MODULE_ID);
    try {
      if (!(await pathExists(targetPath))) {
        return status({
          state: "missing",
          pathSource,
          bundledVersion: bundledMetadata.version,
          targetPath,
          message: "DIT Browse Companion module is not installed.",
          canInstall: true
        });
      }

      const targetStats = await fs.lstat(targetPath);
      if (!targetStats.isDirectory() || targetStats.isSymbolicLink()) {
        throw new Error("the module target is not a regular directory");
      }

      const installedMetadata = await readModuleMetadata(targetPath);
      const comparison = compareSemver(installedMetadata.version, bundledMetadata.version);
      if (comparison < 0) {
        return status({
          state: "outdated",
          pathSource,
          bundledVersion: bundledMetadata.version,
          installedVersion: installedMetadata.version,
          targetPath,
          message: `Companion module ${installedMetadata.version} can be updated to ${bundledMetadata.version}.`,
          canInstall: true
        });
      }
      if (comparison > 0) {
        return status({
          state: "newer",
          pathSource,
          bundledVersion: bundledMetadata.version,
          installedVersion: installedMetadata.version,
          targetPath,
          message: `A newer Companion module (${installedMetadata.version}) is already installed.`,
          canInstall: false
        });
      }
      return status({
        state: "current",
        pathSource,
        bundledVersion: bundledMetadata.version,
        installedVersion: installedMetadata.version,
        targetPath,
        message: `DIT Browse Companion module ${installedMetadata.version} is installed.`,
        canInstall: false
      });
    } catch (error) {
      return status({
        state: "invalid",
        pathSource,
        bundledVersion: bundledMetadata.version,
        targetPath,
        message: `The existing ${COMPANION_MODULE_ID} folder is not a valid DIT Browse Companion module: ${errorMessage(error)}`,
        canInstall: false
      });
    }
  };

  const setManualDeveloperModulesPath = async (
    developerModulesPath: string
  ): Promise<void> => {
    if (!path.isAbsolute(developerModulesPath)) {
      throw new Error("Companion developer-module path must be absolute");
    }
    await saveCompanionModuleConfig(path.dirname(options.manualConfigPath), {
      developerModulesPath
    });
  };

  const install = async (): Promise<CompanionModuleInstallResult> => {
    const before = await getStatus();
    if (before.state === "current" || before.state === "newer") {
      return { outcome: "unchanged", status: before };
    }
    if (!before.canInstall || !before.targetPath || !before.bundledVersion) {
      throw new Error(`DIT Browse Companion module cannot be installed: ${before.message}`);
    }

    const targetPath = before.targetPath;
    const parentPath = path.dirname(targetPath);
    const stagingPath = path.join(
      parentPath,
      `.${COMPANION_MODULE_ID}.install-${randomUUID()}`
    );
    const backupPath = path.join(
      parentPath,
      `.${COMPANION_MODULE_ID}.backup-${randomUUID()}`
    );
    let backupMoved = false;
    let targetInstalled = false;

    await fs.mkdir(parentPath, { recursive: true });
    try {
      await fs.cp(options.bundledModulePath, stagingPath, {
        recursive: true,
        dereference: false,
        errorOnExist: true,
        force: false
      });
      const stagedMetadata = await readModuleMetadata(stagingPath);
      if (stagedMetadata.version !== before.bundledVersion) {
        throw new Error("Staged Companion module version changed during installation");
      }

      const refreshed = await getStatus();
      if (refreshed.state === "current" || refreshed.state === "newer") {
        return { outcome: "unchanged", status: refreshed };
      }
      if (
        !refreshed.canInstall ||
        refreshed.targetPath !== targetPath ||
        refreshed.bundledVersion !== before.bundledVersion
      ) {
        throw new Error(`Companion module state changed during installation: ${refreshed.message}`);
      }
      const outcome = refreshed.state === "missing" ? "installed" : "updated";

      if (refreshed.state === "outdated") {
        await renamePath(targetPath, backupPath);
        backupMoved = true;
      }

      try {
        await renamePath(stagingPath, targetPath);
        targetInstalled = true;
      } catch (error) {
        if (backupMoved) {
          try {
            await renamePath(backupPath, targetPath);
            backupMoved = false;
          } catch (restoreError) {
            throw new Error(
              `${errorMessage(error)}; restoring the previous module also failed: ${errorMessage(restoreError)}`
            );
          }
        }
        throw error;
      }

      if (backupMoved) {
        await fs.rm(backupPath, { recursive: true, force: true });
        backupMoved = false;
      }

      const after = await getStatus();
      if (after.state !== "current") {
        throw new Error(`Installed Companion module did not validate: ${after.message}`);
      }
      return { outcome, status: after };
    } catch (error) {
      if (!targetInstalled && backupMoved) {
        try {
          await renamePath(backupPath, targetPath);
          backupMoved = false;
        } catch (restoreError) {
          throw new Error(
            `Could not install the Companion module: ${errorMessage(error)}; restoring the previous module also failed: ${errorMessage(restoreError)}`
          );
        }
      }
      throw new Error(`Could not install the Companion module: ${errorMessage(error)}`);
    } finally {
      await fs.rm(stagingPath, { recursive: true, force: true });
      if (targetInstalled) {
        await fs.rm(backupPath, { recursive: true, force: true });
      }
    }
  };

  return { getStatus, install, setManualDeveloperModulesPath };
}
