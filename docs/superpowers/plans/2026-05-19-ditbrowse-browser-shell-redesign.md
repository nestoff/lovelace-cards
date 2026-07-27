# DITBrowse Browser Shell Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the rough dashboard-like DITBrowse chrome with a browser-first React shell while preserving Electron webviews, equal-size tiles, row-major order, cookies, and camera-list persistence.

**Architecture:** Keep Electron and the existing workspace reducer. Move the renderer shell into focused browser-chrome components, hide secondary camera/job tools in a menu drawer, and memoize tile rendering so toolbar interactions do not remount webviews.

**Tech Stack:** Electron 42, React 19, TypeScript, Vite, Vitest, Testing Library, Playwright, CSS tokens/classes.

---

## File Structure

- Create `src/renderer/components/BrowserChrome.tsx`: top-level browser shell for tabs, toolbar, and tools drawer.
- Create `src/renderer/components/BrowserToolbar.tsx`: navigation buttons, address bar, selected-tile status, and compact grid controls.
- Create `src/renderer/components/BrowserToolsMenu.tsx`: secondary camera/job/list/cookie/reset actions.
- Create `src/renderer/components/ui/IconButton.tsx`: reusable accessible icon button.
- Create `src/renderer/components/BrowserChrome.test.tsx`: regression tests for browser-shell layout and hidden secondary tools.
- Create `src/renderer/state/useDebouncedWorkspaceSave.ts`: debounced persistence hook.
- Create `src/renderer/state/useDebouncedWorkspaceSave.test.tsx`: regression tests for debounced saves.
- Modify `src/renderer/App.tsx`: use the browser shell and stable callbacks.
- Modify `src/renderer/components/AddressBar.tsx`: browser-style single address field with compact submit/new-tile actions.
- Modify `src/renderer/components/GridControls.tsx`: compact browser toolbar controls.
- Modify `src/renderer/components/TabStrip.tsx`: browser-like tab strip.
- Modify `src/renderer/components/TileGrid.tsx`: memoize slot mapping and component export.
- Modify `src/renderer/components/WebviewTile.tsx`: memoize tile component and tighten label/status rendering.
- Modify `src/renderer/styles.css`: replace dashboard styling with browser-chrome design tokens and stable dimensions.
- Modify `tests/e2e/workspace.spec.ts`: verify browser chrome order, hidden tools, and equal tile sizing.

---

## Task 1: Browser Shell Structure

**Files:**
- Create: `src/renderer/components/BrowserChrome.test.tsx`
- Create: `src/renderer/components/BrowserChrome.tsx`
- Create: `src/renderer/components/BrowserToolbar.tsx`
- Create: `src/renderer/components/BrowserToolsMenu.tsx`
- Create: `src/renderer/components/ui/IconButton.tsx`
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Write failing browser-chrome layout test**

Create `src/renderer/components/BrowserChrome.test.tsx` with tests that render `BrowserChrome` using `sampleWorkspace`. Assert `aria-label="Camera tabs"` appears before `aria-label="Browser toolbar"`, exactly one `aria-label="Address"` input exists, and the camera workspace tools drawer is hidden until clicking `aria-label="Workspace tools"`.

Run: `npm run test -- src/renderer/components/BrowserChrome.test.tsx`

Expected before implementation: FAIL because `BrowserChrome` does not exist.

- [ ] **Step 2: Implement browser shell components**

Create the browser shell components listed above. `BrowserChrome` should render in this order:

1. `<TabStrip />`
2. `<BrowserToolbar />`
3. `<BrowserToolsMenu />` only when the tools menu is open

`BrowserToolbar` should expose `aria-label="Browser toolbar"`. `BrowserToolsMenu` should expose `aria-label="Camera workspace tools"`. `IconButton` must render a real `<button>` with `aria-label`, `title`, stable square dimensions, and optional active/disabled state classes.

- [ ] **Step 3: Wire App through BrowserChrome**

Replace the flattened `<header className="top-bar">` in `src/renderer/App.tsx` with `<BrowserChrome />`. Preserve existing actions exactly: back, forward, reload selected, reload all, navigate selected, open new tile, grid columns, selected zoom, selected viewport, job/list selection, edit list, reset scale, reset order, clear selected cookies, and clear list cookies.

- [ ] **Step 4: Verify Task 1**

Run: `npm run test -- src/renderer/components/BrowserChrome.test.tsx`

Expected after implementation: PASS.

---

## Task 2: Webview Render Stability And Persistence Debounce

**Files:**
- Create: `src/renderer/state/useDebouncedWorkspaceSave.ts`
- Create: `src/renderer/state/useDebouncedWorkspaceSave.test.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/components/TileGrid.tsx`
- Modify: `src/renderer/components/WebviewTile.tsx`

- [ ] **Step 1: Write failing debounce test**

Create `src/renderer/state/useDebouncedWorkspaceSave.test.tsx`. Use fake timers and a small test component to call `useDebouncedWorkspaceSave({ loaded: true, workspace, saveWorkspace: saveSpy, delayMs: 250 })`. Rerender with three workspace objects before advancing timers. Assert `saveSpy` is not called before the delay and is called once with the latest workspace after the delay.

Run: `npm run test -- src/renderer/state/useDebouncedWorkspaceSave.test.tsx`

Expected before implementation: FAIL because the hook does not exist.

- [ ] **Step 2: Implement debounced save hook**

Create `useDebouncedWorkspaceSave` so it schedules one save after the delay, clears pending timers on dependency changes, skips saves until `loaded` is true, and clears pending timers on unmount.

- [ ] **Step 3: Use hook and memoize tiles**

Replace the immediate `saveWorkspace(workspace)` effect in `App.tsx` with `useDebouncedWorkspaceSave`. Wrap `TileGrid` and `WebviewTile` exports in `memo`. In `TileGrid`, use `useMemo` for `slots` and `tileById`.

- [ ] **Step 4: Verify Task 2**

Run: `npm run test -- src/renderer/state/useDebouncedWorkspaceSave.test.tsx src/renderer/components/WebviewTile.test.tsx`

Expected after implementation: PASS.

---

## Task 3: Browser-Like Visual System

**Files:**
- Modify: `src/renderer/components/AddressBar.tsx`
- Modify: `src/renderer/components/GridControls.tsx`
- Modify: `src/renderer/components/TabStrip.tsx`
- Modify: `src/renderer/components/CookieCommands.tsx`
- Modify: `src/renderer/styles.css`
- Modify: `tests/e2e/workspace.spec.ts`

- [ ] **Step 1: Write failing e2e expectations**

Update `tests/e2e/workspace.spec.ts` to assert:

- `page.getByLabel("Camera tabs")` is visible above `page.getByLabel("Browser toolbar")`.
- `page.getByLabel("Workspace tools")` is visible.
- `page.getByLabel("Camera workspace tools")` is not visible before the tools button is clicked.
- After clicking the tools button, `page.getByLabel("Camera workspace tools")` is visible.
- The first and second visible `.tile-slot` elements have matching heights after changing the grid to 5 columns.

Run: `npm run test:e2e`

Expected before visual shell implementation: FAIL because the browser toolbar/tools drawer do not exist.

- [ ] **Step 2: Update controls to browser-scale components**

Revise `AddressBar`, `GridControls`, `TabStrip`, and `CookieCommands` so visible labels are short, dimensions are stable, and icon/button text does not dominate the chrome. Keep all existing aria labels stable or clearer.

- [ ] **Step 3: Replace CSS with browser chrome styling**

Rewrite `src/renderer/styles.css` around design tokens for a dark neutral browser shell. Required classes include `browser-shell`, `browser-tab-row`, `browser-toolbar`, `browser-toolbar-main`, `browser-tools-popover`, `toolbar-group`, `icon-button`, `address-bar`, `grid-controls`, `tab-strip`, `tab`, `tile-grid`, `tile-slot`, `tile-label`, and the existing editor panel/table classes.

- [ ] **Step 4: Verify Task 3**

Run: `npm run test:e2e`

Expected after implementation: PASS.

---

## Task 4: Full Verification And Browser Screenshot

**Files:**
- Modify only if verification exposes a bug in files from Tasks 1-3.

- [ ] **Step 1: Run unit tests**

Run: `npm run test`

Expected: 10 test files pass, including the new browser shell and debounced save tests.

- [ ] **Step 2: Run typecheck and build**

Run: `npm run typecheck`

Expected: exit 0.

Run: `npm run build`

Expected: exit 0.

- [ ] **Step 3: Run e2e tests**

Run: `npm run test:e2e`

Expected: exit 0.

- [ ] **Step 4: Run the app and inspect the browser-like shell**

Run: `npm run electron:dev`

Use the in-app browser or Playwright screenshot if the Browser tool is unavailable. Verify the first viewport reads as a browser: tabs first, toolbar second, one address bar, compact right-side controls, secondary tools hidden behind the workspace tools button, and equal-size tiles in the content area.

- [ ] **Step 5: Commit implementation**

After verification passes, commit the implementation on `codex/browser-shell-redesign` with:

```bash
git add src tests docs package.json package-lock.json
git commit -m "feat: redesign browser shell"
```

---

## Self-Review

- Spec coverage: The plan covers browser chrome structure, secondary tools, tile grid preservation, performance debounce/memoization, and rendered verification.
- Placeholder scan: No task contains TBD/TODO/fill-later placeholders.
- Type consistency: Component names and hook names are consistent across the file structure and tasks.
