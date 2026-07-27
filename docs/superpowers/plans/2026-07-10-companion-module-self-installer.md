# Companion Module Self-Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an offline, version-aware Settings action that installs or updates the bundled DIT Browse module in Companion's configured developer-module directory.

**Architecture:** A focused Electron main-process service reads Companion's local configuration, validates module identity/version, and atomically installs a signed payload. The renderer sees only structured status/results through context-isolated IPC, while a build-time script stages the lean Companion payload as a macOS extra resource.

**Tech Stack:** Electron 42, React 19, TypeScript, Node `fs/promises`, Vitest, Testing Library, Electron Packager, Bitfocus Companion module build tools.

## Global Constraints

- The feature manages module files only; it must not create or enable Companion connection instances or edit Companion databases.
- Install only into the absolute `dev_modules_path` read from Companion's macOS `config.json` when `enable_developer` is `true`.
- Use the constant target folder `lightlab-ditbrowse`; renderer input must never select filesystem paths.
- Install missing copies, update older copies, and leave equal or newer copies untouched.
- Never overwrite a target whose manifest identity or version metadata is malformed or foreign.
- Stage and validate before replacement; restore an existing installation when replacement fails after its backup rename.
- Package the module payload for offline use and include `node_modules/@companion-module/base/package.json`.
- Do not add tokens, credentials, LAN control, remote deployment, runtime dependency installation, or network access.
- Keep the existing Companion control API on `127.0.0.1` and default port `52780` unchanged.

---

## File Structure

- Create `src/shared/companionModule.ts`: renderer/main IPC status and result contracts plus the fixed module ID.
- Create `src/electron/companionModuleInstaller.ts`: configuration discovery, metadata validation, semantic-version comparison, state assessment, and atomic installation.
- Create `src/electron/companionModuleInstaller.test.ts`: temporary-directory coverage for every state and update recovery.
- Modify `src/electron/main.ts`: construct the installer and register two IPC handlers.
- Modify `src/electron/preload.cts`: expose the two scoped promise methods.
- Modify `src/renderer/state/workspaceStorage.ts`: declare the preload API types.
- Modify `src/renderer/App.tsx`: load status when Settings opens, run installation, and pass state/actions to Settings.
- Modify `src/renderer/App.test.tsx`: verify renderer orchestration through the preload mock.
- Modify `src/renderer/components/WorkspaceSettings.tsx`: render module status, action, busy state, and guidance.
- Modify `src/renderer/components/WorkspaceSettings.test.tsx`: cover missing, outdated, current, newer, invalid, and failure UI.
- Modify `src/renderer/components/CameraListEditor.test.tsx`: provide the expanded Settings fixture contract.
- Modify `src/renderer/styles.css`: style the compact Companion module row and messages.
- Create `scripts/stage-companion-module.mjs`: validate and stage the official module build output as a lean payload.
- Create `src/electron/companionModulePayload.test.ts`: execute the staging script against temporary fixtures and inspect output.
- Modify `package.json`: add staging/package scripts, extra-resource packaging, and raw-source exclusions.
- Modify `src/packageConfig.test.ts`: lock down the staging order, extra resource, and ignore rules.
- Modify `.gitignore`: ignore the generated `resources/companion-module/` payload.

---

### Task 1: Shared Contract and Atomic Installer

**Files:**
- Create: `src/shared/companionModule.ts`
- Create: `src/electron/companionModuleInstaller.ts`
- Create: `src/electron/companionModuleInstaller.test.ts`

**Interfaces:**
- Produces: `COMPANION_MODULE_ID`, `CompanionModuleInstallState`, `CompanionModuleInstallStatus`, and `CompanionModuleInstallResult`.
- Produces: `createCompanionModuleInstaller(options): { getStatus(); install(); }`.
- Consumes: an explicit Companion config path and bundled payload path supplied by `main.ts`.

- [ ] **Step 1: Write failing installer tests**

Create temporary config, payload, and developer directories with helpers that write this valid metadata:

```ts
const manifest = {
  id: "lightlab-ditbrowse",
  version,
  runtime: { apiVersion: "2.0.4", entrypoint: "../main.js" }
};
const packageManifest = { name: "DIT Browse", version };
const baseManifest = { name: "@companion-module/base", version: "2.0.4" };
```

Cover missing, outdated, current, newer, disabled config, relative path, foreign manifest, malformed version, invalid payload, successful update cleanup, and injected final-rename failure with restoration.

- [ ] **Step 2: Run the focused test and verify failure**

Run: `npm test -- src/electron/companionModuleInstaller.test.ts`

Expected: FAIL because the shared contract and installer module do not exist.

- [ ] **Step 3: Add the shared IPC contract**

Create these exact public shapes:

```ts
export const COMPANION_MODULE_ID = "lightlab-ditbrowse";

export type CompanionModuleInstallState =
  | "not_configured"
  | "missing"
  | "outdated"
  | "current"
  | "newer"
  | "invalid"
  | "error";

export interface CompanionModuleInstallStatus {
  state: CompanionModuleInstallState;
  bundledVersion: string | null;
  installedVersion: string | null;
  targetPath: string | null;
  message: string;
  canInstall: boolean;
}

export interface CompanionModuleInstallResult {
  outcome: "installed" | "updated" | "unchanged";
  status: CompanionModuleInstallStatus;
}
```

- [ ] **Step 4: Implement metadata validation and semantic-version comparison**

In `companionModuleInstaller.ts`, parse `major.minor.patch[-prerelease]`, reject invalid versions, compare numeric core identifiers first, then compare prerelease identifiers using SemVer precedence. Validate all required payload files, manifest ID, matching payload package/manifest versions, runtime entrypoint `../main.js`, and matching Companion base/API versions.

Use these service interfaces:

```ts
export interface CompanionModuleInstallerOptions {
  configPath: string;
  bundledModulePath: string;
  rename?: typeof fs.rename;
}

export interface CompanionModuleInstaller {
  getStatus(): Promise<CompanionModuleInstallStatus>;
  install(): Promise<CompanionModuleInstallResult>;
}

export function createCompanionModuleInstaller(
  options: CompanionModuleInstallerOptions
): CompanionModuleInstaller;
```

- [ ] **Step 5: Implement status assessment and atomic writes**

Read `enable_developer` and an absolute `dev_modules_path`; append only `COMPANION_MODULE_ID`. Return `not_configured`, `missing`, `outdated`, `current`, `newer`, `invalid`, or `error` with concise messages.

For writes, use sibling names based on `randomUUID()`:

```ts
const stagingPath = path.join(parent, `.${COMPANION_MODULE_ID}.install-${randomUUID()}`);
const backupPath = path.join(parent, `.${COMPANION_MODULE_ID}.backup-${randomUUID()}`);
```

Copy with `fs.cp(..., { recursive: true, dereference: false, errorOnExist: true })`, validate staging, rename an existing target to backup, rename staging to target, restore backup if the final rename fails, and remove temporary paths with `fs.rm(..., { recursive: true, force: true })` without traversing links from the existing installation.

- [ ] **Step 6: Run focused tests and commit**

Run: `npm test -- src/electron/companionModuleInstaller.test.ts`

Expected: PASS for every install state and rollback case.

Commit:

```bash
git add src/shared/companionModule.ts src/electron/companionModuleInstaller.ts src/electron/companionModuleInstaller.test.ts
git commit -m "feat: add atomic Companion module installer"
```

---

### Task 2: Electron IPC and Renderer Orchestration

**Files:**
- Modify: `src/electron/main.ts:1-380`
- Modify: `src/electron/preload.cts:1-80`
- Modify: `src/renderer/state/workspaceStorage.ts:1-45`
- Modify: `src/renderer/App.tsx:1-180,330-350,815-850`
- Modify: `src/renderer/App.test.tsx:1-90`

**Interfaces:**
- Consumes: `createCompanionModuleInstaller()` and shared status/result types from Task 1.
- Produces preload methods `getCompanionModuleInstallStatus()` and `installCompanionModule()`.
- Produces Settings props containing status, busy/error state, refresh action, and install action.

- [ ] **Step 1: Write failing App orchestration test**

Extend the `window.ditbrowse` mock with:

```ts
getCompanionModuleInstallStatus: vi.fn(async () => ({
  state: "missing",
  bundledVersion: "0.1.0",
  installedVersion: null,
  targetPath: "/tmp/Devmodules/lightlab-ditbrowse",
  message: "DIT Browse Companion module is not installed.",
  canInstall: true
})),
installCompanionModule: vi.fn(async () => ({
  outcome: "installed",
  status: {
    state: "current",
    bundledVersion: "0.1.0",
    installedVersion: "0.1.0",
    targetPath: "/tmp/Devmodules/lightlab-ditbrowse",
    message: "DIT Browse Companion module 0.1.0 is installed.",
    canInstall: false
  }
}))
```

Open Settings, verify status was requested, click the install action, and verify the install bridge was invoked once and current status is rendered.

- [ ] **Step 2: Run the App test and verify failure**

Run: `npm test -- src/renderer/App.test.tsx`

Expected: FAIL because no installer bridge or Settings props exist.

- [ ] **Step 3: Register the main-process installer and IPC handlers**

In `createWindow()`, construct the installer with:

```ts
const companionInstaller = createCompanionModuleInstaller({
  configPath: path.join(
    app.getPath("home"),
    "Library",
    "Application Support",
    "companion",
    "config.json"
  ),
  bundledModulePath: app.isPackaged
    ? path.join(process.resourcesPath, "companion-module", COMPANION_MODULE_ID)
    : path.join(
        app.getAppPath(),
        "companion-module-lightlab-ditbrowse",
        "pkg",
        COMPANION_MODULE_ID
      )
});
```

Register `companion-module:status` and `companion-module:install` handlers. Catch unexpected errors, log them in the main process, and let the IPC promise reject with a concise message.

- [ ] **Step 4: Expose and type the scoped preload methods**

Add:

```ts
getCompanionModuleInstallStatus: () =>
  ipcRenderer.invoke("companion-module:status") as Promise<CompanionModuleInstallStatus>,
installCompanionModule: () =>
  ipcRenderer.invoke("companion-module:install") as Promise<CompanionModuleInstallResult>,
```

Mirror these optional signatures in the global `Window.ditbrowse` declaration.

- [ ] **Step 5: Add App state and callbacks**

Add `companionModuleStatus`, `companionModuleBusy`, and `companionModuleError`. When `editorOpen` becomes true, call a memoized refresh callback. The install callback clears errors, sets busy, awaits the preload method, stores `result.status`, catches a concise error message, and clears busy in `finally`.

Pass these exact props through `workspaceSettings`:

```ts
companionModuleStatus,
companionModuleBusy,
companionModuleError,
onRefreshCompanionModuleStatus: refreshCompanionModuleStatus,
onInstallCompanionModule: installCompanionModule
```

- [ ] **Step 6: Run focused tests and commit**

Run: `npm test -- src/renderer/App.test.tsx src/electron/companionModuleInstaller.test.ts`

Expected: PASS.

Commit:

```bash
git add src/electron/main.ts src/electron/preload.cts src/renderer/state/workspaceStorage.ts src/renderer/App.tsx src/renderer/App.test.tsx
git commit -m "feat: expose Companion installer to settings"
```

---

### Task 3: Settings Status and Install Action

**Files:**
- Modify: `src/renderer/components/WorkspaceSettings.tsx:1-340`
- Modify: `src/renderer/components/WorkspaceSettings.test.tsx:1-220`
- Modify: `src/renderer/components/CameraListEditor.test.tsx:10-55`
- Modify: `src/renderer/styles.css:1545-1620`

**Interfaces:**
- Consumes: the five installer props passed by App in Task 2.
- Produces: accessible state text and one context-sensitive action in the existing Local API section.

- [ ] **Step 1: Write failing Settings state tests**

Extend `createProps()` with the five installer props. Add table-driven assertions for button labels and disabled state:

```ts
[
  ["missing", "Install Companion Module", false],
  ["outdated", "Update Companion Module", false],
  ["current", "Installed", true],
  ["newer", "Newer Version Installed", true],
  ["invalid", "Install Unavailable", true],
  ["not_configured", "Install Unavailable", true]
]
```

Add an async test that clicks Install, verifies one callback invocation, and verifies the button is disabled when `companionModuleBusy` is true. Add a failure-message assertion.

- [ ] **Step 2: Run focused Settings tests and verify failure**

Run: `npm test -- src/renderer/components/WorkspaceSettings.test.tsx src/renderer/components/CameraListEditor.test.tsx`

Expected: FAIL because the props and UI do not exist.

- [ ] **Step 3: Implement the Companion module row**

Import `Download` from `lucide-react` and shared status types. Add the five props to `WorkspaceSettingsProps`. Render the row below the WebSocket/port controls with:

- A `Companion module` label.
- Bundled and installed version text when present.
- The status message or `Checking Companion module…`.
- A context-sensitive button whose label follows the test table.
- A `Check Again` ghost action that invokes the refresh callback.
- Reload guidance after a `current` result.
- `role="alert"` for operation errors and `aria-live="polite"` for status.

- [ ] **Step 4: Add compact styling**

Add `.companion-module-status`, `.companion-module-copy`, `.companion-module-meta`, `.companion-module-actions`, and error/success color rules. Reuse existing Button variants and CSS variables; do not introduce a modal or new design system primitives.

- [ ] **Step 5: Update fixtures, run tests, and commit**

Run:

```bash
npm test -- src/renderer/components/WorkspaceSettings.test.tsx src/renderer/components/CameraListEditor.test.tsx src/renderer/App.test.tsx
```

Expected: PASS.

Commit:

```bash
git add src/renderer/components/WorkspaceSettings.tsx src/renderer/components/WorkspaceSettings.test.tsx src/renderer/components/CameraListEditor.test.tsx src/renderer/styles.css
git commit -m "feat: add Companion module installer controls"
```

---

### Task 4: Offline Payload Staging and macOS Packaging

**Files:**
- Create: `scripts/stage-companion-module.mjs`
- Create: `src/electron/companionModulePayload.test.ts`
- Modify: `package.json:6-18`
- Modify: `src/packageConfig.test.ts:1-40`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: `companion-module-lightlab-ditbrowse/pkg/lightlab-ditbrowse` from `companion-module-build` and the module's installed base package metadata.
- Produces: `resources/companion-module/lightlab-ditbrowse` with the exact runtime layout from the design.
- Produces: a packaged resource at `Contents/Resources/companion-module/lightlab-ditbrowse`.

- [ ] **Step 1: Write failing staging and package configuration tests**

Run the staging script through `execFile(process.execPath, [script, "--source", source, "--base-package", basePackage, "--output", output])` against temporary fixtures. Assert that the output includes only:

```text
main.js
package.json
companion/HELP.md
companion/manifest.json
node_modules/@companion-module/base/package.json
```

Assert that mismatched package/manifest versions and mismatched API/base versions fail without leaving an output directory.

Extend `packageConfig.test.ts` to require a staging script before `electron-packager`, `--extra-resource=resources/companion-module`, and ignore matches for `/companion-module-lightlab-ditbrowse` and `/resources/companion-module`.

- [ ] **Step 2: Run tests and verify failure**

Run: `npm test -- src/electron/companionModulePayload.test.ts src/packageConfig.test.ts`

Expected: FAIL because the staging script and package configuration do not exist.

- [ ] **Step 3: Implement the staging script**

Parse the three explicit CLI path options. Read and validate the source `package.json`, built `companion/manifest.json`, and base package. Require:

```js
manifest.id === "lightlab-ditbrowse"
manifest.version === packageManifest.version
manifest.runtime.entrypoint === "../main.js"
manifest.runtime.apiVersion === baseManifest.version
baseManifest.name === "@companion-module/base"
```

Create a temporary output sibling, copy the five required files, validate the staged result, remove the prior output, and atomically rename the temporary directory to the requested output.

- [ ] **Step 4: Wire macOS packaging**

Add:

```json
"stage:companion-module": "corepack yarn --cwd companion-module-lightlab-ditbrowse package && node scripts/stage-companion-module.mjs --source companion-module-lightlab-ditbrowse/pkg/lightlab-ditbrowse --base-package companion-module-lightlab-ditbrowse/node_modules/@companion-module/base/package.json --output resources/companion-module/lightlab-ditbrowse"
```

Run `npm run stage:companion-module` before `electron-packager`. Add `--extra-resource=resources/companion-module`, exclude the raw module source and generated payload from `app.asar`, and add `resources/companion-module/` to `.gitignore`.

- [ ] **Step 5: Run staging, inspect the real payload, and commit**

Run:

```bash
npm test -- src/electron/companionModulePayload.test.ts src/packageConfig.test.ts
npm run stage:companion-module
find resources/companion-module/lightlab-ditbrowse -type f | sort
```

Expected: tests PASS and the file list exactly matches the five required files.

Commit:

```bash
git add scripts/stage-companion-module.mjs src/electron/companionModulePayload.test.ts package.json src/packageConfig.test.ts .gitignore
git commit -m "build: bundle offline Companion module payload"
```

---

### Task 5: Full Verification and Local Companion Check

**Files:**
- Modify only if verification exposes a defect in files already listed above.

**Interfaces:**
- Consumes: the completed installer, renderer controls, and staged payload.
- Produces: a tested macOS app and a verified local Companion module status.

- [ ] **Step 1: Run all DIT Browse checks**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all tests pass and both TypeScript projects build without errors.

- [ ] **Step 2: Run all Companion module checks**

Run from `companion-module-lightlab-ditbrowse`:

```bash
corepack yarn test
corepack yarn lint
corepack yarn typecheck
corepack yarn companion-module-check
corepack yarn package
```

Expected: every command exits successfully and regenerates the module package.

- [ ] **Step 3: Build and inspect the macOS package**

Run:

```bash
npm run package:mac
find release/DITBrowse-darwin-arm64/DITBrowse.app/Contents/Resources/companion-module/lightlab-ditbrowse -type f | sort
```

Expected: the app packages successfully and contains the five-file lean payload outside `app.asar`.

- [ ] **Step 4: Verify actual Companion configuration status without mutation**

Run the installer status logic against the current Companion config and packaged payload. Expect `current` or `newer` for the already-installed local module, with target `/Users/lightlab/Documents/Companion/Devmodules/lightlab-ditbrowse`. Confirm the active Companion module process remains running.

- [ ] **Step 5: Review diff and finish**

Run:

```bash
git status --short
git diff --check
git log --oneline -8
```

Expected: only intentional generated-ignored artifacts remain untracked, no whitespace errors, and all task commits are present.
