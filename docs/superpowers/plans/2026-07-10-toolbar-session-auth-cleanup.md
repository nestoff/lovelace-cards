# Toolbar, Startup, Session, and Sign-In Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver a neutral, simplified camera toolbar; prevent sample-camera startup loads; consolidate scoped camera session actions; and add correctly routed one-click HTTP-auth sign-in.

**Architecture:** A bootstrap wrapper loads and normalizes the real workspace before the live application mounts. Toolbar state remains renderer-owned, while destructive session workflows call explicit scoped credential-forget actions only after Electron cleanup succeeds. Authentication requests preserve the originating guest webContents ID and expose paired preset actions through the existing FIFO prompt queue.

**Tech Stack:** React 19, TypeScript, CSS, Electron 42, Vitest, Testing Library, Playwright, Electron Packager, `@electron/osx-sign`.

## Global Constraints

- Ordinary Reload and Command-R remain non-destructive.
- Selected sign-out must forget the selected tile password after cleanup succeeds.
- Active-list sign-out deletes only password records for the captured job/list scope.
- Global credential presets and credentials for other jobs/lists remain untouched.
- No sample BrowserChrome, TileGrid, or webview may mount before saved workspace loading completes.
- No blue focus, selection, slider, checkbox, selected-tile, or camera-number accents remain.
- One Resolution control replaces the duplicate aspect/default and viewport controls.
- Preset sign-in always requires one explicit operator click and never displays raw passwords in suggestion labels.
- Do not notarize unless the user explicitly requests it in a later message.
- Developer ID sign with `Developer ID Application: Adam Lighterman (8BWXULM784)`.
- Back up and replace `/Applications/DITBrowse.app` after verification.

---

### Task 1: Bootstrap the saved workspace before mounting webviews

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/App.test.tsx`
- Modify: `src/renderer/styles.css`

**Interfaces:**
- Produces: `WorkspaceApp({ initialWorkspace }: { initialWorkspace: WorkspaceState })` for the live application.
- Produces: exported `App()` bootstrap wrapper with loading, ready, error, and Retry states.
- Consumes: existing `loadWorkspace()` and reducer action `{ type: "hydrateWorkspace"; workspace }` so all legacy normalization remains in one place.

- [ ] **Step 1: Add deferred bootstrap regression tests**

Add a deferred helper to `src/renderer/App.test.tsx`:

```ts
function deferred<T>(): {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(error: unknown): void;
} {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
```

Add a StrictMode test that defers `window.ditbrowse.loadWorkspace`, renders `<StrictMode><App /></StrictMode>`, and asserts before resolution:

```tsx
expect(screen.getByRole("status")).toHaveTextContent("Loading workspace…");
expect(screen.queryByLabelText("Browser toolbar")).not.toBeInTheDocument();
expect(screen.queryByLabelText("Camera tabs")).not.toBeInTheDocument();
expect(document.querySelectorAll("webview")).toHaveLength(0);
expect(document.body).not.toHaveTextContent("192.168.1.01");
expect(window.ditbrowse.publishControlApiStatus).not.toHaveBeenCalled();
```

Resolve with a one-camera saved workspace at `10.20.100.109`, then assert:

```tsx
expect(await screen.findByDisplayValue("http://10.20.100.109")).toBeVisible();
expect(document.querySelectorAll("webview")).toHaveLength(1);
expect(document.querySelector("webview")).toHaveAttribute("src", "http://10.20.100.109");
expect(window.ditbrowse.loadWorkspace).toHaveBeenCalledOnce();
expect(window.ditbrowse.publishControlApiStatus).toHaveBeenCalledWith(
  expect.objectContaining({ tabs: [expect.objectContaining({ url: "http://10.20.100.109" })] })
);
```

Add a rejection/Retry test: first load rejects, the error view contains `Workspace could not be loaded` and Retry with zero webviews, then Retry resolves a saved workspace and mounts only that workspace.

- [ ] **Step 2: Run the focused tests and verify the startup test fails**

Run: `npx vitest run src/renderer/App.test.tsx`

Expected: FAIL because the current App immediately renders sample BrowserChrome, TileGrid, and `192.168.1.*` webviews and has no Retry surface.

- [ ] **Step 3: Split bootstrap from the live application**

Rename the current component and begin it with:

```tsx
interface WorkspaceAppProps {
  initialWorkspace: WorkspaceState;
}

function hydrateInitialWorkspace(workspace: WorkspaceState): WorkspaceState {
  return workspaceReducer(workspace, { type: "hydrateWorkspace", workspace });
}

function WorkspaceApp({ initialWorkspace }: WorkspaceAppProps): ReactElement {
  const [workspace, dispatch] = useReducer(
    workspaceReducer,
    initialWorkspace,
    hydrateInitialWorkspace
  );
```

Remove the `sampleWorkspace` reducer initializer, `loaded` state, and the existing hydration effect. Change persistence and initial status publication to:

```ts
useDebouncedWorkspaceSave({ loaded: true, workspace, saveWorkspace });

useEffect(() => {
  window.ditbrowse?.publishControlApiStatus?.(controlApiStatus);
}, [controlApiStatus]);
```

- [ ] **Step 4: Add a StrictMode-safe bootstrap wrapper**

Add above `WorkspaceApp`:

```tsx
type WorkspaceBootstrapState =
  | { status: "loading" }
  | { status: "ready"; workspace: WorkspaceState }
  | { status: "error" };

interface WorkspaceLoadAttempt {
  attempt: number;
  promise: Promise<WorkspaceState>;
}

export function App(): ReactElement {
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [bootstrapState, setBootstrapState] = useState<WorkspaceBootstrapState>({
    status: "loading"
  });
  const inFlightLoadRef = useRef<WorkspaceLoadAttempt | null>(null);

  useEffect(() => {
    const existing = inFlightLoadRef.current;
    const current =
      existing?.attempt === loadAttempt
        ? existing
        : {
            attempt: loadAttempt,
            promise: Promise.resolve().then(() => loadWorkspace())
          };
    inFlightLoadRef.current = current;
    let cancelled = false;

    void current.promise.then(
      (workspace) => {
        if (!cancelled && inFlightLoadRef.current === current) {
          setBootstrapState({ status: "ready", workspace });
        }
      },
      () => {
        if (!cancelled && inFlightLoadRef.current === current) {
          setBootstrapState({ status: "error" });
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [loadAttempt]);

  const retry = (): void => {
    inFlightLoadRef.current = null;
    setBootstrapState({ status: "loading" });
    setLoadAttempt((attempt) => attempt + 1);
  };

  if (bootstrapState.status === "loading") {
    return (
      <main className="workspace-boot">
        <p role="status">Loading workspace…</p>
      </main>
    );
  }

  if (bootstrapState.status === "error") {
    return (
      <main className="workspace-boot">
        <div className="workspace-boot-error" role="alert">
          <strong>Workspace could not be loaded</strong>
          <Button onClick={retry}>Retry</Button>
        </div>
      </main>
    );
  }

  return <WorkspaceApp initialWorkspace={bootstrapState.workspace} />;
}
```

- [ ] **Step 5: Style the neutral bootstrap surface**

Add to `src/renderer/styles.css`:

```css
.workspace-boot {
  display: grid;
  place-items: center;
  width: 100%;
  height: 100%;
  background: var(--window);
  color: var(--muted);
}

.workspace-boot > p {
  margin: 0;
  font-size: 12px;
}

.workspace-boot-error {
  display: grid;
  justify-items: center;
  gap: 12px;
}

.workspace-boot-error strong {
  color: var(--text-strong);
  font-size: 13px;
}
```

- [ ] **Step 6: Verify boot behavior and normalization**

Run: `npx vitest run src/renderer/App.test.tsx src/renderer/state/workspaceReducer.test.ts && npm run typecheck`

Expected: bootstrap, retry, existing App, reducer migration, and type tests PASS.

- [ ] **Step 7: Commit the bootstrap boundary**

```bash
git add src/renderer/App.tsx src/renderer/App.test.tsx src/renderer/styles.css
git commit -m "fix: load workspace before mounting cameras"
```

---

### Task 2: Neutralize accents and simplify camera layout controls

**Files:**
- Modify: `src/renderer/styles.css`
- Modify: `src/renderer/toolbarLayout.test.ts`
- Modify: `src/shared/viewport.ts`
- Modify: `src/renderer/components/GridControls.tsx`
- Modify: `src/renderer/components/BrowserToolbar.tsx`
- Modify: `src/renderer/components/BrowserChrome.tsx`
- Modify: `src/renderer/components/BrowserChrome.test.tsx`
- Modify: `src/renderer/App.tsx`

**Interfaces:**
- Removes: `defaultViewport` and `onDefaultViewportChange` from the App → BrowserChrome → BrowserToolbar → GridControls chain.
- Produces: `GridControlsProps.selectedViewport: ViewportSize | null`.
- Produces: `GridControlsProps.onApplyViewportToAll(viewport: ViewportSize): void`.

- [ ] **Step 1: Add failing neutral-palette and toolbar tests**

Extend `src/renderer/toolbarLayout.test.ts` with:

```ts
it("uses neutral focus and selection accents", async () => {
  const css = await readFile(new URL("./styles.css", import.meta.url), "utf8");
  expect(css).toContain("--focus: #c8c8ce");
  expect(css).toContain("outline: 2px solid var(--focus)");
  expect(css).not.toMatch(/#7d9dee|#9bb4f5|rgba\(125, 157, 238|rgba\(79, 115, 220/);
  expect(css).not.toContain("--accent-cyan");
});
```

Replace the separate default-aspect and viewport assertions in `BrowserChrome.test.tsx` with tests that assert:

```tsx
expect(screen.queryByLabelText("Default aspect ratio")).not.toBeInTheDocument();
expect(screen.queryByLabelText("All viewport controls")).not.toBeInTheDocument();
expect(screen.getByLabelText("Selected camera resolution")).toHaveDisplayValue(
  "1024×768 · 4:3"
);
expect(screen.getByRole("button", { name: "Apply resolution to all cameras" })).toBeVisible();
expect(container.querySelector(".selected-tile-status")).toBeNull();
```

Change the selected resolution, click Apply to All, and assert `onViewportChange` receives the selected value while `onGlobalViewportChange` receives the current selected value only when Apply to All is clicked. Add a no-selection render asserting both controls are disabled.

- [ ] **Step 2: Run the focused tests and verify they fail**

Run: `npx vitest run src/renderer/toolbarLayout.test.ts src/renderer/components/BrowserChrome.test.tsx`

Expected: FAIL because legacy blue values, selected-title status, Default aspect control, and all-viewport popover still exist.

- [ ] **Step 3: Make viewport labels unambiguous**

Simplify `ViewportPreset` in `src/shared/viewport.ts`:

```ts
export interface ViewportPreset {
  label: string;
  value: string;
  viewport: ViewportSize;
}

export const VIEWPORT_PRESETS: ViewportPreset[] = [
  { label: "1024×768 · 4:3", value: "1024x768", viewport: DEFAULT_VIEWPORT },
  { label: "1280×720 · 16:9", value: "1280x720", viewport: { width: 1280, height: 720 } },
  { label: "1200×800 · 3:2", value: "1200x800", viewport: { width: 1200, height: 800 } },
  { label: "1024×1024 · 1:1", value: "1024x1024", viewport: { width: 1024, height: 1024 } },
  { label: "1920×1080 · 16:9", value: "1920x1080", viewport: { width: 1920, height: 1080 } }
];
```

Delete `DEFAULT_ASPECT_RATIO_PRESETS` and `shortLabel`.

- [ ] **Step 4: Replace duplicate viewport controls with Resolution and Apply to All**

Remove global-viewport popover state and props from `GridControls.tsx`. Use this interface subset:

```ts
interface GridControlsProps {
  columns: number;
  selectedZoom: number;
  globalZoom: number;
  selectedViewport: ViewportSize | null;
  onColumnsChange(columns: number): void;
  onRelativeGlobalZoomChange(factor: number): void;
  onGlobalViewportChange(viewport: ViewportSize): void;
  onZoomChange(zoom: number): void;
  onViewportChange(viewport: ViewportSize): void;
  icon?: ReactNode;
}
```

Render the single control:

```tsx
<label className="grid-control resolution-control">
  <span>Resolution</span>
  <select
    value={selectedViewport ? viewportToValue(selectedViewport) : ""}
    disabled={!selectedViewport}
    onChange={(event) => onViewportChange(viewportFromValue(event.target.value))}
    aria-label="Selected camera resolution"
  >
    {VIEWPORT_PRESETS.map((preset) => (
      <option key={preset.value} value={preset.value}>
        {preset.label}
      </option>
    ))}
  </select>
</label>
<Button
  type="button"
  variant="subtle"
  size="compact"
  disabled={!selectedViewport}
  aria-label="Apply resolution to all cameras"
  onClick={() => selectedViewport && onGlobalViewportChange(selectedViewport)}
>
  Apply to All
</Button>
```

- [ ] **Step 5: Remove the redundant selected-camera strip and old prop chain**

In `BrowserToolbar.tsx`, delete `SquareStack`, `selectedName`, and the `.selected-tile-status` markup. Remove `defaultViewport` and `onDefaultViewportChange` from BrowserToolbar props and its GridControls call.

Make the corresponding removals in `BrowserChrome.tsx`. In `App.tsx`, remove `setDefaultViewport` and the `onDefaultViewportChange` prop. Keep `setGlobalViewport` and pass it as the Apply-to-All handler.

- [ ] **Step 6: Replace the legacy blue palette with neutral tokens**

Set root tokens in `styles.css`:

```css
--focus: #c8c8ce;
--accent: #b7b7bd;
--accent-strong: #f1f1f2;
```

Delete `--accent-cyan`. Replace input selection with `rgba(255, 255, 255, 0.22)`. Replace every `rgba(125, 157, 238, 0.16)` focus halo with `rgba(255, 255, 255, 0.14)`, and replace the remaining blue selected/pressed fills with white at the same or lower opacity. Delete `.selected-tile-status`, `.viewport-popover`, `.viewport-select`, and `.global-viewport-trigger` rules that no longer have markup.

Give the resolution select enough width:

```css
.resolution-control select {
  max-width: 172px;
}
```

- [ ] **Step 7: Verify toolbar behavior, neutral focus, and types**

Run: `npx vitest run src/renderer/toolbarLayout.test.ts src/renderer/components/BrowserChrome.test.tsx src/renderer/App.test.tsx && npm run typecheck`

Expected: all focused tests PASS; no old blue token/value remains; one Resolution control and Apply to All remain.

- [ ] **Step 8: Commit the toolbar simplification**

```bash
git add src/renderer/styles.css src/renderer/toolbarLayout.test.ts src/shared/viewport.ts src/renderer/components/GridControls.tsx src/renderer/components/BrowserToolbar.tsx src/renderer/components/BrowserChrome.tsx src/renderer/components/BrowserChrome.test.tsx src/renderer/App.tsx
git commit -m "style: simplify neutral camera toolbar"
```

---

### Task 3: Consolidate session commands and forget credentials at the correct boundary

**Files:**
- Modify: `src/shared/passwordRecords.ts`
- Modify: `src/shared/passwordRecords.test.ts`
- Modify: `src/renderer/state/workspaceReducer.ts`
- Modify: `src/renderer/state/workspaceReducer.test.ts`
- Modify: `src/renderer/sessionReset.ts`
- Modify: `src/renderer/sessionReset.test.ts`
- Create: `src/renderer/components/CameraSessionMenu.tsx`
- Create: `src/renderer/components/CameraSessionMenu.test.tsx`
- Modify: `src/renderer/components/BrowserToolbar.tsx`
- Modify: `src/renderer/components/BrowserChrome.tsx`
- Modify: `src/renderer/components/WorkspaceSettings.tsx`
- Modify: `src/renderer/components/WorkspaceSettings.test.tsx`
- Modify: `src/renderer/components/CameraListEditor.test.tsx`
- Delete: `src/renderer/components/CookieCommands.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/App.test.tsx`
- Modify: `src/renderer/styles.css`

**Interfaces:**
- Produces: `forgetCameraCredential(records, scope): PasswordRecord[]`.
- Produces: `forgetCameraListCredentials(records, scope): PasswordRecord[]`.
- Produces reducer actions `forgetCameraCredential` and `forgetCameraListCredentials` with captured scope IDs.
- Adds `onSessionCleared(): void` to both reset input objects; callback runs after Electron cleanup and before reload.
- Produces: `CameraSessionMenuProps` with safe reload and destructive reset callbacks.

- [ ] **Step 1: Add failing scoped password-record tests**

Add fixtures containing a matching linked record, a legacy `cameraId: null` record at the same normalized origin, another linked camera sharing that origin, and another list. Then assert:

```ts
expect(
  forgetCameraCredential(recordsWithSharedOrigins, {
    jobId: "job-a",
    cameraListId: "list-a",
    cameraId: "camera-42",
    url: "http://192.168.1.42/rmt.html"
  }).map((record) => record.id)
).toEqual(["other-linked-camera", "other-list"]);

expect(
  forgetCameraListCredentials(recordsWithMultipleScopes, {
    jobId: "job-a",
    cameraListId: "list-a"
  }).map((record) => record.id)
).toEqual(["job-b-list-b"]);
```

- [ ] **Step 2: Implement pure scoped forgetting helpers**

Add to `src/shared/passwordRecords.ts`:

```ts
import { normalizeCredentialUrl } from "./credentials.js";

export interface CameraCredentialScope {
  jobId: string;
  cameraListId: string;
  cameraId: string | null;
  url: string;
}

export interface CameraListCredentialScope {
  jobId: string;
  cameraListId: string;
}

export function forgetCameraCredential(
  records: PasswordRecord[],
  scope: CameraCredentialScope
): PasswordRecord[] {
  const origin = normalizeCredentialUrl(scope.url);
  return records.filter((record) => {
    if (record.jobId !== scope.jobId || record.cameraListId !== scope.cameraListId) {
      return true;
    }
    const linkedMatch = !!scope.cameraId && record.cameraId === scope.cameraId;
    const legacyOriginMatch =
      record.cameraId === null && normalizeCredentialUrl(record.url) === origin;
    return !linkedMatch && !legacyOriginMatch;
  });
}

export function forgetCameraListCredentials(
  records: PasswordRecord[],
  scope: CameraListCredentialScope
): PasswordRecord[] {
  return records.filter(
    (record) => record.jobId !== scope.jobId || record.cameraListId !== scope.cameraListId
  );
}
```

- [ ] **Step 3: Add explicit captured-scope reducer actions and tests**

Add to `WorkspaceAction`:

```ts
| {
    type: "forgetCameraCredential";
    jobId: string;
    cameraListId: string;
    cameraId: string | null;
    url: string;
  }
| {
    type: "forgetCameraListCredentials";
    jobId: string;
    cameraListId: string;
  }
```

Handle them with:

```ts
case "forgetCameraCredential":
  return { ...state, passwordRecords: forgetCameraCredential(state.passwordRecords, action) };
case "forgetCameraListCredentials":
  return {
    ...state,
    passwordRecords: forgetCameraListCredentials(state.passwordRecords, action)
  };
```

Add reducer tests proving captured job/list IDs delete the original scope even when the active IDs point elsewhere.

- [ ] **Step 4: Add failing session-reset ordering tests**

Extend both reset input fixtures with `onSessionCleared: vi.fn()`. Assert exact selected order:

```ts
expect(calls).toEqual(["mark:tile-41", "runtime", "electron", "forget", "load"]);
```

Add tests proving cleanup rejection never calls `onSessionCleared` or `loadBase`, while a `loadBase` false result occurs after `onSessionCleared`. Add the equivalent list-partition ordering test.

- [ ] **Step 5: Call scoped forgetting after cleanup and before reload**

Extend reset inputs:

```ts
interface SelectedResetInput {
  tile: TileState;
  operationKey: string;
  onSessionCleared(): void;
}

interface ListResetInput {
  tiles: TileState[];
  partition: string;
  operationKey: string;
  onSessionCleared(): void;
}
```

In `resetSelectedCamera`, call `input.onSessionCleared()` immediately after `resetCameraData()` resolves. In `resetCameraList`, call it immediately after `resetListData()` resolves. Do not call it from catch paths.

- [ ] **Step 6: Add failing Camera Session menu tests**

Create `CameraSessionMenu.test.tsx` covering:

```tsx
fireEvent.click(screen.getByRole("button", { name: "Camera Session" }));
expect(screen.getAllByRole("menuitem").map((item) => item.textContent)).toEqual([
  "Reload selected",
  "Reload all",
  "Sign out, forget login & reload selected",
  "Sign out, forget active-list logins & reload all…"
]);
```

Click each item and assert its single callback. Add tests for Escape close, outside-pointer close, disabled selected items when no tile is selected, disabled all items while busy, and destructive item class `camera-session-danger`.

- [ ] **Step 7: Implement the accessible dropdown**

Create `CameraSessionMenu.tsx` with:

```ts
export interface CameraSessionMenuProps {
  canReloadSelected: boolean;
  canReloadAll: boolean;
  busy: boolean;
  onReloadSelected(): void;
  onReloadAll(): void;
  onSignOutSelected(): void;
  onRequestSignOutAll(): void;
}
```

Use a wrapper ref, `open` state, a `Camera Session` button with `aria-haspopup="menu"` and `aria-expanded`, and a `role="menu"` panel containing four `role="menuitem"` Button controls plus `role="separator"`. When open, register document `pointerdown` and `keydown`; close on outside pointer or Escape. Each item closes before invoking its callback. Disable selected actions when `canReloadSelected` is false, all-camera actions when `canReloadAll` is false, and every action while `busy` is true.

- [ ] **Step 8: Wire the menu into the main toolbar**

Remove the Reload and Reload All icon buttons from BrowserToolbar and render:

```tsx
<CameraSessionMenu
  canReloadSelected={!!selectedTile}
  canReloadAll={hasTiles}
  busy={sessionBusy}
  onReloadSelected={onReload}
  onReloadAll={onReloadAll}
  onSignOutSelected={onSignOutSelected}
  onRequestSignOutAll={onRequestSignOutAll}
/>
```

Add `hasTiles`, `sessionBusy`, `onSignOutSelected`, and `onRequestSignOutAll` through BrowserChrome. In App pass `workspace.tiles.length > 0`, `resetBusy`, `() => void resetSelectedCameraData()`, and `() => setConfirmListReset(true)`. Keep the shortcut effect calling non-destructive `runSelectedTileCommand(..., "reload")`.

- [ ] **Step 9: Dispatch captured credential scopes from reset completion**

In `resetSelectedCameraData`, capture and validate scope before awaiting:

```ts
const jobId = currentWorkspace.activeJobId;
const cameraListId = currentWorkspace.activeCameraListId;
if (!jobId || !cameraListId) {
  return;
}
```

Pass:

```ts
onSessionCleared: () => {
  const action = {
    type: "forgetCameraCredential",
    jobId,
    cameraListId,
    cameraId: tile.cameraId,
    url: tile.url
  } as const;
  workspaceRef.current = workspaceReducer(workspaceRef.current, action);
  dispatch(action);
}
```

For list reset, pass `forgetCameraListCredentials` with the captured `jobId` and `cameraListId`. Update confirmation copy to state that active-list saved logins are removed while presets and other lists remain.

- [ ] **Step 10: Remove duplicate Settings commands**

Delete CookieCommands and remove these WorkspaceSettings props and markup: `selectedTile`, `onReloadAll`, `onDeleteSelectedTilePassword`, `resetBusy`, `onResetSelectedCamera`, and `onRequestResetList`. Remove Reload Every Camera, Camera sign-in sessions, and Forget Selected Tile Password. Keep Reset Scale, Reset Order, credential presets, saved-password rows, and each row's Delete button. Update WorkspaceSettings, CameraListEditor, and App fixtures/types accordingly.

- [ ] **Step 11: Style the dropdown**

Add a positioned `.camera-session-menu`, fixed-width `.camera-session-panel`, stacked left-aligned menu buttons, separator, and coral-only `.camera-session-danger`. Ensure the panel z-index is above camera webviews and neutral focus tokens remain visible.

- [ ] **Step 12: Verify session semantics and main-page actions**

Run:

```bash
npx vitest run src/shared/passwordRecords.test.ts src/renderer/state/workspaceReducer.test.ts src/renderer/sessionReset.test.ts src/renderer/components/CameraSessionMenu.test.tsx src/renderer/components/BrowserChrome.test.tsx src/renderer/components/WorkspaceSettings.test.tsx src/renderer/components/CameraListEditor.test.tsx src/renderer/App.test.tsx
npm run typecheck
```

Expected: safe reload never invokes reset/deletion; selected cleanup deletes captured tile scope; list cleanup deletes captured active-list scope; cleanup failure retains credentials; reload failure after cleanup leaves credentials deleted.

- [ ] **Step 13: Commit session consolidation**

```bash
git add src/shared/passwordRecords.ts src/shared/passwordRecords.test.ts src/renderer/state/workspaceReducer.ts src/renderer/state/workspaceReducer.test.ts src/renderer/sessionReset.ts src/renderer/sessionReset.test.ts src/renderer/components/CameraSessionMenu.tsx src/renderer/components/CameraSessionMenu.test.tsx src/renderer/components/BrowserToolbar.tsx src/renderer/components/BrowserChrome.tsx src/renderer/components/WorkspaceSettings.tsx src/renderer/components/WorkspaceSettings.test.tsx src/renderer/components/CameraListEditor.test.tsx src/renderer/App.tsx src/renderer/App.test.tsx src/renderer/styles.css
git rm src/renderer/components/CookieCommands.tsx
git commit -m "feat: consolidate camera session controls"
```

---

### Task 4: Route auth prompts to the originating camera and add paired one-click sign-in

**Files:**
- Modify: `src/shared/httpAuth.ts`
- Modify: `src/electron/httpAuthCache.ts`
- Modify: `src/electron/httpAuthCache.test.ts`
- Modify: `src/electron/main.ts`
- Modify: `src/renderer/browserControls.ts`
- Modify: `src/renderer/browserControls.test.ts`
- Modify: `src/renderer/state/httpAuthQueue.ts`
- Modify: `src/renderer/state/httpAuthQueue.test.ts`
- Create: `src/renderer/state/httpAuthPresets.ts`
- Create: `src/renderer/state/httpAuthPresets.test.ts`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/App.test.tsx`
- Modify: `src/renderer/styles.css`

**Interfaces:**
- Adds `HttpAuthRequest.webContentsId?: number`.
- Produces `createHttpAuthRequest(requestId, challenge): HttpAuthRequest`.
- Produces `findTileIdForWebContentsId(webContentsId): string | null`.
- Adds `cameraType: string` to `HttpAuthPromptState`.
- Produces `buildHttpAuthPresetActions(presets, cameraType): HttpAuthPresetAction[]`.

- [ ] **Step 1: Add failing request-serialization and guest-routing tests**

In `httpAuthCache.test.ts`, assert `createHttpAuthRequest("request-1", challenge)` preserves `webContentsId: 12` and omits the field when absent.

In `browserControls.test.ts`, mount two `webview[data-tile-id]` elements and assign `getWebContentsId()` results. Assert:

```ts
expect(findTileIdForWebContentsId(42)).toBe("tile-b");
expect(findTileIdForWebContentsId(undefined)).toBeNull();
expect(findTileIdForWebContentsId(-1)).toBeNull();
expect(findTileIdForWebContentsId(999)).toBeNull();
```

Add a throwing first guest followed by a matching second guest and assert the later match is still returned.

- [ ] **Step 2: Preserve the guest ID in renderer auth requests**

Add to `HttpAuthRequest`:

```ts
webContentsId?: number;
```

In `httpAuthCache.ts`, export:

```ts
export function createHttpAuthRequest(
  requestId: string,
  challenge: HttpAuthChallenge
): HttpAuthRequest {
  return {
    requestId,
    url: challenge.url,
    host: challenge.host,
    port: challenge.port,
    ...(challenge.realm ? { realm: challenge.realm } : {}),
    ...(challenge.scheme ? { scheme: challenge.scheme } : {}),
    ...(challenge.isProxy !== undefined ? { isProxy: challenge.isProxy } : {}),
    ...(challenge.webContentsId ? { webContentsId: challenge.webContentsId } : {})
  };
}
```

Use this helper in `main.ts` inside `sendHttpAuthRequest()` instead of reconstructing the request manually. Preload and renderer window declarations already forward the typed object and need no runtime conversion.

- [ ] **Step 3: Implement defensive guest-to-tile lookup**

Add to `browserControls.ts`:

```ts
export function findTileIdForWebContentsId(
  webContentsId: number | undefined
): string | null {
  if (!Number.isSafeInteger(webContentsId) || (webContentsId ?? 0) <= 0) {
    return null;
  }

  const webviews = Array.from(
    document.querySelectorAll("webview[data-tile-id]")
  ) as Electron.WebviewTag[];
  for (const webview of webviews) {
    try {
      if (
        typeof webview.getWebContentsId === "function" &&
        webview.getWebContentsId() === webContentsId
      ) {
        return webview.getAttribute("data-tile-id");
      }
    } catch {
      // A guest can disappear while an auth challenge is being routed.
    }
  }
  return null;
}
```

Update `findTileForAuthRequest()` priority in App: guest-derived tile ID, normalized URL origin, selected tile, then null.

- [ ] **Step 4: Add failing paired-preset ordering and privacy tests**

Create `httpAuthPresets.test.ts` with presets deliberately out of order and mixed case. Assert exact camera-type matches are stable-partitioned first, only the first match has `recommended: true`, and no generated label includes any password.

- [ ] **Step 5: Implement paired preset actions**

Create `httpAuthPresets.ts`:

```ts
import type { CredentialPreset } from "../../shared/types";

export interface HttpAuthPresetAction {
  preset: CredentialPreset;
  recommended: boolean;
  label: string;
}

function normalize(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function buildHttpAuthPresetActions(
  presets: CredentialPreset[],
  cameraType: string | null | undefined
): HttpAuthPresetAction[] {
  const expectedType = normalize(cameraType);
  const matching = expectedType
    ? presets.filter((preset) => normalize(preset.cameraType) === expectedType)
    : [];
  const matchingIds = new Set(matching.map((preset) => preset.id));
  const ordered = [...matching, ...presets.filter((preset) => !matchingIds.has(preset.id))];

  return ordered.map((preset, index) => {
    const type = preset.cameraType.trim();
    const recommended = index === 0 && matchingIds.has(preset.id);
    return {
      preset,
      recommended,
      label: recommended
        ? `Use ${type} login & Sign In`
        : type
          ? `Use ${type} · ${preset.username} & Sign In`
          : `Use saved login · ${preset.username} & Sign In`
    };
  });
}
```

- [ ] **Step 6: Extend prompt state and queue fixtures**

Add `cameraType: string` to `HttpAuthPromptState`. Update every queue fixture with an explicit value. Existing enqueue, patch, shift, and removal behavior remains unchanged.

- [ ] **Step 7: Add failing App tests for source routing and one-click completion**

Add these App regressions:

1. Guest-ID priority: selected tile and request origin point at camera 41, but `webContentsId` maps to tile 42; assert camera 42's saved record is used.
2. Origin fallback: unmatched guest ID plus camera 42 origin routes to camera 42.
3. Selected fallback: unmatched ID plus unknown origin uses selected camera 41.
4. Paired preset: exact `VENICE 2` action appears first, raw password is absent from the suggestion region, and one click sends both fields exactly once.
5. Save checked persists the paired credential; Save unchecked does not.
6. Two queued prompts advance one at a time; a stale/double-click handler cannot answer the second request.

- [ ] **Step 8: Use saved records only for automatic record responses and manual defaults**

When queueing a prompt in App, set:

```ts
cameraType: camera?.cameraType ?? "",
username: record?.username ?? "",
password: record?.password ?? ""
```

Do not copy a global preset into the manual fields automatically. Presets are explicit paired actions.

- [ ] **Step 9: Centralize exactly-once prompt completion**

Add a callback that reads `httpAuthQueueRef.current[0]`, verifies the expected request ID, shifts both ref and state before sending, sends one response, and saves only when requested:

Import `HttpAuthResponse` alongside `HttpAuthRequest` in App before adding the callback.

```ts
const completeHttpAuthPrompt = useCallback(
  (
    expectedRequestId: string,
    response: HttpAuthResponse,
    saveCredential: boolean
  ): void => {
    const prompt = httpAuthQueueRef.current[0];
    if (!prompt || prompt.request.requestId !== expectedRequestId) {
      return;
    }

    const nextQueue = shiftHttpAuthPrompt(httpAuthQueueRef.current);
    httpAuthQueueRef.current = nextQueue;
    setHttpAuthQueue(nextQueue);
    window.ditbrowse?.sendHttpAuthResponse?.(expectedRequestId, response);

    if (
      saveCredential &&
      prompt.save &&
      prompt.tileId &&
      response.password
    ) {
      dispatch({
        type: "saveCapturedCredential",
        tileId: prompt.tileId,
        url: authUrlFromRequest(prompt.request),
        username: response.username?.trim() ?? "",
        password: response.password
      });
    }
  },
  []
);
```

Manual form calls this helper with current fields and `true`; Cancel calls it with `{}` and `false`.

- [ ] **Step 10: Replace exposed password suggestions with paired Sign In actions**

Build actions from `workspace.credentialPresets` and `httpAuthPrompt.cameraType`:

```ts
const presetActions = useMemo(
  () =>
    buildHttpAuthPresetActions(
      workspace.credentialPresets,
      httpAuthPrompt?.cameraType
    ),
  [httpAuthPrompt?.cameraType, workspace.credentialPresets]
);
```

Replace both username/password suggestion groups with:

```tsx
<div className="http-auth-preset-actions" aria-label="Saved credential suggestions">
  {presetActions.map((action) => (
    <Button
      key={action.preset.id}
      type="button"
      variant={action.recommended ? "primary" : "subtle"}
      className={action.recommended ? "http-auth-preset-recommended" : ""}
      onClick={() =>
        completeHttpAuthPrompt(
          httpAuthPrompt.request.requestId,
          {
            username: action.preset.username,
            password: action.preset.password
          },
          true
        )
      }
    >
      {action.label}
    </Button>
  ))}
</div>
```

Keep manual fields and the ordinary Sign In action. Style the recommended paired action full-width and alternatives left-aligned/wrapping without exposing passwords.

- [ ] **Step 11: Verify auth serialization, routing, ordering, queue safety, and types**

Run:

```bash
npx vitest run src/electron/httpAuthCache.test.ts src/renderer/browserControls.test.ts src/renderer/state/httpAuthQueue.test.ts src/renderer/state/httpAuthPresets.test.ts src/renderer/App.test.tsx
npm run typecheck
```

Expected: all focused auth tests PASS; guest ID wins routing; each preset click answers one request; suggestion text contains no password.

- [ ] **Step 12: Commit auth routing and paired sign-in**

```bash
git add src/shared/httpAuth.ts src/electron/httpAuthCache.ts src/electron/httpAuthCache.test.ts src/electron/main.ts src/renderer/browserControls.ts src/renderer/browserControls.test.ts src/renderer/state/httpAuthQueue.ts src/renderer/state/httpAuthQueue.test.ts src/renderer/state/httpAuthPresets.ts src/renderer/state/httpAuthPresets.test.ts src/renderer/App.tsx src/renderer/App.test.tsx src/renderer/styles.css
git commit -m "feat: route and pair camera sign in"
```

---

### Task 5: Cross-surface verification, non-notarized build, and Applications replacement

**Files:**
- Modify: `tests/e2e/workspace.spec.ts`
- Modify: `tests/electron/session-reset.spec.ts`
- Verify: all source and test files changed in Tasks 1-4
- Build output: `release/DITBrowse-darwin-arm64/DITBrowse.app`
- Install target: `/Applications/DITBrowse.app`
- Backup target: `/Users/lightlab/Documents/DITBrowse App Backups/DITBrowse-<timestamp>.app`

**Interfaces:**
- Consumes: `npm run package:mac:signed` with `DITBROWSE_NOTARIZE=0`.
- Produces: Developer ID–signed, non-notarized installed app with local API and Companion WebSocket online.

- [ ] **Step 1: Update browser and Electron operator-flow tests**

In `tests/e2e/workspace.spec.ts`, replace legacy viewport locators with `Selected camera resolution` and `Apply resolution to all cameras`. Add a main-toolbar test that opens Camera Session, sees all four actions in order, uses safe Reload selected, and confirms workspace Settings contains no sign-out, Reload Every Camera, or Forget Selected action.

Capture a toolbar screenshot at `2048x1040` using `testInfo.outputPath("neutral-camera-toolbar.png")` and assert no horizontal overflow.

In `tests/electron/session-reset.spec.ts`, open Camera Session on the main page, run `Sign out, forget login & reload selected`, and assert:

```ts
await expect(page.getByRole("status")).toContainText("Cleared camera data");
await page.getByRole("button", { name: "Camera List", exact: true }).click();
await expect(page.getByLabel("Camera workspace settings")).not.toContainText(targetCameraUrl);
```

Keep the camera reload/base-address assertions and close Settings after verifying the password disappeared.

- [ ] **Step 2: Run the complete verification suite**

Run:

```bash
npm run test:release-policy
npm test
npm run typecheck
npm run test:e2e
npm run test:electron
```

Expected: every command exits successfully.

- [ ] **Step 3: Commit cross-surface regression coverage**

```bash
git add tests/e2e/workspace.spec.ts tests/electron/session-reset.spec.ts
git commit -m "test: cover toolbar session workflow"
```

- [ ] **Step 4: Inspect generated UI screenshots**

Locate artifacts with:

```bash
rg --files test-results | rg 'neutral-camera-toolbar\.png|workspace-settings-compact\.png'
```

Inspect each exact file with the local image viewer. Confirm neutral focus/selection color, no stacked-squares title strip, one Resolution control, visible Apply to All, accessible Camera Session dropdown, and no toolbar overflow.

- [ ] **Step 5: Build and sign without notarizing**

Run: `DITBROWSE_NOTARIZE=0 npm run package:mac:signed`

Required output:

```text
Skipping notarization; set DITBROWSE_NOTARIZE=1 to opt in
Signed release is ready
```

The output must not contain `Submitting app for Apple notarization`.

- [ ] **Step 6: Verify signature and absence of notarization ticket**

Run:

```bash
codesign --verify --deep --strict --verbose=2 release/DITBrowse-darwin-arm64/DITBrowse.app
codesign -dv --verbose=4 release/DITBrowse-darwin-arm64/DITBrowse.app
xcrun stapler validate release/DITBrowse-darwin-arm64/DITBrowse.app
```

Expected: Developer ID Application identity and TeamIdentifier `8BWXULM784`; stapler reports that no ticket is stapled.

- [ ] **Step 7: Back up and replace `/Applications/DITBrowse.app`**

Stop all `/Contents/MacOS/DITBrowse` main processes using a bounded TERM loop with KILL fallback. Move the existing installed app to a timestamped path under `/Users/lightlab/Documents/DITBrowse App Backups`. Copy the verified candidate into `/Applications/DITBrowse.app` with `ditto`; restore the backup if copying fails. Verify the installed copy again with `codesign --verify --deep --strict`.

- [ ] **Step 8: Relaunch and verify app plus Companion**

Launch with `open -n /Applications/DITBrowse.app`. Wait up to 15 seconds for `http://127.0.0.1:7502/api/status`, then verify:

```text
HTTP status ok=true
12 camera tabs are present
WebSocket hello is ditbrowse.control@1
WebSocket status result ok=true
Companion owns an ESTABLISHED loopback socket to port 7502
Installed signature is Developer ID Application: Adam Lighterman (8BWXULM784)
```

- [ ] **Step 9: Confirm clean repository and record handoff data**

Run: `git status --short && git log -8 --oneline`

Expected: clean worktree. Record the timestamped backup path, tests, signature result, no-ticket result, local API result, and Companion connection in the final handoff.
