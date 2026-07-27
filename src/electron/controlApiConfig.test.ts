import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildControlApiInfo,
  controlApiConfigPath,
  controlApiRuntimePath,
  loadControlApiConfig,
  normalizeControlApiBindHost,
  normalizeControlApiPort,
  removeControlApiRuntimeInfo,
  saveControlApiConfig,
  writeControlApiRuntimeInfo
} from "./controlApiConfig";

async function tempUserData(): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), "ditbrowse-control-api-"));
}

describe("controlApiConfig", () => {
  it("defaults to the Companion port when no config exists", async () => {
    const userDataPath = await tempUserData();

    await expect(loadControlApiConfig(userDataPath)).resolves.toEqual({
      port: 52780,
      bindHost: "127.0.0.1"
    });
  });

  it("preserves an explicitly saved automatic port", async () => {
    const userDataPath = await tempUserData();

    await saveControlApiConfig(userDataPath, { port: null, bindHost: "127.0.0.1" });

    await expect(loadControlApiConfig(userDataPath)).resolves.toEqual({
      port: null,
      bindHost: "127.0.0.1"
    });
  });

  it("saves and loads a fixed control API port with LAN bind", async () => {
    const userDataPath = await tempUserData();

    await saveControlApiConfig(userDataPath, { port: 54321, bindHost: "0.0.0.0" });

    await expect(loadControlApiConfig(userDataPath)).resolves.toEqual({
      port: 54321,
      bindHost: "0.0.0.0"
    });
    await expect(fs.readFile(controlApiConfigPath(userDataPath), "utf8")).resolves.toContain(
      "54321"
    );
    await expect(fs.readFile(controlApiConfigPath(userDataPath), "utf8")).resolves.toContain(
      "0.0.0.0"
    );
  });

  it("validates fixed ports and bind hosts", () => {
    expect(normalizeControlApiPort(null)).toBeNull();
    expect(normalizeControlApiPort("54000")).toBe(54000);
    expect(() => normalizeControlApiPort(0)).toThrow(/between 1 and 65535/);
    expect(() => normalizeControlApiPort(70000)).toThrow(/between 1 and 65535/);
    expect(normalizeControlApiBindHost(undefined)).toBe("127.0.0.1");
    expect(normalizeControlApiBindHost("0.0.0.0")).toBe("0.0.0.0");
    expect(() => normalizeControlApiBindHost("192.168.1.1")).toThrow(/bind host/);
  });

  it("builds advertised info for LAN bind", () => {
    const info = buildControlApiInfo({
      bindHost: "127.0.0.1",
      port: 52780,
      configuredPort: 52780
    });
    expect(info).toMatchObject({
      host: "127.0.0.1",
      baseUrl: "http://127.0.0.1:52780",
      lanAccess: false,
      bindHost: "127.0.0.1"
    });
  });

  it("writes and removes runtime info for external clients", async () => {
    const userDataPath = await tempUserData();

    await writeControlApiRuntimeInfo(userDataPath, {
      host: "127.0.0.1",
      port: 54321,
      baseUrl: "http://127.0.0.1:54321",
      configuredPort: 54321,
      bindHost: "127.0.0.1",
      lanAccess: false
    });

    await expect(fs.readFile(controlApiRuntimePath(userDataPath), "utf8")).resolves.toContain(
      "http://127.0.0.1:54321"
    );

    await removeControlApiRuntimeInfo(userDataPath);

    await expect(fs.stat(controlApiRuntimePath(userDataPath))).rejects.toMatchObject({
      code: "ENOENT"
    });
  });
});
