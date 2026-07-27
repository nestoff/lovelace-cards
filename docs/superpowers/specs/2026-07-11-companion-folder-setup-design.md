# Companion Developer-Module Folder Setup Design

## Goal

Let a user install the bundled DITBrowse Companion module when DITBrowse cannot read Companion's configured developer-module folder, without ever installing automatically or modifying Companion's configuration.

## User-Initiated Behavior

DITBrowse may check module status when the user opens Camera List settings, but checking is read-only. It must not open a dialog, choose a path, create a folder, copy a module, or change Companion merely because the app launched or status was checked.

The fallback flow starts only when the user deliberately clicks **Set Up Companion** in DITBrowse's existing Companion module section. If Companion's configuration already supplies a valid developer-module path, the normal **Install Companion Module** or **Update Companion Module** action continues to install directly after the user's click.

## Setup Dialog

When the user clicks **Set Up Companion** and automatic configuration discovery is unavailable, show a focused modal titled **Set Up the Companion Module**. It contains these instructions:

1. Open the Companion launcher.
2. Open **Advanced Settings**.
3. Select **Developer**.
4. Turn on **Enable Developer Modules**.
5. Set **Developer Modules Path** to a folder Companion can watch.
6. Return to DITBrowse and choose that same folder.

Companion's current official launcher source uses the labels **Advanced Settings**, **Developer**, **Enable Developer Modules**, and **Developer Modules Path**. The dialog should use those exact labels.

Dialog actions:

- **Cancel** closes the dialog and changes nothing.
- **Choose Folder & Install** opens the native macOS directory picker.

After a folder is selected, DITBrowse saves the absolute folder path in its own user-data directory, installs the bundled module into `<selected folder>/lightlab-ditbrowse`, validates the result, closes the dialog, and refreshes the displayed module status. Canceling the native picker leaves the dialog open and does not save or install anything.

## Path Resolution and Persistence

Add a small DITBrowse-owned configuration file under Electron's `userData` directory. It contains only the optional developer-module root path.

Resolution order:

1. A valid Companion configuration with `enable_developer=true` and an absolute `dev_modules_path`.
2. The saved DITBrowse manual folder override.
3. No configured path.

Companion's own valid configuration remains authoritative. A manual override is a fallback for nonstandard configuration locations, missing configuration files, or installations using `COMPANION_CONFIG_BASEDIR`.

DITBrowse must never write `~/Library/Application Support/companion/config.json`, toggle Companion's developer setting, or guess a folder through filesystem scanning.

## Main-Process Interface

Extend the module installer so it can load and save a manual developer-module root. Add a main-process IPC operation that opens Electron's native directory picker and, after explicit confirmation, saves the selected root and invokes the existing transactional installer.

The renderer receives one result representing cancellation, installation, update, or no change. Errors remain visible in the Companion module card and inside the setup dialog when it is open.

The existing transactional copy, semantic-version comparison, staging folder, backup, rollback, and validation behavior remains unchanged.

## Companion Module Card

For `not_configured` state:

- show **Set Up Companion** as an enabled button;
- explain that DITBrowse could not find a configured developer-module path;
- do not install until the button is clicked.

For missing or outdated modules with a discovered path, keep **Install Companion Module** and **Update Companion Module**. For current, newer, invalid, or bundled-payload error states, preserve the existing safe disabled behavior.

Once a manual fallback exists, include a **Change Folder** action in the Companion module section so a user can correct or replace the saved path. This action opens the same instructional dialog and still requires **Choose Folder & Install** before making changes.

## Testing

Automated tests must prove:

- status checks never install or open the picker;
- `not_configured` renders an enabled **Set Up Companion** button;
- clicking that button opens the instructional dialog;
- the dialog contains the exact Companion setting labels;
- canceling either dialog changes nothing;
- selecting a folder persists only an absolute directory path;
- a valid Companion configuration takes precedence over the manual fallback;
- the manual fallback works when Companion's standard config is missing;
- selecting a folder installs or updates through the existing transactional installer;
- install failures preserve the previous module and show a useful error;
- the native picker allows directories only;
- **Change Folder** reuses the same explicit flow;
- the complete unit, browser, Electron, type, build, and release-policy gates remain green.

## Acceptance Criteria

- Nothing installs automatically.
- The setup popup appears only after the user clicks **Set Up Companion** or **Change Folder**.
- The popup teaches the current Companion developer-module setup using Companion's real UI labels.
- A user can choose a nonstandard developer-module root and install the bundled module without editing files manually.
- DITBrowse remembers the fallback path but does not alter Companion's configuration.
- Existing automatic discovery and module update behavior continue to work after an explicit user click.

## Reference

- [Bitfocus Companion Developer settings source](https://github.com/bitfocus/companion/blob/main/launcher-ui/src/sections/Developer.tsx)
