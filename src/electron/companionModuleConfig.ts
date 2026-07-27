import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export interface CompanionModuleConfig {
  developerModulesPath: string | null;
}

const defaultConfig: CompanionModuleConfig = {
  developerModulesPath: null
};

export function companionModuleConfigPath(userDataPath: string): string {
  return path.join(userDataPath, "companion-module.json");
}

export async function loadCompanionModuleConfig(
  userDataPath: string
): Promise<CompanionModuleConfig> {
  try {
    const raw = await readFile(companionModuleConfigPath(userDataPath), "utf8");
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return defaultConfig;
    }

    const developerModulesPath = (parsed as Record<string, unknown>).developerModulesPath;
    return typeof developerModulesPath === "string" &&
      developerModulesPath.trim() &&
      path.isAbsolute(developerModulesPath)
      ? { developerModulesPath }
      : defaultConfig;
  } catch {
    return defaultConfig;
  }
}

export async function saveCompanionModuleConfig(
  userDataPath: string,
  config: CompanionModuleConfig
): Promise<void> {
  if (
    config.developerModulesPath !== null &&
    (!config.developerModulesPath.trim() || !path.isAbsolute(config.developerModulesPath))
  ) {
    throw new Error("Companion developer-module path must be absolute");
  }

  await mkdir(userDataPath, { recursive: true });
  await writeFile(
    companionModuleConfigPath(userDataPath),
    `${JSON.stringify(config, null, 2)}\n`,
    "utf8"
  );
}
