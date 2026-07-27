# Camera List Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the nested workspace popover with a one-click full Camera List workspace that prioritizes the editable table, places all settings below it, removes tab arrow buttons, and uses clear sign-out-and-reload labels.

**Architecture:** `BrowserChrome` becomes responsible only for browser navigation and opening the Camera List workspace. The existing tools content moves into a reusable `WorkspaceSettings` section rendered by `CameraListEditor`, which remains the owner of camera-list draft state and guards dirty list switches. Existing workspace reducer actions, Electron reset IPC, camera webviews, and persisted data remain unchanged.

**Tech Stack:** React 19, TypeScript, Lucide React, Vitest with Testing Library, Playwright, Electron, electron-packager/signing scripts.

## Global Constraints

- The Camera List workspace opens from the browser chrome in one click.
- The editable camera table appears before all workspace settings.
- The full workspace uses one scrolling surface with a sticky Save/Discard header.
- Left/right tab buttons are removed; drag reorder, close, and add remain.
- Camera-list draft edits still require Save Changes before they affect the grid.
- Dirty list switches require Save and Switch, Discard and Switch, or Cancel.
- Reset behavior and saved credentials remain unchanged.
- Visible session-action labels are **Sign Out & Reload Camera** and **Sign Out & Reload All**.
- No workspace persistence schema or Electron IPC changes.

---

### Task 1: Simplify Browser Chrome And Tabs

**Files:**
- Modify: `src/renderer/components/TabStrip.tsx`
- Modify: `src/renderer/components/BrowserChrome.tsx`
- Modify: `src/renderer/components/BrowserChrome.test.tsx`
- Modify: `src/renderer/App.tsx`

**Interfaces:**
- `TabStripProps` retains `onMoveTileToIndex(tileId: string, toIndex: number): void` and removes `onMoveTile(tileId, direction)`.
- `BrowserChromeProps` produces `onOpenCameraList(): void` and no longer consumes workspace-management/reset/API callbacks.

- [ ] **Step 1: Replace popover expectations with a failing direct-entry test**

```tsx
it("opens the full camera list workspace directly", () => {
  const onOpenCameraList = vi.fn();
  render(<BrowserChrome {...baseProps} onOpenCameraList={onOpenCameraList} />);

  fireEvent.click(screen.getByRole("button", { name: "Camera List" }));

  expect(onOpenCameraList).toHaveBeenCalledOnce();
  expect(screen.queryByLabelText("Camera workspace tools")).not.toBeInTheDocument();
});

it("uses drag reorder without directional tab buttons", () => {
  render(<BrowserChrome {...baseProps} />);
  expect(screen.queryByRole("button", { name: /Move .* left/ })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /Move .* right/ })).not.toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Close A" })).toBeVisible();
});
```

- [ ] **Step 2: Run the component test and verify it fails**

Run: `npm test -- src/renderer/components/BrowserChrome.test.tsx`

Expected: FAIL because `Camera List` and `onOpenCameraList` do not exist and directional controls are still rendered.

- [ ] **Step 3: Remove directional tab controls and replace the tools popover with direct entry**

```tsx
<Button
  className="camera-list-button"
  variant="ghost"
  size="compact"
  icon={<List size={15} strokeWidth={2.2} />}
  tooltip={{
    title: "Camera List",
    description: "Opens the editable camera table and workspace settings."
  }}
  onClick={onOpenCameraList}
>
  Camera List
</Button>
```

Delete `toolsOpen`, `BrowserToolsMenu`, both chevron buttons, and their callback props. In `App`, pass `onOpenCameraList={() => setEditorOpen(true)}`.

- [ ] **Step 4: Run the component test and typecheck**

Run: `npm test -- src/renderer/components/BrowserChrome.test.tsx && npm run typecheck`

Expected: BrowserChrome tests PASS and TypeScript reports no obsolete props or imports.

- [ ] **Step 5: Commit the chrome change**

```bash
git add src/renderer/components/TabStrip.tsx src/renderer/components/BrowserChrome.tsx src/renderer/components/BrowserChrome.test.tsx src/renderer/App.tsx
git commit -m "feat: open camera list directly"
```

---

### Task 2: Move Workspace Settings Under The Camera Table

**Files:**
- Create: `src/renderer/components/WorkspaceSettings.tsx`
- Create: `src/renderer/components/WorkspaceSettings.test.tsx`
- Modify: `src/renderer/components/CameraListEditor.tsx`
- Modify: `src/renderer/components/CameraListEditor.test.tsx`
- Delete: `src/renderer/components/BrowserToolsMenu.tsx`
- Modify: `src/renderer/App.tsx`

**Interfaces:**
- Export `WorkspaceSettingsProps` and `WorkspaceSettings(props): ReactElement`.
- `WorkspaceSettingsProps` preserves all existing job/list, credential, session, reset, and control API callbacks except `onEditList`.
- Private `CredentialPresetSection`, `SavedPasswordSection`, and `ControlApiSection` functions in the same file consume `WorkspaceSettingsProps`; they isolate the three form/list blocks without creating new public interfaces.
- `CameraListEditorProps` consumes those settings props and renders `WorkspaceSettings` after CSV import.

- [ ] **Step 1: Add failing settings-order and label tests**

```tsx
it("places workspace settings after the editable camera table", () => {
  renderEditor();
  const table = screen.getByRole("table");
  const settings = screen.getByLabelText("Camera workspace settings");
  expect(table.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

it("describes session actions by their outcome", () => {
  renderEditor();
  expect(screen.getByRole("button", { name: "Sign Out & Reload Camera" })).toBeVisible();
  expect(screen.getByRole("button", { name: "Sign Out & Reload All" })).toBeVisible();
  expect(screen.queryByText("Clear camera data")).not.toBeInTheDocument();
  expect(screen.queryByText("Clear list data")).not.toBeInTheDocument();
});
```

- [ ] **Step 2: Run the editor test and verify it fails**

Run: `npm test -- src/renderer/components/CameraListEditor.test.tsx`

Expected: FAIL because no settings section is rendered by the editor.

- [ ] **Step 3: Extract the old popover sections into `WorkspaceSettings`**

```tsx
export function WorkspaceSettings(props: WorkspaceSettingsProps): ReactElement {
  return (
    <section className="workspace-settings" aria-label="Camera workspace settings">
      <header className="workspace-settings-header">
        <h3>Workspace Settings</h3>
        <p>Jobs, camera sessions, passwords, and local control.</p>
      </header>
      <div className="workspace-settings-section">
        <JobListSelector
          jobs={props.jobs}
          cameraLists={props.cameraLists}
          activeCameraListId={props.activeCameraListId}
          activeList={props.activeList}
          onSelectCameraList={props.onSelectCameraList}
          onCreateJob={props.onCreateJob}
          onUpdateJobName={props.onUpdateJobName}
          onDeleteJob={props.onDeleteJob}
        />
      </div>
      <div className="workspace-settings-section workspace-command-grid">
        <Button onClick={props.onReloadAll}>Reload Every Camera</Button>
        <Button onClick={props.onResetSelectedScale}>Reset Scale</Button>
        <Button onClick={props.onResetGridOrder}>Reset Order</Button>
      </div>
      <CookieCommands
        canResetSelected={!!props.selectedTile}
        canResetList={!!props.activeList?.cameras.length}
        busy={props.resetBusy}
        onResetSelected={props.onResetSelectedCamera}
        onRequestResetList={props.onRequestResetList}
      />
      <CredentialPresetSection {...props} />
      <SavedPasswordSection {...props} />
      <ControlApiSection {...props} />
    </section>
  );
}
```

Move the existing controlled port and credential-preset form state without changing callback behavior. Remove the nested Edit List button. Render the component below the CSV import controls in `CameraListEditor`.

- [ ] **Step 4: Rename the two session actions without changing callbacks**

```tsx
<Button onClick={onResetSelected}>Sign Out & Reload Camera</Button>
<Button onClick={onRequestResetList}>Sign Out & Reload All</Button>
```

Keep tooltips explicit about clearing cookies, site data, current authentication, and connections before base-IP reload.

- [ ] **Step 5: Run settings/editor tests and typecheck**

Run: `npm test -- src/renderer/components/WorkspaceSettings.test.tsx src/renderer/components/CameraListEditor.test.tsx && npm run typecheck`

Expected: all settings and editor tests PASS.

- [ ] **Step 6: Commit the settings integration**

```bash
git add src/renderer/components/WorkspaceSettings.tsx src/renderer/components/WorkspaceSettings.test.tsx src/renderer/components/CameraListEditor.tsx src/renderer/components/CameraListEditor.test.tsx src/renderer/components/CookieCommands.tsx src/renderer/components/BrowserToolsMenu.tsx src/renderer/App.tsx
git commit -m "feat: place settings below camera table"
```

---

### Task 3: Protect Dirty Drafts During List Switching

**Files:**
- Modify: `src/renderer/components/CameraListEditor.tsx`
- Modify: `src/renderer/components/CameraListEditor.test.tsx`

**Interfaces:**
- `requestCameraListSwitch(cameraListId: string): void` delegates immediately when clean and records a pending ID when dirty.
- `completeCameraListSwitch(mode: "save" | "discard"): void` resolves the draft and invokes the existing `onSelectCameraList` callback.

- [ ] **Step 1: Add failing dirty-switch tests**

```tsx
it("requires a decision before switching away from a dirty list", () => {
  const onSelectCameraList = vi.fn();
  renderEditor({ onSelectCameraList });
  fireEvent.change(screen.getByLabelText("List Prefix"), {
    target: { value: "http://10.20.30." }
  });
  fireEvent.change(screen.getByLabelText("Camera list"), {
    target: { value: "list-secondary" }
  });

  expect(screen.getByRole("dialog", { name: "Save camera-list changes?" })).toBeVisible();
  expect(onSelectCameraList).not.toHaveBeenCalled();
});
```

Add separate assertions for Save and Switch, Discard and Switch, and Cancel.

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm test -- src/renderer/components/CameraListEditor.test.tsx`

Expected: FAIL because list selection currently calls through without draft protection.

- [ ] **Step 3: Implement pending list-switch state and dialog**

```tsx
const [pendingCameraListId, setPendingCameraListId] = useState<string | null>(null);

function requestCameraListSwitch(cameraListId: string): void {
  if (!dirty) {
    onSelectCameraList(cameraListId);
    return;
  }
  setPendingCameraListId(cameraListId);
}
```

The dialog actions save the current `draftList` before switching, discard and switch, or clear the pending ID without switching.

- [ ] **Step 4: Run editor tests**

Run: `npm test -- src/renderer/components/CameraListEditor.test.tsx`

Expected: all editor and dirty-switch paths PASS.

- [ ] **Step 5: Commit draft protection**

```bash
git add src/renderer/components/CameraListEditor.tsx src/renderer/components/CameraListEditor.test.tsx
git commit -m "fix: protect camera list drafts when switching"
```

---

### Task 4: Restyle The Full Workspace And Update End-To-End Coverage

**Files:**
- Modify: `src/renderer/styles.css`
- Modify: `tests/e2e/workspace.spec.ts`

**Interfaces:**
- `.camera-list-button` fits at supported desktop widths.
- `.workspace-settings` is a full-width section after table/import content.
- `.workspace-settings-grid` organizes settings without nested cards or horizontal page overflow.

- [ ] **Step 1: Update the end-to-end test for one-click entry**

```ts
await page.getByRole("button", { name: "Camera List" }).click();
await expect(page.getByLabel("Camera list editor")).toBeVisible();
await expect(page.getByRole("table")).toBeVisible();
await expect(page.getByLabel("Camera workspace settings")).toBeVisible();
await expect(page.getByRole("button", { name: /Move .* left/ })).toHaveCount(0);
await expect(page.getByRole("button", { name: /Move .* right/ })).toHaveCount(0);
```

- [ ] **Step 2: Run end-to-end coverage and verify the old expectations fail**

Run: `npm run test:e2e`

Expected: FAIL until old Workspace tools/Edit List selectors and popover styling are removed.

- [ ] **Step 3: Replace popover CSS with full workspace settings layout**

Implement a sticky 52px editor header, `width: 100%` table wrapper, unframed section bands separated by `1px solid var(--line-soft)`, and `grid-template-columns: repeat(auto-fit, minmax(min(320px, 100%), 1fr))` for settings groups. Collapse command grids to one column below 900px. Remove `.browser-tools-popover` and `.workspace-tools-button` rules. Keep page `scrollWidth` equal to viewport width at 960, 1180, and 1440 pixels.

- [ ] **Step 4: Run all automated checks**

Run: `npm run typecheck && npm test && npm run test:e2e && npm run build && npm run test:electron`

Expected: typecheck PASS, all unit tests PASS, six or more browser tests PASS, build PASS, and Electron reset integration PASS.

- [ ] **Step 5: Perform screenshot QA**

Run the app at 960x800, 1180x800, and 1440x900. Verify the Camera List button remains visible, the table scrolls internally rather than clipping the page, settings follow the table, and Save/Discard remain sticky.

- [ ] **Step 6: Commit the responsive workspace**

```bash
git add src/renderer/styles.css tests/e2e/workspace.spec.ts
git commit -m "style: finish full camera list workspace"
```

---

### Task 5: Package, Install, And Publish

**Files:**
- Update generated release artifacts under ignored `release/`
- Install: `/Applications/DITBrowse.app`

**Interfaces:**
- The installed app must pass `codesign`, Gatekeeper, and stapler validation.
- GitHub `main` and `codex/browser-shell-redesign` must reference the verified commit.

- [ ] **Step 1: Build the signed and notarized app**

Run: `APPLE_NOTARIZE_KEYCHAIN_PROFILE="DITBrowse-notary" npm run package:mac:signed`

Expected: signing succeeds and Apple notarization returns Accepted.

- [ ] **Step 2: Create and notarize the installer artifacts**

The signed packaging script creates the arm64 ZIP. Build the DMG from a staging folder containing the app and an Applications symlink, then sign, notarize, and staple it:

```bash
rm -rf /tmp/ditbrowse-dmg && mkdir -p /tmp/ditbrowse-dmg
ditto release/DITBrowse-darwin-arm64/DITBrowse.app /tmp/ditbrowse-dmg/DITBrowse.app
ln -s /Applications /tmp/ditbrowse-dmg/Applications
rm -f release/DITBrowse-darwin-arm64/DITBrowse-mac-arm64.dmg
hdiutil create -volname DITBrowse -srcfolder /tmp/ditbrowse-dmg -ov -format UDZO release/DITBrowse-darwin-arm64/DITBrowse-mac-arm64.dmg
codesign --force --sign "Developer ID Application: Adam Lighterman (8BWXULM784)" release/DITBrowse-darwin-arm64/DITBrowse-mac-arm64.dmg
xcrun notarytool submit release/DITBrowse-darwin-arm64/DITBrowse-mac-arm64.dmg --keychain-profile DITBrowse-notary --wait
xcrun stapler staple release/DITBrowse-darwin-arm64/DITBrowse-mac-arm64.dmg
```

- [ ] **Step 3: Verify artifacts**

Run:

```bash
codesign --verify --deep --strict release/DITBrowse-darwin-arm64/DITBrowse.app
spctl --assess --type execute --verbose=4 release/DITBrowse-darwin-arm64/DITBrowse.app
xcrun stapler validate release/DITBrowse-darwin-arm64/DITBrowse.app
xcrun stapler validate release/DITBrowse-darwin-arm64/DITBrowse-mac-arm64.dmg
```

Expected: valid on disk, accepted as Notarized Developer ID, and both staple validations succeed.

- [ ] **Step 4: Replace and launch the installed app**

Atomically replace `/Applications/DITBrowse.app`, verify it again, launch it, and confirm the main, GPU, network, and renderer processes remain healthy.

- [ ] **Step 5: Push the verified commit**

```bash
git push origin codex/browser-shell-redesign
git push origin HEAD:main
```

Expected: both remote references point to the same verified commit.
