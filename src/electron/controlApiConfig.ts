import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type {
  ControlApiBindHost,
  ControlApiConfig,
  ControlApiInfo
} from "../shared/controlApi.js";

const configFileName = "ditbrowse-control-api-config.json";
const runtimeFileName = "ditbrowse-control-api.json";
export const DEFAULT_CONTROL_API_PORT = 52780;
export const DEFAULT_CONTROL_API_BIND_HOST: ControlApiBindHost = "127.0.0.1";

export function controlApiConfigPath(userDataPath: string): string {
  return path.join(userDataPath, configFileName);
}

export function controlApiRuntimePath(userDataPath: string): string {
  return path.join(userDataPath, runtimeFileName);
}

export function normalizeControlApiPort(port: unknown): number | null {
  if (port === null || port === undefined || port === "") {
    return null;
  }

  const parsed = typeof port === "number" ? port : Number(port);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error("Control API port must be an integer between 1 and 65535");
  }

  return parsed;
}

export function normalizeControlApiBindHost(bindHost: unknown): ControlApiBindHost {
  if (bindHost === undefined || bindHost === null || bindHost === "") {
    return DEFAULT_CONTROL_API_BIND_HOST;
  }

  if (bindHost === "127.0.0.1" || bindHost === "0.0.0.0") {
    return bindHost;
  }

  throw new Error('Control API bind host must be "127.0.0.1" or "0.0.0.0"');
}

/** Prefer a non-internal IPv4 address when advertising LAN access. */
export function resolveAdvertisedControlApiHost(bindHost: ControlApiBindHost): string {
  if (bindHost === "127.0.0.1") {
    return "127.0.0.1";
  }

  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const entry of entries ?? []) {
      if (entry.family === "IPv4" && !entry.internal) {
        return entry.address;
      }
    }
  }

  return "0.0.0.0";
}

export function buildControlApiInfo(options: {
  bindHost: ControlApiBindHost;
  port: number;
  configuredPort: number | null;
  error?: string;
}): ControlApiInfo {
  const host = resolveAdvertisedControlApiHost(options.bindHost);
  return {
    host,
    port: options.port,
    baseUrl: `http://${host}:${options.port}`,
    configuredPort: options.configuredPort,
    bindHost: options.bindHost,
    lanAccess: options.bindHost === "0.0.0.0",
    ...(options.error ? { error: options.error } : {})
  };
}

export async function loadControlApiConfig(userDataPath: string): Promise<ControlApiConfig> {
  try {
    const raw = await fs.readFile(controlApiConfigPath(userDataPath), "utf8");
    const parsed = JSON.parse(raw) as Partial<ControlApiConfig>;
    return {
      port: normalizeControlApiPort(parsed.port),
      bindHost: normalizeControlApiBindHost(parsed.bindHost)
    };
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      return {
        port: DEFAULT_CONTROL_API_PORT,
        bindHost: DEFAULT_CONTROL_API_BIND_HOST
      };
    }

    throw error;
  }
}

export async function saveControlApiConfig(
  userDataPath: string,
  config: ControlApiConfig
): Promise<void> {
  await fs.mkdir(userDataPath, { recursive: true });
  await fs.writeFile(
    controlApiConfigPath(userDataPath),
    JSON.stringify(
      {
        port: normalizeControlApiPort(config.port),
        bindHost: normalizeControlApiBindHost(config.bindHost)
      },
      null,
      2
    ),
    "utf8"
  );
}

export async function writeControlApiRuntimeInfo(
  userDataPath: string,
  info: ControlApiInfo
): Promise<void> {
  await fs.mkdir(userDataPath, { recursive: true });
  await fs.writeFile(controlApiRuntimePath(userDataPath), JSON.stringify(info, null, 2), "utf8");
}

export async function removeControlApiRuntimeInfo(userDataPath: string): Promise<void> {
  try {
    await fs.unlink(controlApiRuntimePath(userDataPath));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== "ENOENT") {
      throw error;
    }
  }
}
