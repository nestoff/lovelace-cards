# DITBrowse v1.0.0 Signed Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Release DITBrowse and its Companion module as v1.0.0 with a Developer ID-signed, Apple-notarized and stapled app and DMG, install the verified app, and publish the artifacts on GitHub.

**Architecture:** Keep the current Electron Packager build and Icon Composer pipeline, then extend the production release script so it signs/notarizes the app, creates the ZIP and DMG from that accepted app, and signs/notarizes the DMG. Gate GitHub publication on local signature, notarization, mounted-image, application-state, and test verification.

**Tech Stack:** Node.js ESM, npm, Yarn 4, Vitest, Node test runner, Electron Packager, `@electron/osx-sign`, `@electron/notarize`, Apple `codesign`, `spctl`, `stapler`, `hdiutil`, Git, GitHub CLI.

## Global Constraints

- Set the DITBrowse application version to exactly `1.0.0`.
- Set `companion-module-lightlab-ditbrowse` to exactly `1.0.0`.
- Sign with `Developer ID Application: Adam Lighterman (8BWXULM784)` and Team Identifier `8BWXULM784`.
- Harden and timestamp the app; timestamp the DMG.
- Notarize and staple both the app and DMG.
- Preserve the white Default/Dark Icon Composer app icon and legacy ICNS fallback.
- Preserve the live workspace recorded immediately before replacing `/Applications/DITBrowse.app`; the release baseline was 11 cameras, selected camera 11, with expansion enabled.
- Publish a new `v1.0.0` tag and release; do not modify the existing v0.1.1 release.
- Stop rather than overwrite an unexpected existing `v1.0.0` tag or release.

---

### Task 1: Set consistent v1.0.0 package versions

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `companion-module-lightlab-ditbrowse/package.json`
- Create: `src/versionConfig.test.ts`

**Interfaces:**
- Consumes: root and Companion package manifests.
- Produces: `version=1.0.0` for the Electron bundle, staged Companion package, tag, and release metadata.

- [x] **Step 1: Add the failing version contract test**

Create `src/versionConfig.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function json(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8"));
}

describe("v1 release versions", () => {
  it("keeps the app, lockfile, and Companion module at 1.0.0", () => {
    const app = json("package.json");
    const lock = json("package-lock.json") as {
      version: string;
      packages: Record<string, { version?: string }>;
    };
    const companion = json("companion-module-lightlab-ditbrowse/package.json");

    expect(app.version).toBe("1.0.0");
    expect(lock.version).toBe("1.0.0");
    expect(lock.packages[""]?.version).toBe("1.0.0");
    expect(companion.version).toBe("1.0.0");
  });
});
```

- [x] **Step 2: Run the version test and verify it fails**

Run:

```bash
npx vitest run src/versionConfig.test.ts
```

Expected: FAIL because the app is `0.1.1` and the Companion module is `0.1.0`.

- [x] **Step 3: Update both package versions**

Run at the repository root:

```bash
npm version 1.0.0 --no-git-tag-version
npm --prefix companion-module-lightlab-ditbrowse version 1.0.0 --no-git-tag-version
```

Expected: root `package.json` and `package-lock.json` report `1.0.0`; the Companion `package.json` reports `1.0.0`.

- [x] **Step 4: Verify and commit the version bump**

Run:

```bash
npx vitest run src/versionConfig.test.ts
npm --prefix companion-module-lightlab-ditbrowse run build
git add package.json package-lock.json companion-module-lightlab-ditbrowse/package.json src/versionConfig.test.ts
git commit -m "release: set version 1.0.0"
```

Expected: both checks pass and the version commit is created.

---

### Task 2: Make the production pipeline sign and notarize the DMG

**Files:**
- Modify: `scripts/sign-and-notarize-mac.mjs`
- Modify: `scripts/build-mac-dmg.mjs`
- Create: `scripts/signed-release-policy.test.mjs`

**Interfaces:**
- Consumes: `DITBROWSE_NOTARIZE=1`, Apple notarization credentials, the Developer ID identity, and the packaged `.app`.
- Produces: `DITBrowse-mac-arm64.zip` containing the signed app and a Developer ID-signed/notarized/stapled `DITBrowse-mac-arm64.dmg`.

- [x] **Step 1: Add a failing signed-release contract test**

Create `scripts/signed-release-policy.test.mjs`:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./sign-and-notarize-mac.mjs", import.meta.url),
  "utf8"
);

test("the production release builds, signs, and notarizes the DMG", () => {
  assert.match(source, /DITBROWSE_DMG_PATH/);
  assert.match(source, /build-mac-dmg\.mjs/);
  assert.match(source, /Signing DMG/);
  assert.match(source, /Notarizing DMG/);
  assert.match(source, /codesign.*--timestamp/s);
  assert.match(source, /await notarize\(\{\s*appPath: dmgPath/s);
});
```

- [x] **Step 2: Verify the contract test fails**

Run:

```bash
node --test scripts/signed-release-policy.test.mjs
```

Expected: FAIL because the release script currently signs only the app.

- [x] **Step 3: Extend the signed-release script**

In `scripts/sign-and-notarize-mac.mjs`:

- define `dmgPath` from `DITBROWSE_DMG_PATH` with the default `release/DITBrowse-darwin-arm64/DITBrowse-mac-arm64.dmg`;
- after app notarization and ZIP creation, run `scripts/build-mac-dmg.mjs --app-path <appPath> --output <dmgPath>`;
- sign the DMG with:

```js
run("codesign", [
  "--force",
  "--timestamp",
  "--sign",
  identity,
  dmgPath
]);
run("codesign", ["--verify", "--verbose=2", dmgPath]);
```

- when notarization is requested, submit and staple the DMG with:

```js
console.log("Notarizing DMG");
await notarize({
  appPath: dmgPath,
  ...notaryOptions
});
console.log("DMG notarization complete and ticket stapled");
```

Keep the no-notarization path capable of producing a Developer ID-signed app and DMG, but require `package:mac:notarized` for the GitHub release.

- [x] **Step 4: Make the standalone DMG log signature-neutral**

In `scripts/build-mac-dmg.mjs`, replace:

```js
console.log(`Built unsigned DITBrowse DMG at ${outputPath}`);
```

with:

```js
console.log(`Built DITBrowse DMG at ${outputPath}`);
```

The standalone `package:mac:dmg` flow remains unsigned/ad-hoc; the production release script signs its output afterward.

- [x] **Step 5: Run release policy tests and commit**

Run:

```bash
node --test scripts/notarization-policy.test.mjs scripts/signed-release-policy.test.mjs
npx vitest run src/dmgPackaging.test.ts src/packageConfig.test.ts
git add scripts/sign-and-notarize-mac.mjs scripts/build-mac-dmg.mjs scripts/signed-release-policy.test.mjs
git commit -m "release: sign and notarize macOS dmg"
```

Expected: all release-policy and DMG tests pass.

---

### Task 3: Verify and build the v1.0.0 release

**Files:**
- Generate: `release/DITBrowse-darwin-arm64/DITBrowse.app`
- Generate: `release/DITBrowse-darwin-arm64/DITBrowse-mac-arm64.zip`
- Generate: `release/DITBrowse-darwin-arm64/DITBrowse-mac-arm64.dmg`
- Modify: `docs/verification.md`

**Interfaces:**
- Consumes: Tasks 1–2 and the configured Apple signing identity and credentials.
- Produces: locally verified v1 release artifacts ready for installation and upload.

- [x] **Step 1: Run the complete source verification gate**

Run:

```bash
npm run test
npm run typecheck
npm run test:e2e
npm run test:electron
npm run build
npm --prefix companion-module-lightlab-ditbrowse run test
npm --prefix companion-module-lightlab-ditbrowse run lint
npm --prefix companion-module-lightlab-ditbrowse run typecheck
npm --prefix companion-module-lightlab-ditbrowse run companion-module-check
```

Expected: every command exits 0.

- [x] **Step 2: Confirm the v1 GitHub namespace is unused**

Run:

```bash
git tag -l v1.0.0
gh release view v1.0.0
```

Expected: no local tag and GitHub reports no release. Stop if either exists.

- [x] **Step 3: Build, sign, notarize, and staple**

Run:

```bash
npm run package:mac:notarized
```

Expected: app and DMG notarization submissions are accepted and stapling succeeds.

- [x] **Step 4: Verify the signed app**

Run `codesign --verify --deep --strict`, `codesign -dv --verbose=4`, `spctl --assess --type execute`, and `stapler validate` against the app. Confirm version `1.0.0`, `Authority=Developer ID Application: Adam Lighterman (8BWXULM784)`, `TeamIdentifier=8BWXULM784`, hardened runtime, timestamp, and Apple acceptance.

- [x] **Step 5: Verify and mount the signed DMG**

Run `hdiutil verify`, `codesign --verify`, `codesign -dv --verbose=4`, `spctl --assess --type open`, and `stapler validate` against the DMG. Mount read-only and verify the contained app, Applications symlink, Companion `1.0.0` package metadata, ICNS equality, DarkAqua `IconImageStack`, and Developer ID app signature; then detach cleanly.

- [x] **Step 6: Update verification documentation and commit**

Update `docs/verification.md` with the v1.0.0 date, current test totals, signed/notarized app and DMG results, and artifact paths. Commit:

```bash
git add docs/verification.md
git commit -m "docs: verify v1 signed release"
```

---

### Task 4: Install and publish v1.0.0

**Files:**
- Replace: `/Applications/DITBrowse.app`
- Backup: `/Users/lightlab/Documents/DITBrowse App Backups/DITBrowse-<timestamp>.app`
- Publish: Git branch, pull request update, tag `v1.0.0`, and GitHub release assets.

**Interfaces:**
- Consumes: verified Task 3 app, ZIP, DMG, and Companion `.tgz`.
- Produces: running local v1 app and public GitHub v1.0.0 release.

- [x] **Step 1: Back up and install the v1 app**

Record the current API state, quit DITBrowse, move the existing app to a timestamped backup, copy the signed v1 app with `ditto`, refresh LaunchServices and Dock, and relaunch `/Applications/DITBrowse.app`.

- [x] **Step 2: Verify the installed v1 app and preserved workspace**

Confirm the running executable is under `/Applications/DITBrowse.app`, `CFBundleShortVersionString=1.0.0`, strict Developer ID verification passes, `spctl` and `stapler validate` pass, and the API returns `ok=true`, 11 cameras, selected camera 11, and expansion enabled—the live values recorded immediately before replacement.

- [x] **Step 3: Mark this plan complete and commit the release state**

Change every checkbox in this file to `[x]`, then commit:

```bash
git add docs/superpowers/plans/2026-07-11-v1-signed-release.md
git commit -m "docs: complete v1 signed release plan"
```

This commit is the immutable verified release commit used by the tag.

- [x] **Step 4: Push the branch and update the draft PR**

Run:

```bash
git push -u origin codex/companion-integration
gh pr view 1 --json url,state,isDraft
```

Expected: the branch is current on GitHub and draft PR 1 remains available for review.

- [x] **Step 5: Create and push the v1.0.0 tag**

Run:

```bash
git tag -a v1.0.0 -m "DITBrowse v1.0.0"
git push origin v1.0.0
```

- [x] **Step 6: Publish the GitHub release and assets**

Create a public release targeting `v1.0.0` with title `DITBrowse v1.0.0`, release notes summarizing the camera-wall workspace, saved-password/sign-in workflow, in-app annotated Help guide, Companion integration, white appearance-aware icon, and signed/notarized macOS distribution. Upload:

```text
release/DITBrowse-darwin-arm64/DITBrowse-mac-arm64.dmg
release/DITBrowse-darwin-arm64/DITBrowse-mac-arm64.zip
companion-module-lightlab-ditbrowse/lightlab-ditbrowse-1.0.0.tgz
```
