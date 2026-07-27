# Companion Module Self-Installer Design

## Summary

DIT Browse will provide an explicit Settings action that installs or updates its bundled Bitfocus Companion developer module on the same Mac. The feature reads Companion's configured developer-module directory, compares the bundled and installed module versions, and performs an offline, atomic installation when the module is missing or older.

DIT Browse manages only the module files. It does not edit Companion's connection database, create or enable a connection instance, restart Companion, use an undocumented Companion API, or add authentication or tokenization.

## Goals

- Let an operator install the DIT Browse Companion module without Terminal, Yarn, Node.js, a browser upload, or internet access.
- Read the actual developer-module directory from Companion's local configuration instead of assuming a fixed folder.
- Install the module when it is missing.
- Update the module when the bundled version is newer.
- Leave an equal or newer installed version untouched.
- Preserve the current same-computer, loopback-only Companion architecture.
- Give the operator clear status and recovery instructions in DIT Browse Settings.
- Package a self-contained, signed module payload inside the DIT Browse application.

## Non-Goals

- Creating, editing, enabling, or deleting Companion connection instances.
- Writing directly to Companion's SQLite databases.
- Calling Companion's undocumented administrative endpoints.
- Restarting or terminating Companion.
- Installing from the internet or resolving dependencies at runtime.
- Supporting remote computers, LAN module deployment, tokens, credentials, or authentication.
- Silently installing the module when DIT Browse starts.
- Downgrading a newer installed module.
- Publishing the module to the official Bitfocus module catalog.

## User Experience

The existing Local API section in DIT Browse Settings will gain a Companion module status row and one primary action.

Possible states are:

| State | Display | Action |
| --- | --- | --- |
| Companion not configured | Companion developer modules are not enabled or no developer path is configured. | Disabled; explain how to enable the developer path in Companion. |
| Missing | DIT Browse Companion module is not installed. | `Install Companion Module` |
| Outdated | Installed version is older than the version bundled with DIT Browse. | `Update Companion Module` |
| Current | The bundled version is installed. | Disabled `Installed` |
| Newer | A newer module is already installed and will be kept. | Disabled `Newer Version Installed` |
| Invalid or foreign install | The target folder cannot be safely identified as the DIT Browse module. | Disabled; explain that the folder must be inspected manually. |
| Operation failed | Installation or update did not complete. | Keep the appropriate install/update action available and show the failure message. |

Opening Settings requests fresh status from the Electron main process. Clicking Install or Update disables the action while work is in progress, then requests status again and displays the result.

A successful result says that Companion will normally discover or reload the developer module automatically. It also tells the operator to use Companion's `Refresh modules list` control if the module does not appear. DIT Browse does not claim that a Companion connection instance has been created.

## Architecture

The feature is divided into four bounded parts:

1. A packaging script produces a small, ready-to-run module payload from the official Companion module build output.
2. An Electron main-process installer locates Companion, assesses installed state, and performs safe filesystem changes.
3. Context-isolated IPC exposes status and installation methods to the renderer.
4. The Settings renderer displays status and invokes the installer.

```text
DIT Browse Settings
    -> context-isolated preload API
    -> Electron IPC handler
    -> CompanionModuleInstaller
       -> Companion config.json
       -> bundled signed module payload
       -> configured Devmodules/lightlab-ditbrowse
    -> structured result
    -> Settings status and recovery guidance
```

The installer service contains no renderer or global Electron state. Paths are supplied to it so filesystem behavior can be tested entirely with temporary directories.

## Companion Configuration Discovery

On macOS, the main process reads:

```text
~/Library/Application Support/companion/config.json
```

The configuration is treated as untrusted input. The installer requires:

- `enable_developer` to be `true`.
- `dev_modules_path` to be a non-empty absolute path.

The installer may create the configured developer-module directory if it does not exist. It always appends the constant child directory `lightlab-ditbrowse`; configuration data never controls the module folder name.

If the configuration file is absent, malformed, disabled, or missing a valid path, the status is `not_configured`. DIT Browse does not invent or write a Companion configuration because a folder that Companion is not configured to watch would give a false success result.

## Bundled Module Payload

The packaged application contains a generated resource at:

```text
Contents/Resources/companion-module/lightlab-ditbrowse/
```

The runtime resolves it from:

```ts
path.join(process.resourcesPath, "companion-module", "lightlab-ditbrowse")
```

The payload contains only the files required by Companion:

```text
lightlab-ditbrowse/
├── main.js
├── package.json
├── companion/
│   ├── HELP.md
│   └── manifest.json
└── node_modules/
    └── @companion-module/
        └── base/
            └── package.json
```

`main.js` is the self-contained file generated by `companion-module-build`; its runtime code and WebSocket dependency are already bundled. Companion 4.3 reads `@companion-module/base/package.json` before launching a developer module, so that package metadata must be included even though the application code is bundled.

A build-time staging script verifies that:

- The module ID is `lightlab-ditbrowse`.
- The payload package version and Companion manifest version agree with the source module version.
- Every required file exists.
- The bundled `@companion-module/base` version is the version declared by the module.

The macOS packaging command builds the Companion module, stages this resource, excludes the raw Companion source tree and its development dependencies from `app.asar`, and copies the staged payload as an extra application resource. This avoids adding the module's full development `node_modules` directory to DIT Browse.

Development builds may resolve the existing generated module package under `companion-module-lightlab-ditbrowse/pkg/lightlab-ditbrowse` as a source fallback. Tests inject an explicit payload path and do not depend on developer machine state.

## Shared Contract and IPC

A shared module defines structured status and result types. The public contract is equivalent to:

```ts
type CompanionModuleInstallState =
  | "not_configured"
  | "missing"
  | "outdated"
  | "current"
  | "newer"
  | "invalid"
  | "error";

interface CompanionModuleInstallStatus {
  state: CompanionModuleInstallState;
  bundledVersion: string | null;
  installedVersion: string | null;
  targetPath: string | null;
  message: string;
  canInstall: boolean;
}

interface CompanionModuleInstallResult {
  outcome: "installed" | "updated" | "unchanged";
  status: CompanionModuleInstallStatus;
}
```

The preload exposes only these promise-based methods:

```ts
getCompanionModuleInstallStatus(): Promise<CompanionModuleInstallStatus>
installCompanionModule(): Promise<CompanionModuleInstallResult>
```

Renderer code never receives arbitrary filesystem operations or caller-controlled paths.

## Version and Identity Rules

The bundled payload must have a valid semantic version. An existing installation is identified using both:

- `companion/manifest.json` with `id: "lightlab-ditbrowse"`.
- Its local `package.json` with a valid version.

Version handling is:

- No target directory: `missing`.
- Installed version lower than bundled version: `outdated`.
- Installed version equal to bundled version: `current`.
- Installed version higher than bundled version: `newer`.
- Missing, malformed, or mismatched identity/version metadata: `invalid`.

Invalid installations are never overwritten automatically. This protects a manually modified or unrelated folder from data loss. Pre-release versions follow standard semantic-version ordering.

## Atomic Installation and Update

All changes occur inside the configured developer-module parent directory and on the same filesystem.

For an installation, the service:

1. Creates a uniquely named staging directory beside the final target.
2. Copies the bundled payload into staging without following links from an existing installation.
3. Re-reads and validates the staged manifest, package version, entrypoint, and Companion base metadata.
4. Renames staging to `lightlab-ditbrowse`.

For an update, the service:

1. Completes and validates the staging copy first.
2. Renames the existing target to a unique sibling backup.
3. Renames staging to the final target.
4. Deletes the backup after the replacement succeeds.

If replacement fails after the backup rename, the service restores the previous directory before returning an error. Temporary staging and backup directories are cleaned up on both success and failure. Existing symlinks are moved or removed as directory entries and are never traversed during cleanup.

Only `missing` and `outdated` states permit a write. Rechecking status immediately before mutation prevents a stale Settings screen from downgrading or overwriting a changed installation.

## Companion Runtime Behavior

Companion watches its configured developer-module directory and normally detects a newly created or replaced module automatically. DIT Browse does not depend on that watcher for filesystem correctness and does not call Companion after installation.

If Companion is not running, the module is available the next time Companion starts. If Companion is running but does not refresh, the operator can use `Refresh modules list` from Companion's interface. Creating and enabling a `DITBrowse` connection remains a one-time Companion UI operation.

## Error Handling

Expected failures are converted into concise operator-facing messages while the underlying error is logged by the Electron main process.

Handled cases include:

- Companion configuration missing or malformed.
- Developer modules disabled.
- Developer path missing, relative, or inaccessible.
- Bundled payload missing or invalid.
- Installed folder contains foreign or malformed metadata.
- Permission denied while creating, copying, renaming, or removing files.
- Staging validation failure.
- Replacement failure and restoration failure.

The renderer displays messages returned by the main process and never exposes raw stack traces. A restoration failure is reported distinctly because manual inspection may be required.

## Testing

### Installer unit tests

Temporary-directory tests cover:

- Missing module installs successfully.
- Older module updates successfully.
- Equal version produces `unchanged` and performs no write.
- Newer version produces `unchanged` and is not downgraded.
- Missing or disabled Companion configuration produces `not_configured`.
- Relative developer paths are rejected.
- Foreign and malformed target folders produce `invalid` and remain untouched.
- Missing or inconsistent bundled payload metadata prevents installation.
- A simulated rename failure restores the previous installation.
- Staging and backup directories are removed after success and recoverable failure.

### IPC and renderer tests

- The preload exposes only the two scoped Companion installer methods.
- Settings requests status and renders each meaningful state.
- Install and Update invoke the correct method once and disable while busy.
- Success refreshes status and shows Companion reload guidance.
- Failure leaves retry available and shows the returned message.

### Packaging tests

- The staging script produces the exact required payload layout.
- The package command runs module staging before Electron packaging.
- The raw Companion source tree and development dependencies are excluded from `app.asar`.
- The payload is copied to `Contents/Resources/companion-module/lightlab-ditbrowse`.
- A packaged-app smoke check can read and validate the bundled module metadata.

### Regression verification

The existing DIT Browse unit, integration, Electron, build, and Companion module suites continue to pass. A manual verification installs into a temporary Companion developer path first, followed by an end-to-end check against the local Companion 4.3 installation.

## Acceptance Criteria

- DIT Browse Settings accurately distinguishes missing, outdated, current, newer, invalid, and unconfigured module states.
- One explicit button installs a missing module or updates an older one without external tools or network access.
- Equal and newer installed versions are not modified.
- Foreign or malformed target directories are not overwritten.
- The operation is atomic and restores an existing module after a recoverable replacement failure.
- Companion can launch the installed developer module without a missing `@companion-module/base/package.json` error.
- The packaged DIT Browse app includes the lean module payload and excludes the Companion module's development dependency tree.
- The feature does not create a Companion connection instance or modify Companion databases.
- No tokenization, authentication, LAN control, or remote installation is introduced.
