import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

function optionValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index < 0) return undefined;
  const value = process.argv[index + 1];
  if (!value) throw new Error(`${flag} requires a path`);
  return value;
}

const appPath = path.resolve(
  optionValue("--app-path") ?? "release/DITBrowse-darwin-arm64/DITBrowse.app"
);
const outputPath = path.resolve(
  optionValue("--output") ??
    "release/DITBrowse-darwin-arm64/DITBrowse-mac-arm64.dmg"
);

if (!existsSync(appPath)) {
  throw new Error(`Missing app bundle: ${appPath}`);
}

const stagingRoot = mkdtempSync(path.join(tmpdir(), "ditbrowse-dmg-"));
try {
  execFileSync("/usr/bin/ditto", [appPath, path.join(stagingRoot, "DITBrowse.app")]);
  symlinkSync("/Applications", path.join(stagingRoot, "Applications"));
  mkdirSync(path.dirname(outputPath), { recursive: true });
  rmSync(outputPath, { force: true });
  execFileSync("/usr/bin/hdiutil", [
    "create",
    "-volname",
    "DITBrowse",
    "-srcfolder",
    stagingRoot,
    "-ov",
    "-format",
    "UDZO",
    outputPath
  ]);
} finally {
  rmSync(stagingRoot, { recursive: true, force: true });
}

console.log(`Built DITBrowse DMG at ${outputPath}`);
