import { existsSync, rmSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { sign } from "@electron/osx-sign";
import { notarize } from "@electron/notarize";
import { isNotarizationRequested } from "./notarization-policy.mjs";

const appPath = resolve(
  process.env.DITBROWSE_APP_PATH ?? "release/DITBrowse-darwin-arm64/DITBrowse.app"
);
const zipPath = resolve(
  process.env.DITBROWSE_ZIP_PATH ?? "release/DITBrowse-darwin-arm64/DITBrowse-mac-arm64.zip"
);
const dmgPath = resolve(
  process.env.DITBROWSE_DMG_PATH ?? "release/DITBrowse-darwin-arm64/DITBrowse-mac-arm64.dmg"
);
const identity =
  process.env.DITBROWSE_SIGN_IDENTITY ??
  "Developer ID Application: Adam Lighterman (8BWXULM784)";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: "inherit",
    ...options
  });

  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}`);
  }
}

function notarizeOptions() {
  if (process.env.APPLE_NOTARIZE_KEYCHAIN_PROFILE) {
    return {
      keychainProfile: process.env.APPLE_NOTARIZE_KEYCHAIN_PROFILE,
      ...(process.env.APPLE_NOTARIZE_KEYCHAIN
        ? { keychain: process.env.APPLE_NOTARIZE_KEYCHAIN }
        : {})
    };
  }

  if (process.env.APPLE_API_KEY && process.env.APPLE_API_KEY_ID) {
    return {
      appleApiKey: process.env.APPLE_API_KEY,
      appleApiKeyId: process.env.APPLE_API_KEY_ID,
      ...(process.env.APPLE_API_ISSUER
        ? { appleApiIssuer: process.env.APPLE_API_ISSUER }
        : {})
    };
  }

  if (
    process.env.APPLE_ID &&
    process.env.APPLE_APP_SPECIFIC_PASSWORD &&
    process.env.APPLE_TEAM_ID
  ) {
    return {
      appleId: process.env.APPLE_ID,
      appleIdPassword: process.env.APPLE_APP_SPECIFIC_PASSWORD,
      teamId: process.env.APPLE_TEAM_ID
    };
  }

  return null;
}

if (!existsSync(appPath)) {
  throw new Error(`App not found at ${appPath}`);
}

console.log(`Signing ${appPath}`);
await sign({
  app: appPath,
  identity,
  platform: "darwin",
  hardenedRuntime: true
});

console.log("Verifying code signature");
run("codesign", ["--verify", "--deep", "--strict", "--verbose=2", appPath]);

const notarizationRequested = isNotarizationRequested();
const notaryOptions = notarizationRequested ? notarizeOptions() : null;
if (notarizationRequested && !notaryOptions) {
  throw new Error(
    "DITBROWSE_NOTARIZE=1 was provided, but no supported Apple notarization credentials were found"
  );
}

if (notaryOptions) {
  console.log("Submitting app for Apple notarization");
  await notarize({
    appPath,
    ...notaryOptions
  });
  console.log("Notarization complete and ticket stapled");
} else {
  console.log("Skipping notarization; set DITBROWSE_NOTARIZE=1 to opt in");
}

if (existsSync(zipPath)) {
  rmSync(zipPath);
}

console.log(`Creating ${zipPath}`);
run("ditto", ["-c", "-k", "--keepParent", basename(appPath), zipPath], {
  cwd: dirname(appPath)
});

console.log(`Building ${dmgPath}`);
run(process.execPath, [
  resolve("scripts/build-mac-dmg.mjs"),
  "--app-path",
  appPath,
  "--output",
  dmgPath
]);

console.log("Signing DMG");
run("codesign", [
  "--force",
  "--timestamp",
  "--sign",
  identity,
  dmgPath
]);
run("codesign", ["--verify", "--verbose=2", dmgPath]);

if (notaryOptions) {
  console.log("Notarizing DMG");
  await notarize({
    appPath: dmgPath,
    ...notaryOptions
  });
  console.log("DMG notarization complete and ticket stapled");
} else {
  console.log("Skipping DMG notarization; set DITBROWSE_NOTARIZE=1 to opt in");
}

console.log("Signed release is ready");
