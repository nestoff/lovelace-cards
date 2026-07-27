import { randomUUID } from "node:crypto";
import {
  copyFile,
  lstat,
  mkdir,
  readFile,
  rename,
  rm
} from "node:fs/promises";
import path from "node:path";

const MODULE_ID = "lightlab-ditbrowse";

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseArguments(values) {
  const options = new Map();
  for (let index = 0; index < values.length; index += 2) {
    const key = values[index];
    const value = values[index + 1];
    if (!key?.startsWith("--") || !value) {
      throw new Error(
        "Usage: stage-companion-module.mjs --source <path> --base-package <path> --output <path>"
      );
    }
    options.set(key, path.resolve(value));
  }

  const sourcePath = options.get("--source");
  const basePackagePath = options.get("--base-package");
  const outputPath = options.get("--output");
  if (!sourcePath || !basePackagePath || !outputPath || options.size !== 3) {
    throw new Error(
      "Usage: stage-companion-module.mjs --source <path> --base-package <path> --output <path>"
    );
  }
  return { sourcePath, basePackagePath, outputPath };
}

async function readJsonObject(filePath, label) {
  const parsed = JSON.parse(await readFile(filePath, "utf8"));
  if (!isRecord(parsed)) {
    throw new Error(`${label} is not a JSON object`);
  }
  return parsed;
}

async function requireRegularFile(filePath, label) {
  const stats = await lstat(filePath);
  if (!stats.isFile() || stats.isSymbolicLink()) {
    throw new Error(`${label} is not a regular file`);
  }
}

async function validatePayload(sourcePath, basePackagePath) {
  const mainPath = path.join(sourcePath, "main.js");
  const packagePath = path.join(sourcePath, "package.json");
  const helpPath = path.join(sourcePath, "companion", "HELP.md");
  const manifestPath = path.join(sourcePath, "companion", "manifest.json");
  await Promise.all([
    requireRegularFile(mainPath, "Module entrypoint"),
    requireRegularFile(packagePath, "Module package"),
    requireRegularFile(helpPath, "Module help"),
    requireRegularFile(manifestPath, "Module manifest"),
    requireRegularFile(basePackagePath, "Companion base package metadata")
  ]);

  const [packageManifest, manifest, baseManifest] = await Promise.all([
    readJsonObject(packagePath, "Module package"),
    readJsonObject(manifestPath, "Module manifest"),
    readJsonObject(basePackagePath, "Companion base package metadata")
  ]);
  if (!isRecord(manifest.runtime)) {
    throw new Error("Module manifest does not declare a runtime");
  }
  if (manifest.id !== MODULE_ID) {
    throw new Error(`Module manifest ID must be ${MODULE_ID}`);
  }
  if (
    typeof packageManifest.version !== "string" ||
    packageManifest.version !== manifest.version
  ) {
    throw new Error("Module package and manifest versions do not match");
  }
  if (manifest.runtime.entrypoint !== "../main.js") {
    throw new Error("Module manifest entrypoint must be ../main.js");
  }
  if (baseManifest.name !== "@companion-module/base") {
    throw new Error("Companion base package metadata has the wrong package name");
  }
  if (
    typeof baseManifest.version !== "string" ||
    manifest.runtime.apiVersion !== baseManifest.version
  ) {
    throw new Error("Module API and base package versions do not match");
  }

  return {
    version: packageManifest.version,
    files: { mainPath, packagePath, helpPath, manifestPath, basePackagePath }
  };
}

async function stageCompanionModule({ sourcePath, basePackagePath, outputPath }) {
  const source = await validatePayload(sourcePath, basePackagePath);
  const parentPath = path.dirname(outputPath);
  const stagingPath = path.join(parentPath, `.${path.basename(outputPath)}.stage-${randomUUID()}`);
  const stagedBasePackagePath = path.join(
    stagingPath,
    "node_modules",
    "@companion-module",
    "base",
    "package.json"
  );

  await mkdir(path.join(stagingPath, "companion"), { recursive: true });
  await mkdir(path.dirname(stagedBasePackagePath), { recursive: true });
  try {
    await Promise.all([
      copyFile(source.files.mainPath, path.join(stagingPath, "main.js")),
      copyFile(source.files.packagePath, path.join(stagingPath, "package.json")),
      copyFile(source.files.helpPath, path.join(stagingPath, "companion", "HELP.md")),
      copyFile(
        source.files.manifestPath,
        path.join(stagingPath, "companion", "manifest.json")
      ),
      copyFile(source.files.basePackagePath, stagedBasePackagePath)
    ]);
    await validatePayload(stagingPath, stagedBasePackagePath);
    await rm(outputPath, { recursive: true, force: true });
    await rename(stagingPath, outputPath);
  } catch (error) {
    await rm(stagingPath, { recursive: true, force: true });
    throw error;
  }

  return source.version;
}

const options = parseArguments(process.argv.slice(2));
stageCompanionModule(options)
  .then((version) => {
    console.log(`Staged DIT Browse Companion module ${version} at ${options.outputPath}`);
  })
  .catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
