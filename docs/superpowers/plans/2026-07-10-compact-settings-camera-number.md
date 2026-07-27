# Compact Settings and Camera Number Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Center and compact the workspace settings, show each linked camera's configured integer number in its tile header, and make notarization an explicit opt-in before installing the new app in `/Applications`.

**Architecture:** Derive a transient `Map<string, number>` from the active camera list in `App`, pass it through `TileGrid`, and render it in `WebviewTile` without changing persisted workspace types. Keep the settings markup and interaction order unchanged while enforcing a `960px` CSS boundary. Separate notarization intent from credential discovery so ordinary signed builds cannot submit to Apple accidentally.

**Tech Stack:** React 19, TypeScript, CSS, Vitest, Testing Library, Playwright, Node.js ESM scripts, Electron Packager, `@electron/osx-sign`, `@electron/notarize`.

## Global Constraints

- Keep the camera table and editor header full width; center only workspace settings at a maximum width of `960px`.
- Display configured camera numbers as positive integers such as `CAM 1`, never zero-padded strings such as `CAM 01`.
- Do not add camera numbers to persisted `TileState` data or change Companion titles, variables, presets, or identity behavior.
- Do not notarize unless the user explicitly requests it in a later message.
- Developer ID sign with `Developer ID Application: Adam Lighterman (8BWXULM784)`.
- Back up and replace `/Applications/DITBrowse.app` after every completed build for this task.

---

### Task 1: Make notarization explicit opt-in

**Files:**
- Create: `scripts/notarization-policy.mjs`
- Create: `scripts/notarization-policy.test.mjs`
- Modify: `scripts/sign-and-notarize-mac.mjs`
- Modify: `package.json`

**Interfaces:**
- Produces: `isNotarizationRequested(environment): boolean`, true only when `DITBROWSE_NOTARIZE === "1"`.
- Consumes: Existing Apple credential discovery in `notarizeOptions()` only after explicit opt-in.

- [ ] **Step 1: Write the failing release-policy test**

```js
// scripts/notarization-policy.test.mjs
import assert from "node:assert/strict";
import test from "node:test";
import { isNotarizationRequested } from "./notarization-policy.mjs";

test("does not infer notarization intent from Apple credentials", () => {
  assert.equal(
    isNotarizationRequested({
      APPLE_ID: "developer@example.com",
      APPLE_APP_SPECIFIC_PASSWORD: "placeholder",
      APPLE_TEAM_ID: "8BWXULM784"
    }),
    false
  );
});

test("requires the explicit notarization opt-in value", () => {
  assert.equal(isNotarizationRequested({ DITBROWSE_NOTARIZE: "true" }), false);
  assert.equal(isNotarizationRequested({ DITBROWSE_NOTARIZE: "1" }), true);
});
```

- [ ] **Step 2: Run the release-policy test and verify it fails**

Run: `node --test scripts/notarization-policy.test.mjs`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `scripts/notarization-policy.mjs`.

- [ ] **Step 3: Implement the policy helper**

```js
// scripts/notarization-policy.mjs
export function isNotarizationRequested(environment = process.env) {
  return environment.DITBROWSE_NOTARIZE === "1";
}
```

- [ ] **Step 4: Gate the existing notarization call on explicit intent**

Add the import to `scripts/sign-and-notarize-mac.mjs`:

```js
import { isNotarizationRequested } from "./notarization-policy.mjs";
```

Replace the current unconditional credential-driven block with:

```js
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
```

Add these scripts to `package.json`:

```json
{
  "scripts": {
    "package:mac:signed": "npm run package:mac && node scripts/sign-and-notarize-mac.mjs",
    "package:mac:notarized": "cross-env DITBROWSE_NOTARIZE=1 npm run package:mac:signed",
    "test:release-policy": "node --test scripts/notarization-policy.test.mjs"
  }
}
```

- [ ] **Step 5: Run the release-policy test and typecheck**

Run: `npm run test:release-policy && npm run typecheck`

Expected: two Node tests PASS and both TypeScript projects exit successfully.

- [ ] **Step 6: Commit the notarization safeguard**

```bash
git add package.json scripts/notarization-policy.mjs scripts/notarization-policy.test.mjs scripts/sign-and-notarize-mac.mjs
git commit -m "build: require explicit notarization opt in"
```

---

### Task 2: Show configured camera numbers in tile headers

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/TileGrid.tsx`
- Modify: `src/renderer/components/TileGrid.test.tsx`
- Modify: `src/renderer/components/WebviewTile.tsx`
- Modify: `src/renderer/components/WebviewTile.test.tsx`
- Modify: `src/renderer/styles.css`

**Interfaces:**
- Consumes: `parseStoredCameraNumber(value: string): number | null` from `src/shared/controlApi.ts`.
- Produces: `TileGridProps.cameraNumbersById: Map<string, number>` and `WebviewTileProps.cameraNumber?: number | null`.

- [ ] **Step 1: Add failing header and grid propagation tests**

Add to `src/renderer/components/WebviewTile.test.tsx`:

```tsx
it("shows the linked camera number as a centered integer label", () => {
  render(
    <WebviewTile
      tile={tile}
      cameraNumber={1}
      selected={false}
      onSelectTile={vi.fn()}
      onUrlCommitted={vi.fn()}
      onCredentialCaptured={vi.fn()}
      savedCredential={null}
      webviewPreloadPath={null}
    />
  );

  expect(screen.getByText("CAM 1")).toBeVisible();
});

it("omits the camera number for an unlinked tile", () => {
  render(
    <WebviewTile
      tile={{ ...tile, cameraId: null }}
      cameraNumber={null}
      selected={false}
      onSelectTile={vi.fn()}
      onUrlCommitted={vi.fn()}
      onCredentialCaptured={vi.fn()}
      savedCredential={null}
      webviewPreloadPath={null}
    />
  );

  expect(screen.queryByText(/CAM \d+/)).not.toBeInTheDocument();
});
```

Add `cameraNumbersById: new Map([["camera-41", 9]])` to `baseProps` in `TileGrid.test.tsx`, then add:

```tsx
it("matches camera numbers by camera id instead of tile position", () => {
  const reorderedTiles = [baseProps.tiles[1], baseProps.tiles[0]];
  const { getByText } = render(
    <TileGrid
      {...baseProps}
      tiles={reorderedTiles}
      cameraNumbersById={new Map([["camera-41", 9], ["camera-42", 3]])}
    />
  );

  expect(getByText("CAM 9")).toBeVisible();
  expect(getByText("CAM 3")).toBeVisible();
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `npx vitest run src/renderer/components/WebviewTile.test.tsx src/renderer/components/TileGrid.test.tsx`

Expected: FAIL because `cameraNumber` and `cameraNumbersById` are not defined and `CAM 1` is not rendered.

- [ ] **Step 3: Derive the active-list camera number map in `App.tsx`**

Import the parser:

```ts
import { parseStoredCameraNumber } from "../shared/controlApi";
```

After resolving `activeList`, add:

```ts
const cameraNumbersById = useMemo(() => {
  const numbers = new Map<string, number>();
  for (const camera of activeList?.cameras ?? []) {
    const cameraNumber = parseStoredCameraNumber(camera.suffix);
    if (cameraNumber !== null) {
      numbers.set(camera.id, cameraNumber);
    }
  }
  return numbers;
}, [activeList]);
```

Pass the map to `TileGrid`:

```tsx
<TileGrid
  tiles={workspace.tiles}
  cameraNumbersById={cameraNumbersById}
  globalZoom={workspace.globalZoom}
  // existing props remain unchanged
/>
```

- [ ] **Step 4: Pass the number through `TileGrid`**

Extend `TileGridProps` and destructuring:

```ts
interface TileGridProps {
  tiles: TileState[];
  cameraNumbersById: Map<string, number>;
  // existing props
}
```

```tsx
<WebviewTile
  key={tile.id}
  tile={tile}
  cameraNumber={tile.cameraId ? cameraNumbersById.get(tile.cameraId) ?? null : null}
  // existing props
/>
```

- [ ] **Step 5: Render the centered camera-number label in `WebviewTile`**

Extend the prop interface and destructuring:

```ts
interface WebviewTileProps {
  tile: TileState;
  cameraNumber?: number | null;
  // existing props
}
```

Replace the tile label with:

```tsx
<div className={cameraNumber ? "tile-label has-camera-number" : "tile-label"}>
  <span className="tile-label-title">{tile.title || tile.url || "Blank"}</span>
  {cameraNumber && <strong className="tile-camera-number">CAM {cameraNumber}</strong>}
  {cameraNumber && <span className="tile-label-balance" aria-hidden="true" />}
</div>
```

Update the tile-label CSS:

```css
.tile-label-title {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.tile-label.has-camera-number {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
  gap: 6px;
}

.tile-camera-number {
  grid-column: 2;
  justify-self: center;
  color: var(--accent-strong);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.04em;
  white-space: nowrap;
}

.tile-label-balance {
  grid-column: 3;
}
```

- [ ] **Step 6: Run focused and app tests**

Run: `npx vitest run src/renderer/components/WebviewTile.test.tsx src/renderer/components/TileGrid.test.tsx src/renderer/App.test.tsx`

Expected: all focused tests PASS.

- [ ] **Step 7: Commit the camera-number UI**

```bash
git add src/renderer/App.tsx src/renderer/components/TileGrid.tsx src/renderer/components/TileGrid.test.tsx src/renderer/components/WebviewTile.tsx src/renderer/components/WebviewTile.test.tsx src/renderer/styles.css
git commit -m "feat: show camera numbers in tile headers"
```

---

### Task 3: Center and compact workspace settings

**Files:**
- Modify: `src/renderer/styles.css`
- Modify: `tests/e2e/workspace.spec.ts`

**Interfaces:**
- Consumes: Existing `aria-label="Camera workspace settings"` and `aria-label="Camera list editor"` locators.
- Produces: A centered settings layout whose computed width is `min(960px, available editor width)`.

- [ ] **Step 1: Add a failing wide-screen layout regression test**

Add to `tests/e2e/workspace.spec.ts`:

```ts
test("workspace settings stay compact and centered on wide displays", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 2048, height: 1040 });
  await page.goto("/");
  await page.getByRole("button", { name: "Camera List", exact: true }).click();

  const editor = page.getByLabel("Camera list editor");
  const settings = page.getByLabel("Camera workspace settings");
  await settings.scrollIntoViewIfNeeded();

  const editorBox = await editor.boundingBox();
  const settingsBox = await settings.boundingBox();
  expect(settingsBox?.width).toBeLessThanOrEqual(960);
  expect(
    Math.abs(
      (settingsBox?.x ?? 0) + (settingsBox?.width ?? 0) / 2 -
        ((editorBox?.x ?? 0) + (editorBox?.width ?? 0) / 2)
    )
  ).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(2048);
  await settings.screenshot({
    path: testInfo.outputPath("workspace-settings-compact.png")
  });
});
```

- [ ] **Step 2: Run the new Playwright test and verify it fails**

Run: `npx playwright test tests/e2e/workspace.spec.ts -g "workspace settings stay compact"`

Expected: FAIL because the settings width is approximately the full editor width and exceeds `960px`.

- [ ] **Step 3: Apply the centered compact settings CSS**

Update the workspace settings rules:

```css
.workspace-settings {
  display: grid;
  width: min(100%, 960px);
  min-width: 0;
  margin: 12px auto 0;
  border-top: 1px solid var(--line-soft);
}

.workspace-settings-section {
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 12px 0;
  border-top: 1px solid var(--line-soft);
}

.workspace-job-section .job-inline-form {
  grid-template-columns: minmax(240px, 420px) auto;
  justify-content: start;
}

.credential-preset-form {
  grid-template-columns: repeat(3, minmax(160px, 220px)) auto;
  justify-content: start;
}

.control-api-form {
  grid-template-columns: minmax(160px, 220px) auto;
  justify-content: start;
}
```

Preserve the existing `@media (max-width: 900px)` form and row collapsing rules so fields stack when the editor becomes narrow.

- [ ] **Step 4: Run the focused Playwright test and existing component tests**

Run: `npx playwright test tests/e2e/workspace.spec.ts -g "workspace settings stay compact|camera list opens" && npx vitest run src/renderer/components/WorkspaceSettings.test.tsx src/renderer/components/CameraListEditor.test.tsx`

Expected: all selected tests PASS with no horizontal overflow.

- [ ] **Step 5: Capture and inspect a wide-screen settings screenshot**

Run: `npx playwright test tests/e2e/workspace.spec.ts -g "workspace settings stay compact"`

Locate the artifact with `rg --files test-results | rg 'workspace-settings-compact\.png$'` and inspect that exact path with the local image viewer.

Expected: the settings content is centered, capped at `960px`, the form controls no longer span the display, and all labels/actions remain readable.

- [ ] **Step 6: Commit the compact layout**

```bash
git add src/renderer/styles.css tests/e2e/workspace.spec.ts
git commit -m "style: compact workspace settings"
```

---

### Task 4: Verify, package without notarization, and replace the installed app

**Files:**
- Verify only: all modified source and test files
- Build output: `release/DITBrowse-darwin-arm64/DITBrowse.app`
- Install target: `/Applications/DITBrowse.app`
- Backup target: `/Users/lightlab/Documents/DITBrowse App Backups/DITBrowse-<timestamp>.app`

**Interfaces:**
- Consumes: `npm run package:mac:signed` with default `DITBROWSE_NOTARIZE` behavior.
- Produces: Developer ID–signed, non-notarized installed app with a live local API and Companion WebSocket connection.

- [ ] **Step 1: Run the complete verification suite**

Run:

```bash
npm run test:release-policy
npm test
npm run typecheck
npm run test:e2e
npm run test:electron
```

Expected: every command exits successfully.

- [ ] **Step 2: Build and sign without notarizing**

Run: `DITBROWSE_NOTARIZE=0 npm run package:mac:signed`

Expected output includes:

```text
Skipping notarization; set DITBROWSE_NOTARIZE=1 to opt in
Signed release is ready
```

Expected output must not include `Submitting app for Apple notarization`.

- [ ] **Step 3: Verify the candidate signature and absence of a stapled ticket**

Run:

```bash
codesign --verify --deep --strict --verbose=2 release/DITBrowse-darwin-arm64/DITBrowse.app
codesign -dv --verbose=4 release/DITBrowse-darwin-arm64/DITBrowse.app
xcrun stapler validate release/DITBrowse-darwin-arm64/DITBrowse.app
```

Expected: `codesign` reports a valid Developer ID signature with TeamIdentifier `8BWXULM784`. `stapler validate` reports no stapled ticket, confirming the build was not notarized.

- [ ] **Step 4: Back up and replace `/Applications/DITBrowse.app`**

Stop the running app with a bounded TERM/KILL loop. Copy the existing installed app to a timestamped path under `/Users/lightlab/Documents/DITBrowse App Backups`, move it out of `/Applications`, and use `ditto` to copy the verified candidate into `/Applications/DITBrowse.app`. If `ditto` fails, restore the backup before exiting.

- [ ] **Step 5: Relaunch and verify live behavior**

Run `open -n /Applications/DITBrowse.app`, wait up to 15 seconds for `http://127.0.0.1:7502/api/status`, and verify:

```text
HTTP status ok=true
12 camera tabs are present
WebSocket hello is ditbrowse.control@1
WebSocket status result ok=true
Companion has an ESTABLISHED loopback socket to port 7502
```

Also verify `codesign -dv --verbose=2 /Applications/DITBrowse.app` still reports `Developer ID Application: Adam Lighterman (8BWXULM784)`.

- [ ] **Step 6: Confirm repository state and record the installed backup path**

Run: `git status --short && git log -4 --oneline`

Expected: no uncommitted source changes remain. Record the timestamped backup path in the final handoff.
