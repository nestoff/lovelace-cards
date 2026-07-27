import fs from "node:fs/promises";
import path from "node:path";
import {
  DEFAULT_SWP08_CONFIG,
  normalizeSwp08Config,
  type Swp08Config
} from "../shared/swp08Config.js";

export {
  DEFAULT_SWP08_CONFIG,
  normalizeSwp08Config,
  normalizeSwp08Port,
  normalizePositiveInt,
  type Swp08Config,
  type Swp08Info
} from "../shared/swp08Config.js";

const configFileName = "ditbrowse-swp08-config.json";

export function swp08ConfigPath(userDataPath: string): string {
  return path.join(userDataPath, configFileName);
}

export async function loadSwp08Config(userDataPath: string): Promise<Swp08Config> {
  try {
    const raw = await fs.readFile(swp08ConfigPath(userDataPath), "utf8");
    return normalizeSwp08Config(JSON.parse(raw) as Partial<Swp08Config>);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return { ...DEFAULT_SWP08_CONFIG };
    }
    throw error;
  }
}

export async function saveSwp08Config(userDataPath: string, config: Swp08Config): Promise<void> {
  await fs.mkdir(userDataPath, { recursive: true });
  await fs.writeFile(
    swp08ConfigPath(userDataPath),
    JSON.stringify(normalizeSwp08Config(config), null, 2),
    "utf8"
  );
}
