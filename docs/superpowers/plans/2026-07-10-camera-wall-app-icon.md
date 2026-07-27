# Camera Wall App Icon Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace DITBrowse's existing lens icon with the approved flat Camera Wall design and install an unsigned/ad-hoc application build that uses the new macOS icon.

**Architecture:** Store one deterministic SVG master and generate every PNG, iconset representation, and ICNS from it with a dependency-free macOS Node script that calls `sips` and `iconutil`. Keep the existing `apply-mac-icon.mjs` packaging integration, but make `package:mac` regenerate the icon assets before packaging so generated files cannot drift from the master.

**Tech Stack:** SVG, Node.js ESM, macOS `sips`, macOS `iconutil`, Vitest, Electron Packager, macOS app bundles.

## Global Constraints

- Use the approved Flat Camera Wall geometry only.
- Use exactly `#EDE9DF`, `#202022`, and `#E27038`; do not introduce blue or cyan.
- Do not use lettering, gradients, realistic lens rendering, or small interface controls.
- `assets/icon/ditbrowse-icon-source.svg` is the single source of truth.
- Generate the 1024px PNG, complete macOS iconset, and ICNS from the SVG master.
- Do not change runtime application behavior, Companion behavior, camera state, passwords, or Help content.
- Run only `npm run package:mac`; do not run Developer ID signing or notarization.
- Back up and replace `/Applications/DITBrowse.app`, then confirm the existing camera count remains online.

---

### Task 1: Add the tested vector master

**Files:**
- Create: `assets/icon/ditbrowse-icon-source.svg`
- Create: `src/iconAssets.test.ts`

**Interfaces:**
- Produces: the canonical `1024 × 1024` SVG consumed by the raster build script in Task 2.
- Validates: exact colors, geometry element counts, forbidden visual features, and a square artboard.

- [x] **Step 1: Write the failing vector contract test**

Create `src/iconAssets.test.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const iconDirectory = resolve(process.cwd(), "assets/icon");
const sourceSvgPath = resolve(iconDirectory, "ditbrowse-icon-source.svg");

describe("Camera Wall icon assets", () => {
  it("uses the approved vector geometry and palette as its single source", () => {
    expect(existsSync(sourceSvgPath)).toBe(true);
    const svg = readFileSync(sourceSvgPath, "utf8");

    expect(svg).toContain('viewBox="0 0 1024 1024"');
    expect(svg.match(/<rect\b/g)).toHaveLength(5);
    expect(svg.match(/<circle\b/g)).toHaveLength(1);
    expect(svg.match(/<path\b/g)).toHaveLength(1);
    expect(svg).toContain('fill="#EDE9DF"');
    expect(svg).toContain('fill="#202022"');
    expect(svg).toContain('fill="#E27038"');

    const colors = [...svg.matchAll(/#[0-9A-Fa-f]{6}/g)].map(([color]) =>
      color.toUpperCase()
    );
    expect([...new Set(colors)].sort()).toEqual([
      "#202022",
      "#E27038",
      "#EDE9DF"
    ]);
    expect(svg).not.toMatch(/<(?:text|image|linearGradient|radialGradient|filter)\b/);
  });
});
```

- [x] **Step 2: Run the focused test and verify it fails**

Run:

```bash
npx vitest run src/iconAssets.test.ts
```

Expected: FAIL because `assets/icon/ditbrowse-icon-source.svg` does not exist.

- [x] **Step 3: Add the exact approved SVG master**

Create `assets/icon/ditbrowse-icon-source.svg`:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" role="img" aria-labelledby="title">
  <title id="title">DITBrowse Camera Wall</title>
  <rect x="32" y="32" width="960" height="960" rx="220" fill="#EDE9DF"/>
  <rect x="166" y="195" width="302" height="249" rx="39" fill="#202022"/>
  <rect x="556" y="195" width="302" height="249" rx="39" fill="#202022"/>
  <rect x="166" y="527" width="302" height="249" rx="39" fill="#202022"/>
  <rect x="556" y="527" width="302" height="249" rx="39" fill="#E27038"/>
  <circle cx="707" cy="651" r="49" fill="#202022"/>
  <path d="M307 868 H717" fill="none" stroke="#202022" stroke-width="49" stroke-linecap="round"/>
</svg>
```

- [x] **Step 4: Run the vector contract and typecheck**

Run:

```bash
npx vitest run src/iconAssets.test.ts && npm run typecheck
```

Expected: PASS.

- [x] **Step 5: Commit the vector master**

```bash
git add assets/icon/ditbrowse-icon-source.svg src/iconAssets.test.ts
git commit -m "feat: add camera wall icon master"
```

---

### Task 2: Generate and test every macOS icon asset

**Files:**
- Create: `scripts/build-mac-icon.mjs`
- Modify: `src/iconAssets.test.ts`
- Modify: `src/packageConfig.test.ts`
- Modify: `package.json`
- Replace: `assets/icon/ditbrowse-icon-source.png`
- Replace: `assets/icon/ditbrowse-icon-1024.png`
- Create: `assets/icon/ditbrowse.iconset/icon_16x16.png`
- Create: `assets/icon/ditbrowse.iconset/icon_16x16@2x.png`
- Create: `assets/icon/ditbrowse.iconset/icon_32x32.png`
- Create: `assets/icon/ditbrowse.iconset/icon_32x32@2x.png`
- Create: `assets/icon/ditbrowse.iconset/icon_128x128.png`
- Create: `assets/icon/ditbrowse.iconset/icon_128x128@2x.png`
- Create: `assets/icon/ditbrowse.iconset/icon_256x256.png`
- Create: `assets/icon/ditbrowse.iconset/icon_256x256@2x.png`
- Create: `assets/icon/ditbrowse.iconset/icon_512x512.png`
- Create: `assets/icon/ditbrowse.iconset/icon_512x512@2x.png`
- Replace: `assets/icon/ditbrowse.icns`

**Interfaces:**
- Consumes: `assets/icon/ditbrowse-icon-source.svg` from Task 1.
- Produces: `npm run build:mac-icon`, canonical raster assets, a complete iconset, and `assets/icon/ditbrowse.icns` for `apply-mac-icon.mjs`.

- [x] **Step 1: Extend the tests with the failing raster-pipeline contract**

Append this test inside `describe("Camera Wall icon assets", ...)` in `src/iconAssets.test.ts` and add `execFileSync`, `mkdtempSync`, `rmSync`, and `tmpdir` imports:

```ts
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync
} from "node:fs";
import { tmpdir } from "node:os";

const runOnMac = process.platform === "darwin" ? it : it.skip;

runOnMac("builds every required PNG and ICNS from the vector master", () => {
  const outputRoot = mkdtempSync(resolve(tmpdir(), "ditbrowse-icon-"));
  try {
    execFileSync(process.execPath, [
      resolve(process.cwd(), "scripts/build-mac-icon.mjs"),
      "--output-root",
      outputRoot
    ]);

    const expectedFiles = [
      "ditbrowse-icon-source.png",
      "ditbrowse-icon-1024.png",
      "ditbrowse.icns",
      "ditbrowse.iconset/icon_16x16.png",
      "ditbrowse.iconset/icon_16x16@2x.png",
      "ditbrowse.iconset/icon_32x32.png",
      "ditbrowse.iconset/icon_32x32@2x.png",
      "ditbrowse.iconset/icon_128x128.png",
      "ditbrowse.iconset/icon_128x128@2x.png",
      "ditbrowse.iconset/icon_256x256.png",
      "ditbrowse.iconset/icon_256x256@2x.png",
      "ditbrowse.iconset/icon_512x512.png",
      "ditbrowse.iconset/icon_512x512@2x.png"
    ];

    for (const relativePath of expectedFiles) {
      const outputPath = resolve(outputRoot, relativePath);
      expect(existsSync(outputPath), relativePath).toBe(true);
      expect(statSync(outputPath).size, relativePath).toBeGreaterThan(0);
    }
  } finally {
    rmSync(outputRoot, { recursive: true, force: true });
  }
});
```

Keep the existing imports deduplicated; the final `node:fs` import contains all five named functions.

Add this test to `src/packageConfig.test.ts`:

```ts
it("regenerates the icon from its vector master before macOS packaging", () => {
  const scripts = packageManifest().scripts ?? {};
  const packageScript = scripts["package:mac"] ?? "";

  expect(scripts["build:mac-icon"]).toBe("node scripts/build-mac-icon.mjs");
  expect(packageScript).toContain("npm run build:mac-icon");
  expect(packageScript.indexOf("npm run build:mac-icon")).toBeLessThan(
    packageScript.indexOf("electron-packager")
  );
});
```

- [x] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
npx vitest run src/iconAssets.test.ts src/packageConfig.test.ts
```

Expected: FAIL because `scripts/build-mac-icon.mjs` and `build:mac-icon` do not exist.

- [x] **Step 3: Add the dependency-free icon build script**

Create `scripts/build-mac-icon.mjs`:

```js
import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync
} from "node:fs";
import path from "node:path";

const sourceSvgPath = path.resolve("assets/icon/ditbrowse-icon-source.svg");
const outputRootArgumentIndex = process.argv.indexOf("--output-root");
const outputRootArgument =
  outputRootArgumentIndex >= 0 ? process.argv[outputRootArgumentIndex + 1] : undefined;
if (outputRootArgumentIndex >= 0 && !outputRootArgument) {
  throw new Error("--output-root requires a directory path");
}
const outputRoot =
  outputRootArgument
    ? path.resolve(outputRootArgument)
    : path.resolve("assets/icon");

if (!existsSync(sourceSvgPath)) {
  throw new Error(`Missing vector icon source: ${sourceSvgPath}`);
}
const sourcePngPath = path.join(outputRoot, "ditbrowse-icon-source.png");
const png1024Path = path.join(outputRoot, "ditbrowse-icon-1024.png");
const iconsetPath = path.join(outputRoot, "ditbrowse.iconset");
const icnsPath = path.join(outputRoot, "ditbrowse.icns");

mkdirSync(outputRoot, { recursive: true });
rmSync(iconsetPath, { recursive: true, force: true });
mkdirSync(iconsetPath, { recursive: true });

execFileSync("/usr/bin/sips", [
  "-s",
  "format",
  "png",
  sourceSvgPath,
  "--out",
  sourcePngPath
]);
execFileSync("/usr/bin/sips", [
  "-z",
  "1024",
  "1024",
  sourcePngPath,
  "--out",
  png1024Path
]);

const iconsetEntries = [
  ["icon_16x16.png", 16],
  ["icon_16x16@2x.png", 32],
  ["icon_32x32.png", 32],
  ["icon_32x32@2x.png", 64],
  ["icon_128x128.png", 128],
  ["icon_128x128@2x.png", 256],
  ["icon_256x256.png", 256],
  ["icon_256x256@2x.png", 512],
  ["icon_512x512.png", 512],
  ["icon_512x512@2x.png", 1024]
];

for (const [fileName, size] of iconsetEntries) {
  execFileSync("/usr/bin/sips", [
    "-z",
    String(size),
    String(size),
    png1024Path,
    "--out",
    path.join(iconsetPath, String(fileName))
  ]);
}

execFileSync("/usr/bin/iconutil", [
  "-c",
  "icns",
  iconsetPath,
  "-o",
  icnsPath
]);
copyFileSync(png1024Path, sourcePngPath);

console.log(`Built Camera Wall icon assets at ${outputRoot}`);
```

- [x] **Step 4: Wire icon generation into package scripts**

Add this script in `package.json`:

```json
"build:mac-icon": "node scripts/build-mac-icon.mjs"
```

Change the beginning of `package:mac` from:

```text
npm run build && npm run stage:companion-module
```

to:

```text
npm run build:mac-icon && npm run build && npm run stage:companion-module
```

Do not change `package:mac:signed` or `package:mac:notarized`.

- [x] **Step 5: Run the focused tests and build the tracked assets**

Run:

```bash
npx vitest run src/iconAssets.test.ts src/packageConfig.test.ts
npm run build:mac-icon
```

Expected: tests PASS and the script reports `Built Camera Wall icon assets at .../assets/icon`.

- [x] **Step 6: Verify generated dimensions and ICNS contents**

Run:

```bash
sips -g pixelWidth -g pixelHeight assets/icon/ditbrowse-icon-source.png
sips -g pixelWidth -g pixelHeight assets/icon/ditbrowse-icon-1024.png
iconutil -c iconset assets/icon/ditbrowse.icns -o /tmp/ditbrowse-icon-verification.iconset
find /tmp/ditbrowse-icon-verification.iconset -maxdepth 1 -name '*.png' | sort
rm -rf /tmp/ditbrowse-icon-verification.iconset
```

Expected: both canonical PNGs are `1024 × 1024`, and the ICNS expands into the expected macOS icon representations.

- [x] **Step 7: Commit the deterministic icon pipeline and outputs**

```bash
git add package.json scripts/build-mac-icon.mjs src/iconAssets.test.ts src/packageConfig.test.ts assets/icon
git commit -m "feat: build camera wall macOS icon"
```

---

### Task 3: Visually verify, package, and replace the installed app

**Files:**
- Generated: `release/DITBrowse-darwin-arm64/DITBrowse.app`
- Replace: `/Applications/DITBrowse.app`
- Backup: `/Users/lightlab/Documents/DITBrowse App Backups/DITBrowse-<timestamp>.app`
- Modify: `docs/superpowers/plans/2026-07-10-camera-wall-app-icon.md`

**Interfaces:**
- Consumes: the generated `assets/icon/ditbrowse.icns` from Task 2 and the existing `scripts/apply-mac-icon.mjs` integration.
- Produces: a running unsigned/ad-hoc app installation with the Camera Wall icon and unchanged camera workspace.

- [x] **Step 1: Inspect the raster master at large and small sizes**

Use the image viewer at original detail on:

```text
assets/icon/ditbrowse-icon-1024.png
assets/icon/ditbrowse.iconset/icon_128x128.png
assets/icon/ditbrowse.iconset/icon_32x32.png
assets/icon/ditbrowse.iconset/icon_16x16.png
```

Confirm:

- balanced cream padding on all sides;
- four clearly separated feeds;
- bottom-right orange feed;
- centered aperture cue;
- readable monitor base;
- no blue/cyan, gradients, lettering, or realistic lens detail.

If the 16px aperture or base is muddy, stop before packaging. Adjust only whole-pixel `x`, `y`, `width`, `height`, `r`, stroke width, or endpoint values in the SVG master, rebuild every generated asset, rerun the focused icon tests, and repeat inspection at all four sizes. Do not edit a generated PNG independently.

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

- [x] **Step 3: Package without signing or notarization**

Run:

```bash
npm run package:mac
```

Expected: `release/DITBrowse-darwin-arm64/DITBrowse.app` exists. Do not run `package:mac:signed`, `package:mac:notarized`, or `scripts/sign-and-notarize-mac.mjs`.

- [x] **Step 4: Verify the packaged icon integration and ad-hoc status**

Run:

```bash
/usr/libexec/PlistBuddy -c 'Print :CFBundleIconFile' release/DITBrowse-darwin-arm64/DITBrowse.app/Contents/Info.plist
cmp assets/icon/ditbrowse.icns release/DITBrowse-darwin-arm64/DITBrowse.app/Contents/Resources/DITBrowse.icns
codesign -dv --verbose=2 release/DITBrowse-darwin-arm64/DITBrowse.app 2>&1 | rg 'Signature|TeamIdentifier'
```

Expected:

```text
DITBrowse.icns
Signature=adhoc
TeamIdentifier=not set
```

- [x] **Step 5: Back up and replace Applications**

Quit DITBrowse, wait for `/Applications/DITBrowse.app/Contents/MacOS/DITBrowse` to stop, move the current application to a timestamped path under `/Users/lightlab/Documents/DITBrowse App Backups`, copy the new build with `ditto`, and launch `/Applications/DITBrowse.app`.

- [x] **Step 6: Verify the running installation**

Poll `http://127.0.0.1:7502/api/status` and confirm:

- `ok` is `true`;
- the camera count matches the pre-install count;
- the running executable is `/Applications/DITBrowse.app/Contents/MacOS/DITBrowse`;
- the installed `DITBrowse.icns` matches `assets/icon/ditbrowse.icns`;
- `Signature=adhoc` and `TeamIdentifier=not set`.

- [x] **Step 7: Complete plan tracking and commit**

Change every checkbox in this plan to `[x]`, then run:

```bash
git add docs/superpowers/plans/2026-07-10-camera-wall-app-icon.md
git commit -m "docs: complete camera wall icon plan"
```

Report the installed app path, backup path, test totals, camera count, and explicit not-notarized status.
