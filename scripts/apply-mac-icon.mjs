import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  utimesSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const appPathArgumentIndex = process.argv.indexOf("--app-path");
const appPathArgument =
  appPathArgumentIndex >= 0 ? process.argv[appPathArgumentIndex + 1] : undefined;
if (appPathArgumentIndex >= 0 && !appPathArgument) {
  throw new Error("--app-path requires an application path");
}

const appPath = appPathArgument
  ? path.resolve(appPathArgument)
  : path.resolve("release/DITBrowse-darwin-arm64/DITBrowse.app");
const sourceIconPath = path.resolve("assets/icon/ditbrowse.icns");
const composerIconPath = path.resolve("assets/icon/DITBrowse.icon");
const resourcesPath = path.join(appPath, "Contents", "Resources");
const destinationIconPath = path.join(resourcesPath, "DITBrowse.icns");
const infoPlistPath = path.join(appPath, "Contents", "Info.plist");
const temporaryRoot = mkdtempSync(path.join(tmpdir(), "ditbrowse-actool-"));
const partialInfoPath = path.join(temporaryRoot, "asset-info.plist");

for (const requiredPath of [appPath, sourceIconPath, composerIconPath, infoPlistPath]) {
  if (!existsSync(requiredPath)) {
    throw new Error(`Missing icon packaging input: ${requiredPath}`);
  }
}

function setPlistValue(key, value, type = "json") {
  try {
    execFileSync("/usr/bin/plutil", [
      "-replace",
      key,
      `-${type}`,
      type === "json" ? JSON.stringify(value) : String(value),
      infoPlistPath
    ]);
  } catch {
    execFileSync("/usr/bin/plutil", [
      "-insert",
      key,
      `-${type}`,
      type === "json" ? JSON.stringify(value) : String(value),
      infoPlistPath
    ]);
  }
}

try {
  mkdirSync(resourcesPath, { recursive: true });
  execFileSync("/usr/bin/xcrun", [
    "actool",
    "--compile",
    resourcesPath,
    "--platform",
    "macosx",
    "--minimum-deployment-target",
    "12.0",
    "--app-icon",
    "DITBrowse",
    "--standalone-icon-behavior",
    "all",
    "--output-partial-info-plist",
    partialInfoPath,
    "--warnings",
    "--errors",
    "--notices",
    composerIconPath
  ]);

  const partialInfo = JSON.parse(
    execFileSync("/usr/bin/plutil", [
      "-convert",
      "json",
      "-o",
      "-",
      partialInfoPath
    ], { encoding: "utf8" })
  );
  if (partialInfo.CFBundleIconName !== "DITBrowse") {
    throw new Error("actool did not emit CFBundleIconName=DITBrowse");
  }
  const compiledAssetsPath = path.join(resourcesPath, "Assets.car");
  if (!existsSync(compiledAssetsPath)) {
    throw new Error("actool did not emit Assets.car");
  }

  for (const [key, value] of Object.entries(partialInfo)) {
    setPlistValue(key, value);
  }
  // Keep the hand-built ICNS as the legacy fallback. actool emits its own
  // standalone ICNS, so copy ours after compilation to make the fallback exact.
  copyFileSync(sourceIconPath, destinationIconPath);
  setPlistValue("CFBundleIconFile", "DITBrowse.icns", "string");

  const now = new Date();
  for (const outputPath of [
    destinationIconPath,
    compiledAssetsPath,
    infoPlistPath,
    appPath
  ]) {
    utimesSync(outputPath, now, now);
  }
  execFileSync("/usr/bin/codesign", [
    "--force",
    "--deep",
    "--sign",
    "-",
    appPath
  ]);
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
