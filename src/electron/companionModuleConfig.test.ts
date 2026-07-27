import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  companionModuleConfigPath,
  loadCompanionModuleConfig,
  saveCompanionModuleConfig
} from "./companionModuleConfig";

let userDataPath: string;

beforeEach(async () => {
  userDataPath = await mkdtemp(path.join(os.tmpdir(), "ditbrowse-companion-config-"));
});

afterEach(async () => {
  await rm(userDataPath, { recursive: true, force: true });
});

describe("companion module config", () => {
  it("defaults to no manual developer-module path", async () => {
    await expect(loadCompanionModuleConfig(userDataPath)).resolves.toEqual({
      developerModulesPath: null
    });
  });

  it("saves and reloads an absolute developer-module path", async () => {
    const developerModulesPath = "/Users/operator/Companion Modules";
    await saveCompanionModuleConfig(userDataPath, { developerModulesPath });

    await expect(loadCompanionModuleConfig(userDataPath)).resolves.toEqual({
      developerModulesPath
    });
    await expect(readFile(companionModuleConfigPath(userDataPath), "utf8")).resolves.toBe(
      `${JSON.stringify({ developerModulesPath }, null, 2)}\n`
    );
  });

  it("rejects relative paths when saving", async () => {
    await expect(
      saveCompanionModuleConfig(userDataPath, {
        developerModulesPath: "relative/modules"
      })
    ).rejects.toThrow(/absolute/i);
  });

  it.each([
    "not json",
    "[]",
    JSON.stringify({ developerModulesPath: 42 }),
    JSON.stringify({ developerModulesPath: "" }),
    JSON.stringify({ developerModulesPath: "relative/modules" })
  ])("ignores malformed or invalid config: %s", async (contents) => {
    await mkdir(userDataPath, { recursive: true });
    await writeFile(companionModuleConfigPath(userDataPath), contents, "utf8");

    await expect(loadCompanionModuleConfig(userDataPath)).resolves.toEqual({
      developerModulesPath: null
    });
  });
});
