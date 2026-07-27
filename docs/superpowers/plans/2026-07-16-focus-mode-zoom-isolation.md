# Focus Mode Zoom Isolation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make a focused camera page fill the available window without applying its saved per-camera zoom or the grid-wide relative zoom, while preserving temporary trackpad zoom/pan and restoring the saved grid view when focus mode closes.

**Architecture:** Keep focus mode as the existing render-only layout state so every webview remains mounted. In `WebviewTile`, derive the persistent zoom multiplier from `focused`: use `1` while focused and `tile.zoom * globalZoom` in the grid. Continue multiplying the resulting fit scale by the independent temporary trackpad zoom, leaving temporary pan and Shift+Z reset behavior unchanged.

**Tech Stack:** React 19, TypeScript, Vitest, Testing Library, Playwright, Electron, Electron Packager.

## Global Constraints

- Never navigate, reload, unmount, or recreate a webview when entering or leaving focus mode.
- Ignore both saved per-camera zoom and grid-wide relative zoom only for the focused rendering.
- Do not mutate either saved zoom value when focus mode changes.
- Keep temporary trackpad pinch zoom and pan active in focus mode; Shift+Z must continue resetting only that temporary transform.
- Grid mode behavior and zoom controls remain unchanged.

---

### Task 1: Isolate persistent zoom from focused rendering

**Files:**
- Modify: `src/renderer/components/WebviewTile.test.tsx`
- Modify: `src/renderer/components/WebviewTile.tsx`

**Interfaces:**
- Consumes: Existing `WebviewTileProps.focused`, `tile.zoom`, and `globalZoom` values.
- Produces: A render-only persistent multiplier of `1` in focus mode and `tile.zoom * globalZoom` in grid mode.

- [ ] **Step 1: Add failing component regressions**

Add tests proving all three required transitions:

```tsx
it("ignores individual and all-tiles zoom while focused", () => {
  render(
    <WebviewTile
      tile={{ ...tile, zoom: 1.05 }}
      globalZoom={1.2}
      focused
      selected
      onSelectTile={vi.fn()}
      onUrlCommitted={vi.fn()}
      onCredentialCaptured={vi.fn()}
      savedCredential={null}
      webviewPreloadPath={null}
    />
  );

  resizeTile(1024, 792);

  expect(document.querySelector("webview")).toHaveStyle({ transform: "scale(1)" });
});
```

Add a focused pinch regression using the existing `ditbrowse:temporary-view-gesture` event. With `tile.zoom={1.05}`, `globalZoom={1.2}`, and a `-100` pinch delta, assert `scale(8)` rather than `scale(10.08)`.

Add a rerender regression that captures the webview element, enters focus at `scale(1)`, leaves focus at `scale(1.26)`, and asserts the same DOM element remains mounted.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npx vitest run src/renderer/components/WebviewTile.test.tsx`

Expected: the new focus assertions fail because the current implementation always applies `tile.zoom * globalZoom`.

- [ ] **Step 3: Implement the render-only zoom multiplier**

In `WebviewTile.tsx`, derive the multiplier before calling `computeFitScale`:

```ts
const persistentZoom = focused ? 1 : tile.zoom * globalZoom;
const fitScale = computeFitScale({
  tileWidth: frame.width,
  tileHeight: frame.height,
  viewportWidth: tile.viewport.width,
  viewportHeight: tile.viewport.height,
  manualZoom: persistentZoom
});
```

Do not change `temporaryView`, URL state, or webview keys.

- [ ] **Step 4: Run the component regressions**

Run: `npx vitest run src/renderer/components/WebviewTile.test.tsx src/renderer/components/TileGrid.test.tsx`

Expected: all tests pass, including the existing grid-relative zoom and focus-mounting tests.

- [ ] **Step 5: Commit the focused renderer behavior**

```bash
git add src/renderer/components/WebviewTile.tsx src/renderer/components/WebviewTile.test.tsx
git commit -m "fix: isolate focus mode from grid zoom"
```

---

### Task 2: Verify focus transitions in the browser shell

**Files:**
- Modify: `tests/e2e/workspace.spec.ts`

- [ ] **Step 1: Extend the existing focus-mode browser regression**

Before entering focus mode, set the selected-camera zoom to `105%` and the all-tiles relative zoom to `120%`. Assert the grid webview scale equals its current fit scale multiplied by `1.26`.

After entering focus mode, recompute the selected tile's fit scale from the focused frame and configured viewport and assert the rendered scale equals fit scale alone. Keep the existing assertions that all webviews remain mounted and non-selected tiles are hidden rather than removed.

After returning to the grid, recompute the grid fit scale and assert the selected page again renders at fit scale multiplied by `1.26`.

Use a local test helper so each assertion measures the current layout rather than depending on a fixed browser size:

```ts
import { expect, test, type Locator } from "@playwright/test";

async function readWebviewScale(webview: Locator): Promise<{ fit: number; scale: number }> {
  return webview.evaluate((element) => {
    const frame = element.parentElement?.getBoundingClientRect();
    const viewportWidth = Number.parseFloat((element as HTMLElement).style.width);
    const viewportHeight = Number.parseFloat((element as HTMLElement).style.height);
    const scaleMatch = (element as HTMLElement).style.transform.match(/scale\(([^)]+)\)/);

    if (!frame || !scaleMatch) {
      throw new Error("Unable to measure camera webview scale");
    }

    return {
      fit: Math.min(frame.width / viewportWidth, frame.height / viewportHeight),
      scale: Number(scaleMatch[1])
    };
  });
}
```

Drive the existing controls by their accessible labels:

```ts
await page.getByLabel("Selected zoom percent").fill("105");
await page.getByLabel("Selected zoom percent").press("Enter");
await page.getByLabel("Global zoom controls").click();
await page.getByLabel("All tiles relative zoom percent").fill("120");
await page.getByLabel("All tiles relative zoom percent").press("Enter");

const selectedWebview = page.locator('webview[data-tile-id="tile-41"]');
const gridScale = await readWebviewScale(selectedWebview);
expect(gridScale.scale).toBeCloseTo(gridScale.fit * 1.26, 3);

await page.getByLabel("Focus selected page").click();
const focusedScale = await readWebviewScale(selectedWebview);
expect(focusedScale.scale).toBeCloseTo(focusedScale.fit, 3);

await page.getByLabel("Show all pages").click();
const restoredScale = await readWebviewScale(selectedWebview);
expect(restoredScale.scale).toBeCloseTo(restoredScale.fit * 1.26, 3);
```

- [ ] **Step 2: Run the focused browser regression**

Run: `npx playwright test tests/e2e/workspace.spec.ts --grep "focus mode singles out" --workers=1`

Expected: PASS with the focused scale isolated and the grid scale restored.

- [ ] **Step 3: Run the complete verification suite**

Run: `npm run typecheck`

Run: `npm test`

Run: `npm run test:e2e`

Run: `npm run test:electron`

Expected: all TypeScript, unit, browser, and packaged Electron checks pass.

- [ ] **Step 4: Commit the browser regression**

```bash
git add tests/e2e/workspace.spec.ts
git commit -m "test: cover zoom isolation in focus mode"
```

---

### Task 3: Rebuild the macOS application

**Files:**
- Generated: `release/DITBrowse-darwin-arm64/DITBrowse.app`
- Install: `/Applications/DITBrowse.app`

- [ ] **Step 1: Build and sign the macOS app without requesting notarization**

Run: `npm run package:mac:signed`

Expected: packaging and Developer ID signing complete; notarization remains skipped unless explicitly opted in.

- [ ] **Step 2: Replace the installed app without changing its saved data directory**

Quit any running DITBrowse process, back up the existing app bundle, and install the rebuilt `release/DITBrowse-darwin-arm64/DITBrowse.app` at `/Applications/DITBrowse.app`. Do not remove `~/Library/Application Support/DITBrowse` or any saved workspace data.

- [ ] **Step 3: Launch and smoke-test the rebuilt app**

Open `/Applications/DITBrowse.app` and verify it launches without a main-process error. Confirm focus mode fills the page, ignores persistent zoom, accepts temporary trackpad zoom/pan, and restores grid zoom after returning to the grid.

- [ ] **Step 4: Record final repository state**

Run: `git status --short --branch`

Expected: no uncommitted source changes; generated release artifacts may remain ignored.
