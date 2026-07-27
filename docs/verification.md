# DITBrowse Verification

## Automated

### DITBrowse v1.0.1 Companion folder setup

Verified July 11, 2026:

```bash
npm run test                    # 50 files, 408 tests passed
npm run typecheck               # passed
npm run test:e2e                # 10 passed, 1 capture-only test skipped
npm run test:electron           # 1 passed
npm run build                   # passed
npm run package:mac:notarized   # signed/notarized app, ZIP, and DMG
```

The installer now checks Companion configuration without side effects. When no
developer-module path can be discovered, it shows setup instructions only after the
user clicks **Set Up Companion**. Canceling the dialog or native directory picker
changes nothing. A selected absolute folder is stored in DITBrowse's own user-data
configuration and used only as a fallback; DITBrowse never edits Companion's config.

The focused installer and renderer tests cover configuration precedence, manual-path
persistence, directory-picker cancellation, transactional installation, rollback,
the exact Companion Developer setting labels, and the requirement that no popup or
installation happens automatically. Companion module 1.0.0 retained 14 passing tests,
lint, typecheck, build, and manifest validation.

The v1.0.1 app and DMG passed `codesign`, `spctl`, `stapler validate`, and mounted-image
verification. The DMG contains app 1.0.1, Companion module 1.0.0, the Applications
symlink, matching legacy ICNS, and the DarkAqua Icon Composer image stack.

```text
5f883407742e8627153388cf5b6adbb3a81b560592aaf1e9451fda057d93645e  DITBrowse-mac-arm64.dmg
ea0673d5f7b1be28bafc3489dac27bbf22c03b73a0f1061d49de929dc5925113  DITBrowse-mac-arm64.zip
```

The signed app replaced `/Applications/DITBrowse.app`; the prior copy was preserved at
`/Users/lightlab/Documents/DITBrowse App Backups/DITBrowse-20260711-124909.app`. The
live pre-install state remained intact: 11 cameras, selected camera 1, and expansion
enabled.

### DITBrowse v1.0.0 release

Verified July 11, 2026 for DITBrowse v1.0.0:

```bash
npm run test                    # 47 files, 388 tests passed
npm run typecheck               # passed
npm run test:e2e                # 10 passed, 1 capture-only test skipped
npm run test:electron           # 1 passed
npm run build                   # passed
npm run package:mac:notarized   # signed/notarized app, ZIP, and DMG
```

The Electron test uses a local mock camera with HTTP authentication, cookies,
localStorage, sessionStorage, IndexedDB, and a base-address redirect. It verifies
that signing out and reloading removes active authentication, requests the base address
again without credentials, preserves the saved username and password for explicit
sign-in, and does not reload the camera while resizing the window.

Electron screenshots were captured at 960x640, 1180x800, and 1440x900. The shared
address field, focus control, columns, zoom, aspect ratio, viewport, and all-camera
controls remained inside the window at each size. Camera content remained centered.

The final v1.0.0 hardened-runtime app and signed installer were accepted and stapled by Apple:

- `release/DITBrowse-darwin-arm64/DITBrowse.app`
- `release/DITBrowse-darwin-arm64/DITBrowse-mac-arm64.zip`
- `release/DITBrowse-darwin-arm64/DITBrowse-mac-arm64.dmg`

`codesign`, `spctl`, and `stapler validate` passed for both the app and DMG with
Developer ID team `8BWXULM784`. The DMG checksum passed `hdiutil verify`, mounted
read-only with the Applications symlink, and contained DITBrowse 1.0.0, Companion
module 1.0.0, the matching legacy ICNS, and a DarkAqua Icon Composer image stack.

Release checksums:

```text
56c20848b183f4193053e2bfcf33d8e1ea4e7c8ff05554f8c02891bd0f80d52c  DITBrowse-mac-arm64.dmg
6726127e4cd726367ebc174b05cdcd643caef7399910a164bd92db72999b5a79  DITBrowse-mac-arm64.zip
```

The signed v1.0.0 app was installed at `/Applications/DITBrowse.app` after backing
up the prior app. Its local API returned `ok=true` with the live pre-install state
preserved: 11 cameras, selected camera 11, and expansion enabled.

## Companion Integration

Verified July 11, 2026 for Companion module v1.0.0:

```bash
npm test                 # 5 files, 14 tests passed
npm run lint             # passed
npm run typecheck        # passed
npm run build            # passed
npm run companion-module-check  # valid

cd companion-module-lightlab-ditbrowse
yarn test                # 5 files, 14 tests passed
yarn lint                # passed
yarn typecheck           # passed
yarn build               # passed
yarn companion-module-check
yarn package
```

The Companion manifest passed the official `@companion-module/base` validator. The
Bitfocus package builder produced:

```text
companion-module-lightlab-ditbrowse/lightlab-ditbrowse-1.0.0.tgz
```

The package contains the compiled Node 22 module, manifest, help, and package metadata.
The cross-package integration test starts the real DIT Browse HTTP/WebSocket server and
the real Companion connection engine, then verifies integer camera focus, expansion
toggle behavior, revisioned live status, and request correlation.

The local control endpoints are:

```text
http://127.0.0.1:52780/api/...
ws://127.0.0.1:52780/api/ws
```

The host remains fixed to loopback. No host, token, password, LAN, TLS, or discovery
configuration is present in the Companion module.

## Manual

1. Open `release/DITBrowse-darwin-arm64/DITBrowse.app`.
2. Confirm the app opens to the tiled workspace.
3. Confirm tabs remain in one horizontal row, have no left/right arrow buttons, and drag in grid order.
4. Load or import 10-15 camera URLs.
5. Change the column selector and confirm every tile remains visible.
6. Resize the app window and confirm loaded pages do not reload.
7. Select a tile and navigate it from the address bar.
8. Use the open-in-new-tile address action and confirm the URL opens in a new tile.
9. Change selected tile zoom and viewport and confirm the camera page scales.
10. Quit and relaunch, then confirm workspace state returns.
11. Open **Camera List** and confirm the editable camera table opens immediately with workspace settings below it.
12. Use **Sign Out & Reload Camera** and confirm only the selected camera reloads from its base address.
13. Use **Sign Out & Reload All**, confirm the warning, and verify every open camera reloads from its base address.
14. Confirm both reset scopes keep saved passwords but require an explicit first sign-in.
15. Hover browser, list, reset, and password controls and confirm descriptive tooltips stay inside the window.

### Companion

1. Run DIT Browse and Companion on the same computer.
2. Confirm DIT Browse shows Local API port `52780`, or configure the same custom port in both apps.
3. Install `companion-module-lightlab-ditbrowse/lightlab-ditbrowse-0.1.0.tgz` in Companion.
4. Add a DIT Browse connection and confirm its only settings are port and debug logging.
5. Add the Camera 2 preset and confirm it focuses camera number `2`, regardless of tab order.
6. Press Toggle Expansion Mode and confirm a focused camera immediately returns to the grid.
7. Press a camera preset while expansion is off and confirm selection and grid state do not change.
8. Confirm the local Focus Selected Page control is disabled while expansion is off.
9. Toggle expansion on and confirm the grid stays visible until a camera preset is pressed.
10. Change selection or focus in DIT Browse and confirm Companion feedback updates without polling.
11. Restart DIT Browse and confirm Companion reconnects and refreshes state without replaying the last action.
