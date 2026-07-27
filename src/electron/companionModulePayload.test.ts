import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const scriptPath = path.resolve(process.cwd(), "scripts/stage-companion-module.mjs");

let rootPath: string;
let sourcePath: string;
let basePackagePath: string;
let outputPath: string;

async function writeJson(filePath: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeSourceFixture(options: {
  packageVersion?: string;
  manifestVersion?: string;
  apiVersion?: string;
  baseVersion?: string;
} = {}): Promise<void> {
  const packageVersion = options.packageVersion ?? "0.1.0";
  const manifestVersion = options.manifestVersion ?? packageVersion;
  const apiVersion = options.apiVersion ?? "2.0.4";
  const baseVersion = options.baseVersion ?? apiVersion;

  await mkdir(path.join(sourcePath, "companion"), { recursive: true });
  await writeFile(path.join(sourcePath, "main.js"), "export {};\n", "utf8");
  await writeFile(path.join(sourcePath, "companion/HELP.md"), "# Help\n", "utf8");
  await writeJson(path.join(sourcePath, "package.json"), {
    name: "DIT Browse",
    version: packageVersion,
    type: "module"
  });
  await writeJson(path.join(sourcePath, "companion/manifest.json"), {
    id: "lightlab-ditbrowse",
    version: manifestVersion,
    runtime: { apiVersion, entrypoint: "../main.js" }
  });
  await writeJson(basePackagePath, {
    name: "@companion-module/base",
    version: baseVersion
  });
}

async function runStagingScript(): Promise<void> {
  await execFileAsync(process.execPath, [
    scriptPath,
    "--source",
    sourcePath,
    "--base-package",
    basePackagePath,
    "--output",
    outputPath
  ]);
}

async function listFiles(directory: string, prefix = ""): Promise<string[]> {
  const files: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const relativePath = path.join(prefix, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path.join(directory, entry.name), relativePath)));
    } else {
      files.push(relativePath);
    }
  }
  return files.sort();
}

beforeEach(async () => {
  rootPath = await mkdtemp(path.join(os.tmpdir(), "ditbrowse-companion-payload-"));
  sourcePath = path.join(rootPath, "source");
  basePackagePath = path.join(rootPath, "base", "package.json");
  outputPath = path.join(rootPath, "output", "lightlab-ditbrowse");
});

afterEach(async () => {
  await rm(rootPath, { recursive: true, force: true });
});

describe("stage-companion-module", () => {
  it("creates the exact lean offline module payload", async () => {
    await writeSourceFixture();

    await runStagingScript();

    await expect(listFiles(outputPath)).resolves.toEqual([
      "companion/HELP.md",
      "companion/manifest.json",
      "main.js",
      "node_modules/@companion-module/base/package.json",
      "package.json"
    ]);
  });

  it("rejects mismatched package and manifest versions without output", async () => {
    await writeSourceFixture({ packageVersion: "0.2.0", manifestVersion: "0.1.0" });

    await expect(runStagingScript()).rejects.toThrow(/versions do not match/i);
    await expect(stat(outputPath)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("rejects mismatched module API and base package versions without output", async () => {
    await writeSourceFixture({ apiVersion: "2.0.5", baseVersion: "2.0.4" });

    await expect(runStagingScript()).rejects.toThrow(/API and base package versions/i);
    await expect(stat(outputPath)).rejects.toMatchObject({ code: "ENOENT" });
  });
});
