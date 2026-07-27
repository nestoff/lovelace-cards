# White Icon Variants and DMG Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Keep the Camera Wall shell pure white in explicit macOS Default and Dark icon appearances, then build, verify, install, and deliver an unsigned/ad-hoc DITBrowse app and DMG.

**Architecture:** Extend the existing SVG-to-ICNS build with a deterministic Apple Icon Composer `.icon` document whose Default and Dark fill specializations are both pure white. Compile that document into the Electron app with Xcode `actool`, audit the emitted `DarkAqua` icon stack, retain ICNS as a fallback, and add a separate deterministic `hdiutil` DMG builder.

**Tech Stack:** SVG, Node.js ESM, Vitest, Xcode 26 `actool`, macOS `sips`, `iconutil`, `plutil`, `hdiutil`, Electron Packager.

## Implementation correction

The initial `DITBrowse.xcassets/AppIcon.appiconset` implementation below was completed and tested, but a post-build `assetutil` audit proved that `actool` silently omitted its Dark appearance stack for a macOS app icon. The final implementation therefore replaces that catalog with `assets/icon/DITBrowse.icon`, generated from the same SVG master. The bundle integration test now requires both `NSAppearanceNameDarkAqua` and `IconImageStack` in the compiled `Assets.car`. `CFBundleIconName` is `DITBrowse`. The earlier appiconset snippets remain below as the historical first implementation; they are superseded by this correction and commit `c89cf23`.

## Global Constraints

- Change the Camera Wall shell to pure white `#FFFFFF`.
- Keep `#202022` for inactive feeds, aperture cue, and monitor base.
- Keep `#E27038` for the bottom-right active feed.
- Default and Dark macOS icon variants must be byte-identical at every size and scale.
- Keep the DITBrowse interface dark; do not add light-theme behavior.
- Keep `assets/icon/ditbrowse-icon-source.svg` as the single artwork source.
- Retain `DITBrowse.icns` as a fallback and add explicit asset-catalog icon metadata for current macOS.
- Do not add a Tinted or Mono override.
- Package and install only ad-hoc/unsigned artifacts; never Developer ID sign, notarize, or staple.
- Produce `release/DITBrowse-darwin-arm64/DITBrowse-mac-arm64.dmg` in compressed `UDZO` format.
- Back up and replace `/Applications/DITBrowse.app`, preserving the existing 12-camera workspace.

---

### Task 1: Generate pure-white Default and Dark icon assets

**Files:**
- Modify: `assets/icon/ditbrowse-icon-source.svg`
- Modify: `scripts/build-mac-icon.mjs`
- Modify: `src/iconAssets.test.ts`
- Replace: `assets/icon/ditbrowse-icon-source.png`
- Replace: `assets/icon/ditbrowse-icon-1024.png`
- Replace: `assets/icon/ditbrowse.iconset/*`
- Replace: `assets/icon/ditbrowse.icns`
- Create: `assets/icon/DITBrowse.xcassets/AppIcon.appiconset/Contents.json`
- Create: `assets/icon/DITBrowse.xcassets/AppIcon.appiconset/*.png`

**Interfaces:**
- Consumes: the existing Camera Wall geometry and `build:mac-icon` command.
- Produces: one white vector master, legacy ICNS outputs, and a complete `AppIcon.appiconset` with identical Default and Dark files.

- [x] **Step 1: Write the failing white-variant contract tests**

In `src/iconAssets.test.ts`, change the approved palette assertion from `#EDE9DF` to `#FFFFFF`, then extend the macOS build test after `expectedFiles` validation:

```ts
const appIconSetPath = resolve(outputRoot, "DITBrowse.xcassets/AppIcon.appiconset");
const contents = JSON.parse(
  readFileSync(resolve(appIconSetPath, "Contents.json"), "utf8")
) as {
  images: Array<{
    filename: string;
    idiom: string;
    scale: string;
    size: string;
    appearances?: Array<{ appearance: string; value: string }>;
  }>;
};

expect(contents.images).toHaveLength(20);
const defaults = contents.images.filter((image) => !image.appearances);
const dark = contents.images.filter(
  (image) =>
    image.appearances?.length === 1 &&
    image.appearances[0]?.appearance === "luminosity" &&
    image.appearances[0]?.value === "dark"
);
expect(defaults).toHaveLength(10);
expect(dark).toHaveLength(10);

for (const defaultImage of defaults) {
  const darkImage = dark.find(
    (image) => image.size === defaultImage.size && image.scale === defaultImage.scale
  );
  expect(darkImage).toBeDefined();
  expect(
    readFileSync(resolve(appIconSetPath, defaultImage.filename)).equals(
      readFileSync(resolve(appIconSetPath, darkImage!.filename))
    )
  ).toBe(true);
}
```

Add these paths to `expectedFiles`:

```ts
"DITBrowse.xcassets/AppIcon.appiconset/Contents.json",
"DITBrowse.xcassets/AppIcon.appiconset/appicon_16x16.png",
"DITBrowse.xcassets/AppIcon.appiconset/appicon_16x16-dark.png",
"DITBrowse.xcassets/AppIcon.appiconset/appicon_512x512@2x.png",
"DITBrowse.xcassets/AppIcon.appiconset/appicon_512x512@2x-dark.png"
```

- [x] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npx vitest run src/iconAssets.test.ts
```

Expected: FAIL because the SVG still uses `#EDE9DF` and no asset catalog exists.

- [x] **Step 3: Make the SVG shell pure white**

In `assets/icon/ditbrowse-icon-source.svg`, change only:

```svg
fill="#EDE9DF"
```

to:

```svg
fill="#FFFFFF"
```

- [x] **Step 4: Extend the icon builder with explicit Default and Dark entries**

Add `writeFileSync` to the `node:fs` import in `scripts/build-mac-icon.mjs`. After generating `iconsetEntries`, create the asset catalog with this implementation:

```js
const assetCatalogPath = path.join(outputRoot, "DITBrowse.xcassets");
const appIconSetPath = path.join(assetCatalogPath, "AppIcon.appiconset");
rmSync(assetCatalogPath, { recursive: true, force: true });
mkdirSync(appIconSetPath, { recursive: true });

const appIconImages = [];
for (const [iconsetFileName, pixelSize] of iconsetEntries) {
  const scale = iconsetFileName.includes("@2x") ? "2x" : "1x";
  const pointSize = pixelSize / Number(scale[0]);
  const suffix = scale === "2x" ? "@2x" : "";
  const defaultFileName = `appicon_${pointSize}x${pointSize}${suffix}.png`;
  const darkFileName = `appicon_${pointSize}x${pointSize}${suffix}-dark.png`;
  const sourcePath = path.join(iconsetPath, String(iconsetFileName));

  copyFileSync(sourcePath, path.join(appIconSetPath, defaultFileName));
  copyFileSync(sourcePath, path.join(appIconSetPath, darkFileName));
  appIconImages.push(
    {
      filename: defaultFileName,
      idiom: "mac",
      scale,
      size: `${pointSize}x${pointSize}`
    },
    {
      appearances: [{ appearance: "luminosity", value: "dark" }],
      filename: darkFileName,
      idiom: "mac",
      scale,
      size: `${pointSize}x${pointSize}`
    }
  );
}

writeFileSync(
  path.join(appIconSetPath, "Contents.json"),
  `${JSON.stringify(
    {
      images: appIconImages,
      info: { author: "xcode", version: 1 }
    },
    null,
    2
  )}\n`
);
```

This code runs after all iconset PNGs exist and before the final success log.

- [x] **Step 5: Build and verify the white assets**

Run:

```bash
npx vitest run src/iconAssets.test.ts
npm run build:mac-icon
```

Expected: tests PASS; SVG, PNG, iconset, ICNS, and asset catalog regenerate successfully.

- [x] **Step 6: Inspect white Default and Dark outputs**

Inspect at original detail:

```text
assets/icon/DITBrowse.xcassets/AppIcon.appiconset/appicon_512x512@2x.png
assets/icon/DITBrowse.xcassets/AppIcon.appiconset/appicon_512x512@2x-dark.png
assets/icon/DITBrowse.xcassets/AppIcon.appiconset/appicon_32x32.png
assets/icon/DITBrowse.xcassets/AppIcon.appiconset/appicon_32x32-dark.png
```

Confirm both variants have the same white shell, charcoal feeds, orange active feed, aperture dot, and monitor base.

- [x] **Step 7: Commit the explicit appearance assets**

```bash
git add assets/icon scripts/build-mac-icon.mjs src/iconAssets.test.ts
git commit -m "feat: add white macOS icon variants"
```

---

### Task 2: Compile the icon asset catalog into the app bundle

**Files:**
- Modify: `scripts/apply-mac-icon.mjs`
- Modify: `src/iconAssets.test.ts`

**Interfaces:**
- Consumes: `assets/icon/DITBrowse.xcassets` and `assets/icon/ditbrowse.icns` from Task 1.
- Produces: `Assets.car`, standalone asset-catalog icon files, `CFBundleIconName=AppIcon`, and the ICNS fallback in a packaged app.

- [x] **Step 1: Add a failing bundle-integration test**

Add `mkdirSync` and `writeFileSync` to the `node:fs` imports in `src/iconAssets.test.ts`, then add this macOS-only test:

```ts
runOnMac("applies explicit icon appearances to a macOS app bundle", () => {
  const temporaryRoot = mkdtempSync(resolve(tmpdir(), "ditbrowse-app-icon-"));
  const appPath = resolve(temporaryRoot, "DITBrowse.app");
  const contentsPath = resolve(appPath, "Contents");
  try {
    mkdirSync(resolve(contentsPath, "Resources"), { recursive: true });
    writeFileSync(
      resolve(contentsPath, "Info.plist"),
      `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>com.lightlab.ditbrowse.test</string>
<key>CFBundleName</key><string>DITBrowse</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>LSMinimumSystemVersion</key><string>12.0</string>
</dict></plist>\n`
    );

    execFileSync(process.execPath, [
      resolve(process.cwd(), "scripts/apply-mac-icon.mjs"),
      "--app-path",
      appPath
    ]);

    expect(existsSync(resolve(contentsPath, "Resources/DITBrowse.icns"))).toBe(true);
    expect(existsSync(resolve(contentsPath, "Resources/Assets.car"))).toBe(true);
    expect(
      execFileSync("/usr/bin/plutil", [
        "-extract",
        "CFBundleIconName",
        "raw",
        "-o",
        "-",
        resolve(contentsPath, "Info.plist")
      ], { encoding: "utf8" }).trim()
    ).toBe("AppIcon");
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});
```

- [x] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npx vitest run src/iconAssets.test.ts
```

Expected: FAIL because `apply-mac-icon.mjs` does not accept `--app-path` or compile `Assets.car`.

- [x] **Step 3: Extend `apply-mac-icon.mjs` with asset-catalog compilation**

Replace `scripts/apply-mac-icon.mjs` with an implementation that:

```js
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
const assetCatalogPath = path.resolve("assets/icon/DITBrowse.xcassets");
const resourcesPath = path.join(appPath, "Contents", "Resources");
const destinationIconPath = path.join(resourcesPath, "DITBrowse.icns");
const infoPlistPath = path.join(appPath, "Contents", "Info.plist");
const temporaryRoot = mkdtempSync(path.join(tmpdir(), "ditbrowse-actool-"));
const partialInfoPath = path.join(temporaryRoot, "asset-info.plist");

for (const requiredPath of [appPath, sourceIconPath, assetCatalogPath, infoPlistPath]) {
  if (!existsSync(requiredPath)) {
    throw new Error(`Missing icon packaging input: ${requiredPath}`);
  }
}

try {
  mkdirSync(resourcesPath, { recursive: true });
  copyFileSync(sourceIconPath, destinationIconPath);
  execFileSync("/usr/bin/xcrun", [
    "actool",
    "--compile",
    resourcesPath,
    "--platform",
    "macosx",
    "--minimum-deployment-target",
    "12.0",
    "--app-icon",
    "AppIcon",
    "--standalone-icon-behavior",
    "all",
    "--output-partial-info-plist",
    partialInfoPath,
    "--warnings",
    "--errors",
    "--notices",
    assetCatalogPath
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
  if (partialInfo.CFBundleIconName !== "AppIcon") {
    throw new Error("actool did not emit CFBundleIconName=AppIcon");
  }
  if (!existsSync(path.join(resourcesPath, "Assets.car"))) {
    throw new Error("actool did not emit Assets.car");
  }

  for (const [key, value] of Object.entries(partialInfo)) {
    const command = existsSync(infoPlistPath)
      ? ["-replace", key, "-json", JSON.stringify(value), infoPlistPath]
      : [];
    try {
      execFileSync("/usr/bin/plutil", command);
    } catch {
      execFileSync("/usr/bin/plutil", [
        "-insert",
        key,
        "-json",
        JSON.stringify(value),
        infoPlistPath
      ]);
    }
  }
  try {
    execFileSync("/usr/bin/plutil", [
      "-replace",
      "CFBundleIconFile",
      "-string",
      "DITBrowse.icns",
      infoPlistPath
    ]);
  } catch {
    execFileSync("/usr/bin/plutil", [
      "-insert",
      "CFBundleIconFile",
      "-string",
      "DITBrowse.icns",
      infoPlistPath
    ]);
  }

  const now = new Date();
  for (const outputPath of [destinationIconPath, path.join(resourcesPath, "Assets.car"), infoPlistPath, appPath]) {
    utimesSync(outputPath, now, now);
  }
} finally {
  rmSync(temporaryRoot, { recursive: true, force: true });
}
```

Keep `plutil` merge logic generic so every top-level key from `actool` is preserved.

- [x] **Step 4: Run focused tests and typecheck**

Run:

```bash
npx vitest run src/iconAssets.test.ts && npm run typecheck
```

Expected: PASS with a temporary test bundle containing ICNS, `Assets.car`, and `CFBundleIconName=AppIcon`.

- [x] **Step 5: Commit asset-catalog bundle integration**

```bash
git add scripts/apply-mac-icon.mjs src/iconAssets.test.ts
git commit -m "feat: package explicit macOS icon appearances"
```

---

### Task 3: Add and test the unsigned DMG builder

**Files:**
- Create: `scripts/build-mac-dmg.mjs`
- Create: `src/dmgPackaging.test.ts`
- Modify: `src/packageConfig.test.ts`
- Modify: `package.json`

**Interfaces:**
- Consumes: an ad-hoc packaged `DITBrowse.app`.
- Produces: `npm run package:mac:dmg` and a compressed `DITBrowse-mac-arm64.dmg` containing the app and Applications symlink.

- [x] **Step 1: Add failing DMG command and behavior tests**

Add this test to `src/packageConfig.test.ts`:

```ts
it("builds the DMG only from the ad-hoc package workflow", () => {
  const scripts = packageManifest().scripts ?? {};
  expect(scripts["package:mac:dmg"]).toBe(
    "npm run package:mac && node scripts/build-mac-dmg.mjs"
  );
  expect(scripts["package:mac:dmg"]).not.toContain("signed");
  expect(scripts["package:mac:dmg"]).not.toContain("notar");
});
```

Create `src/dmgPackaging.test.ts`:

```ts
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readlinkSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const runOnMac = process.platform === "darwin" ? it : it.skip;

describe("unsigned macOS DMG packaging", () => {
  runOnMac("creates a mountable image with the app and Applications link", () => {
    const temporaryRoot = mkdtempSync(resolve(tmpdir(), "ditbrowse-dmg-test-"));
    const fakeAppPath = resolve(temporaryRoot, "source/DITBrowse.app");
    const dmgPath = resolve(temporaryRoot, "output/DITBrowse.dmg");
    const mountPath = resolve(temporaryRoot, "mount");
    let attached = false;

    try {
      mkdirSync(resolve(fakeAppPath, "Contents"), { recursive: true });
      writeFileSync(resolve(fakeAppPath, "Contents/test.txt"), "DITBrowse\n");

      execFileSync(process.execPath, [
        resolve(process.cwd(), "scripts/build-mac-dmg.mjs"),
        "--app-path",
        fakeAppPath,
        "--output",
        dmgPath
      ]);
      expect(existsSync(dmgPath)).toBe(true);

      mkdirSync(mountPath);
      execFileSync("/usr/bin/hdiutil", [
        "attach",
        dmgPath,
        "-readonly",
        "-nobrowse",
        "-mountpoint",
        mountPath
      ]);
      attached = true;
      expect(existsSync(resolve(mountPath, "DITBrowse.app/Contents/test.txt"))).toBe(true);
      expect(readlinkSync(resolve(mountPath, "Applications"))).toBe("/Applications");
    } finally {
      if (attached) {
        execFileSync("/usr/bin/hdiutil", ["detach", mountPath]);
      }
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });
});
```

- [x] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
npx vitest run src/packageConfig.test.ts src/dmgPackaging.test.ts
```

Expected: FAIL because the script and `package:mac:dmg` command do not exist.

- [x] **Step 3: Add the deterministic DMG builder**

Create `scripts/build-mac-dmg.mjs`:

```js
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

console.log(`Built unsigned DITBrowse DMG at ${outputPath}`);
```

- [x] **Step 4: Add the unsigned DMG package command**

Add to `package.json`:

```json
"package:mac:dmg": "npm run package:mac && node scripts/build-mac-dmg.mjs"
```

- [x] **Step 5: Run focused tests and typecheck**

Run:

```bash
npx vitest run src/packageConfig.test.ts src/dmgPackaging.test.ts
npm run typecheck
```

Expected: PASS; the temporary DMG mounts with the fake app and Applications symlink.

- [x] **Step 6: Commit the DMG workflow**

```bash
git add scripts/build-mac-dmg.mjs src/dmgPackaging.test.ts src/packageConfig.test.ts package.json
git commit -m "feat: add unsigned macOS dmg workflow"
```

---

### Task 4: Verify, package, install, and deliver

**Files:**
- Generate: `release/DITBrowse-darwin-arm64/DITBrowse.app`
- Generate: `release/DITBrowse-darwin-arm64/DITBrowse-mac-arm64.dmg`
- Replace: `/Applications/DITBrowse.app`
- Backup: `/Users/lightlab/Documents/DITBrowse App Backups/DITBrowse-<timestamp>.app`
- Modify: `docs/superpowers/plans/2026-07-11-white-icon-variants-dmg.md`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: verified ad-hoc app and unsigned DMG plus the running installed replacement.

- [x] **Step 1: Record the installed baseline**

Read `http://127.0.0.1:7502/api/status` and record `ok`, camera count, selected camera, and expansion mode. Expected camera count: `12`.

- [x] **Step 2: Run the complete verification gate**

Run:

```bash
npm run test
npm run typecheck
npm run test:e2e
npm run test:electron
npm run build
```

Expected: every command exits 0.

- [x] **Step 3: Build the app and DMG without signing or notarization**

Run only:

```bash
npm run package:mac:dmg
```

Do not run `package:mac:signed`, `package:mac:notarized`, `codesign --sign`, `notarytool`, or `stapler`.

- [x] **Step 4: Verify the packaged app icon assets and signature**

Confirm:

```bash
/usr/libexec/PlistBuddy -c 'Print :CFBundleIconFile' release/DITBrowse-darwin-arm64/DITBrowse.app/Contents/Info.plist
/usr/libexec/PlistBuddy -c 'Print :CFBundleIconName' release/DITBrowse-darwin-arm64/DITBrowse.app/Contents/Info.plist
test -f release/DITBrowse-darwin-arm64/DITBrowse.app/Contents/Resources/Assets.car
cmp assets/icon/ditbrowse.icns release/DITBrowse-darwin-arm64/DITBrowse.app/Contents/Resources/DITBrowse.icns
codesign -dv --verbose=2 release/DITBrowse-darwin-arm64/DITBrowse.app 2>&1 | rg 'Signature|TeamIdentifier'
```

Expected: `DITBrowse.icns`, `DITBrowse`, present `Assets.car` with a DarkAqua icon stack, matching ICNS, `Signature=adhoc`, and `TeamIdentifier=not set`.

- [x] **Step 5: Mount and verify the final DMG**

Verify `hdiutil verify`, mount read-only, confirm `DITBrowse.app`, `Applications` symlink, `Assets.car`, matching ICNS, and staged Companion module resource. Detach cleanly. Confirm `codesign -dv` reports that the DMG itself is not signed.

- [x] **Step 6: Back up and replace Applications**

Quit DITBrowse, wait for the running process to stop, move the installed app to a timestamped backup under `/Users/lightlab/Documents/DITBrowse App Backups`, copy the new app with `ditto`, and launch `/Applications/DITBrowse.app`.

- [x] **Step 7: Verify the installed app**

Confirm the running executable is `/Applications/DITBrowse.app/Contents/MacOS/DITBrowse`, the API reports `ok=true` with camera count `12`, installed `Assets.car` contains a DarkAqua icon stack, installed ICNS matches the source, `CFBundleIconName=DITBrowse`, and the installed signature remains ad-hoc with no Team Identifier.

- [x] **Step 8: Mark plan complete and commit**

Change every checkbox to `[x]`, then run:

```bash
git add docs/superpowers/plans/2026-07-11-white-icon-variants-dmg.md
git commit -m "docs: complete white icon variants and dmg plan"
```

Report the installed app path, backup path, DMG path, test totals, camera count, explicit white Default/Dark verification, and explicit not-signed/not-notarized status.
