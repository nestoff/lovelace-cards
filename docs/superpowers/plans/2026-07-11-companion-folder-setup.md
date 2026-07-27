# Companion Developer-Module Folder Setup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Add an explicit, instructional Companion setup dialog that lets a user choose and remember a nonstandard developer-module folder, then installs through the existing safe module installer only after the user requests it.

**Architecture:** Store an optional DITBrowse-owned fallback path under Electron `userData`, resolve a valid Companion configuration before that fallback, and expose one injected/testable native-directory-picker operation through IPC. Keep the setup modal in the renderer and reuse the current transactional staging, backup, rollback, semantic-version, and validation logic for the actual install.

**Tech Stack:** TypeScript, React, Electron IPC and `dialog.showOpenDialog`, Node filesystem promises, Vitest, Testing Library, Playwright, Electron Packager, Apple Developer ID signing and notarization.

## Global Constraints

- No module installation, folder picker, or popup may run on app launch or a status check.
- The setup modal opens only after **Set Up Companion** or **Change Folder** is clicked.
- Use Companion's exact current labels: **Advanced Settings**, **Developer**, **Enable Developer Modules**, and **Developer Modules Path**.
- **Cancel** changes nothing.
- Canceling the native folder picker leaves the setup modal open and changes nothing.
- DITBrowse must never edit Companion's configuration or toggle its developer setting.
- A valid Companion configuration takes precedence over the DITBrowse fallback path.
- The fallback must be an absolute directory selected through the native picker.
- Installation must continue to use the current transactional installer and rollback behavior.
- Preserve the current Companion module at version `1.0.0`; bump the DITBrowse app to `1.0.1` for the new installer UI.
- Replace `/Applications/DITBrowse.app` with the signed/notarized v1.0.1 build after verification, preserving the live workspace.

---

### Task 1: Persist and resolve a manual developer-module path

**Files:**
- Create: `src/electron/companionModuleConfig.ts`
- Create: `src/electron/companionModuleConfig.test.ts`
- Modify: `src/shared/companionModule.ts`
- Modify: `src/electron/companionModuleInstaller.ts`
- Modify: `src/electron/companionModuleInstaller.test.ts`

**Interfaces:**
- Consumes: Companion's standard `config.json` and a DITBrowse `userData` directory.
- Produces: `companionModuleConfigPath(userDataPath): string`, `loadCompanionModuleConfig(userDataPath): Promise<CompanionModuleConfig>`, `saveCompanionModuleConfig(userDataPath, config): Promise<void>`, installer method `setManualDeveloperModulesPath(path): Promise<void>`, and status field `pathSource: "companion" | "manual" | null`.

- [x] **Step 1: Add failing manual-config tests**

Create `src/electron/companionModuleConfig.test.ts` with tests that assert:

```ts
expect(await loadCompanionModuleConfig(userDataPath)).toEqual({
  developerModulesPath: null
});

await saveCompanionModuleConfig(userDataPath, {
  developerModulesPath: "/Users/operator/Companion Modules"
});
expect(await loadCompanionModuleConfig(userDataPath)).toEqual({
  developerModulesPath: "/Users/operator/Companion Modules"
});

await expect(
  saveCompanionModuleConfig(userDataPath, {
    developerModulesPath: "relative/modules"
  })
).rejects.toThrow(/absolute/i);
```

Also assert malformed JSON and non-string paths load as `{ developerModulesPath: null }` without throwing.

- [x] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
npx vitest run src/electron/companionModuleConfig.test.ts
```

Expected: FAIL because the config module does not exist.

- [x] **Step 3: Implement the DITBrowse-owned config file**

Create `src/electron/companionModuleConfig.ts` with:

```ts
export interface CompanionModuleConfig {
  developerModulesPath: string | null;
}

export function companionModuleConfigPath(userDataPath: string): string {
  return path.join(userDataPath, "companion-module.json");
}

export async function loadCompanionModuleConfig(
  userDataPath: string
): Promise<CompanionModuleConfig>;

export async function saveCompanionModuleConfig(
  userDataPath: string,
  config: CompanionModuleConfig
): Promise<void>;
```

`load` returns the null default for `ENOENT`, malformed JSON, arrays, non-string values, empty strings, and relative paths. `save` accepts only `null` or an absolute path, creates `userDataPath`, and writes formatted JSON with a trailing newline.

- [x] **Step 4: Extend shared status and installer resolution**

Add to `CompanionModuleInstallStatus`:

```ts
pathSource: "companion" | "manual" | null;
```

Extend `CompanionModuleInstallerOptions` with `manualConfigPath: string`, and extend `CompanionModuleInstaller` with:

```ts
setManualDeveloperModulesPath(developerModulesPath: string): Promise<void>;
```

Resolve the target root in this order:

```ts
const companionRoot = await readValidCompanionDeveloperModulesPath(configPath);
if (companionRoot) return { root: companionRoot, source: "companion" };

const manualRoot = await readValidManualDeveloperModulesPath(manualConfigPath);
if (manualRoot) return { root: manualRoot, source: "manual" };

return { root: null, source: null };
```

Every status result includes `pathSource`. `setManualDeveloperModulesPath` rejects non-absolute paths and writes only `{ "developerModulesPath": "<absolute path>" }` to `manualConfigPath`.

- [x] **Step 5: Test precedence, fallback, and no side effects**

Extend `src/electron/companionModuleInstaller.test.ts` to prove:

- missing standard config plus saved manual path returns `state: "missing"`, `pathSource: "manual"`, and the manual target;
- a valid standard config overrides a different saved manual path and returns `pathSource: "companion"`;
- a status check creates neither the manual root nor the module folder;
- `setManualDeveloperModulesPath("relative")` rejects;
- installing after a manual path is saved uses the same staging and final validation behavior;
- rollback still restores an outdated module when the final rename fails.

- [x] **Step 6: Run focused tests and commit**

Run:

```bash
npx vitest run src/electron/companionModuleConfig.test.ts src/electron/companionModuleInstaller.test.ts
npm run typecheck
git add src/electron/companionModuleConfig.ts src/electron/companionModuleConfig.test.ts src/shared/companionModule.ts src/electron/companionModuleInstaller.ts src/electron/companionModuleInstaller.test.ts
git commit -m "feat: remember companion developer module folder"
```

---

### Task 2: Add a native choose-and-install IPC operation

**Files:**
- Create: `src/electron/companionModuleSetup.ts`
- Create: `src/electron/companionModuleSetup.test.ts`
- Modify: `src/electron/main.ts`
- Modify: `src/electron/preload.cts`
- Modify: `src/renderer/state/workspaceStorage.ts`
- Modify: `src/shared/companionModule.ts`

**Interfaces:**
- Consumes: a `BrowserWindow`, `dialog.showOpenDialog`, and `CompanionModuleInstaller`.
- Produces: `chooseAndInstallCompanionModule(options): Promise<CompanionModuleInstallResult | null>` and renderer API `chooseAndInstallCompanionModule(): Promise<CompanionModuleInstallResult | null>`.

- [x] **Step 1: Add failing setup-operation tests**

Create `src/electron/companionModuleSetup.test.ts` with injected picker and installer mocks. Assert the picker receives:

```ts
{
  title: "Choose Companion Developer Modules Folder",
  buttonLabel: "Choose Folder & Install",
  properties: ["openDirectory", "createDirectory"]
}
```

Assert cancellation returns `null` and calls neither `setManualDeveloperModulesPath` nor `install`. Assert one selected folder saves that exact absolute path, then calls `install`, and returns its result.

- [x] **Step 2: Verify the setup-operation tests fail**

Run:

```bash
npx vitest run src/electron/companionModuleSetup.test.ts
```

Expected: FAIL because the setup operation does not exist.

- [x] **Step 3: Implement the injected setup operation**

Create `src/electron/companionModuleSetup.ts`:

```ts
export interface ChooseAndInstallCompanionModuleOptions {
  browserWindow: BrowserWindow;
  installer: CompanionModuleInstaller;
  showOpenDialog: typeof dialog.showOpenDialog;
}

export async function chooseAndInstallCompanionModule(
  options: ChooseAndInstallCompanionModuleOptions
): Promise<CompanionModuleInstallResult | null>;
```

The function opens a directory-only picker. On cancellation or anything other than one selected absolute path, return `null`. Otherwise save the manual path and call the existing installer.

- [x] **Step 4: Wire main process and preload**

In `src/electron/main.ts`:

- import Electron `dialog`;
- pass `manualConfigPath: companionModuleConfigPath(userDataPath)` into the installer;
- register `companion-module:choose-and-install`;
- call `chooseAndInstallCompanionModule({ browserWindow: mainWindow, installer: companionInstaller, showOpenDialog: dialog.showOpenDialog })`;
- preserve the existing error normalization.

In preload and renderer global types, expose:

```ts
chooseAndInstallCompanionModule: () =>
  ipcRenderer.invoke("companion-module:choose-and-install") as Promise<
    CompanionModuleInstallResult | null
  >;
```

- [x] **Step 5: Run focused IPC/setup tests and commit**

Run:

```bash
npx vitest run src/electron/companionModuleSetup.test.ts src/electron/preloadPaths.test.ts
npm run typecheck
git add src/electron/companionModuleSetup.ts src/electron/companionModuleSetup.test.ts src/electron/main.ts src/electron/preload.cts src/renderer/state/workspaceStorage.ts src/shared/companionModule.ts
git commit -m "feat: choose companion module folder"
```

---

### Task 3: Add the explicit instructional setup dialog

**Files:**
- Create: `src/renderer/components/CompanionModuleSetupDialog.tsx`
- Create: `src/renderer/components/CompanionModuleSetupDialog.test.tsx`
- Modify: `src/renderer/components/WorkspaceSettings.tsx`
- Modify: `src/renderer/components/WorkspaceSettings.test.tsx`
- Modify: `src/renderer/components/CameraListEditor.test.tsx`
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/App.test.tsx`
- Modify: `src/renderer/styles.css`

**Interfaces:**
- Consumes: `CompanionModuleInstallStatus.pathSource`, existing `Dialog` and `Button` primitives, and the choose-and-install preload operation.
- Produces: `CompanionModuleSetupDialog` and `WorkspaceSettingsProps.onChooseAndInstallCompanionModule(): Promise<boolean>`.

- [x] **Step 1: Add failing dialog and card behavior tests**

Test that the setup dialog contains all exact instruction labels and the two actions **Cancel** and **Choose Folder & Install**. In `WorkspaceSettings.test.tsx`, assert:

- `not_configured` renders enabled **Set Up Companion**;
- rendering or checking status does not call the setup action;
- clicking **Set Up Companion** opens the dialog but still does not call the native setup action;
- clicking **Choose Folder & Install** calls it once;
- returning `false` leaves the dialog open;
- returning `true` closes it;
- `pathSource: "manual"` shows **Change Folder** and opens the same dialog;
- **Cancel** closes without calling setup.

- [x] **Step 2: Run focused renderer tests and verify they fail**

Run:

```bash
npx vitest run src/renderer/components/CompanionModuleSetupDialog.test.tsx src/renderer/components/WorkspaceSettings.test.tsx
```

Expected: FAIL because the dialog and enabled setup behavior do not exist.

- [x] **Step 3: Implement the setup dialog**

Create `CompanionModuleSetupDialog.tsx` using the shared `Dialog`. Render a numbered list with Companion's exact labels. Use:

```tsx
<Button variant="ghost" onClick={onClose}>Cancel</Button>
<Button variant="primary" disabled={busy} onClick={() => void onChoose()}>
  {busy ? "Installing…" : "Choose Folder & Install"}
</Button>
```

Keep errors visible inside the dialog with `role="alert"`.

- [x] **Step 4: Wire explicit setup behavior into the card and App**

In `WorkspaceSettings`:

- keep local `setupOpen` state;
- label `not_configured` as **Set Up Companion** and enable it;
- on that state, clicking opens the dialog only;
- for `missing` and `outdated`, retain the direct explicit install/update callbacks;
- show **Change Folder** only for `pathSource === "manual"`;
- never open the dialog from an effect.

In `App.tsx`, implement `chooseAndInstallCompanionModule(): Promise<boolean>` that sets busy/error state, awaits the preload call, returns `false` for cancellation or error, updates module status and returns `true` for success.

- [x] **Step 5: Add compact dialog styling**

Add scoped styles for a maximum-width setup dialog, compact numbered instructions, emphasized Companion UI labels, and a quiet path explanation. Reuse current neutral/orange colors; do not introduce blue accents.

- [x] **Step 6: Run renderer/App tests and commit**

Run:

```bash
npx vitest run src/renderer/components/CompanionModuleSetupDialog.test.tsx src/renderer/components/WorkspaceSettings.test.tsx src/renderer/components/CameraListEditor.test.tsx src/renderer/App.test.tsx
npm run typecheck
git add src/renderer/components/CompanionModuleSetupDialog.tsx src/renderer/components/CompanionModuleSetupDialog.test.tsx src/renderer/components/WorkspaceSettings.tsx src/renderer/components/WorkspaceSettings.test.tsx src/renderer/components/CameraListEditor.test.tsx src/renderer/App.tsx src/renderer/App.test.tsx src/renderer/styles.css
git commit -m "feat: guide companion module setup"
```

---

### Task 4: Verify, version, sign, and install DITBrowse v1.0.1

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/versionConfig.test.ts`
- Modify: `docs/verification.md`
- Generate: `release/DITBrowse-darwin-arm64/DITBrowse.app`
- Generate: `release/DITBrowse-darwin-arm64/DITBrowse-mac-arm64.zip`
- Generate: `release/DITBrowse-darwin-arm64/DITBrowse-mac-arm64.dmg`
- Replace: `/Applications/DITBrowse.app`

**Interfaces:**
- Consumes: Tasks 1–3 and existing Apple credentials.
- Produces: a tested, signed/notarized/stapled local v1.0.1 app with the live workspace preserved.

- [x] **Step 1: Bump only the DITBrowse app to 1.0.1**

Update `src/versionConfig.test.ts` to expect root app and lockfile `1.0.1` while the Companion module remains `1.0.0`. Run:

```bash
npm version 1.0.1 --no-git-tag-version
npx vitest run src/versionConfig.test.ts
git add package.json package-lock.json src/versionConfig.test.ts
git commit -m "release: set app version 1.0.1"
```

- [x] **Step 2: Run the complete verification gate**

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
node --test scripts/notarization-policy.test.mjs scripts/signed-release-policy.test.mjs
```

Expected: every command exits 0.

- [x] **Step 3: Build and notarize v1.0.1**

Run:

```bash
npm run package:mac:notarized
```

Verify app and DMG using `codesign --verify`, `spctl --assess`, and `stapler validate`. Mount the DMG and confirm app `1.0.1`, Companion module `1.0.0`, the Applications symlink, matching ICNS, and DarkAqua icon stack.

- [x] **Step 4: Back up and replace Applications**

Record the current local API state, quit DITBrowse, move `/Applications/DITBrowse.app` to a new timestamped backup, copy the verified v1.0.1 app with `ditto`, refresh LaunchServices and Dock, relaunch it, and confirm the recorded camera count, selected camera, and expansion mode are preserved.

- [x] **Step 5: Update verification docs and complete the plan**

Record the v1.0.1 tests, signature/notarization results, artifact checksums, installed version, backup path, and preserved live state in `docs/verification.md`. Mark every checkbox in this plan `[x]` and commit:

```bash
git add docs/verification.md docs/superpowers/plans/2026-07-11-companion-folder-setup.md
git commit -m "docs: verify companion folder setup"
```
