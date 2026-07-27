# DITBrowse Browser Shell Redesign

## Purpose

DITBrowse should feel like a purpose-built browser for camera GUIs, not like a generic control dashboard. The app remains an Electron macOS app using Chromium webviews; this redesign changes the React renderer chrome, component structure, and performance behavior around the webview grid.

## Product Direction

The primary surface should read as a browser:

- A top tab strip is the first browser signal.
- A second browser toolbar holds back, forward, reload, a single address bar, and the selected tile state.
- Grid, scale, job, list, cookie, and reset controls are secondary browser tools, not the dominant first-read UI.
- The tile grid is the page area: equal-size tiles, all visible, row-major order, selected tile outline, and minimal labels.
- The app should remain dense, calm, and operational. It should not become a marketing page, decorative dashboard, or oversized custom app shell.

## Architecture

Electron stays in place for the app shell, Chromium webviews, session partitions, cookies, local storage, password/list persistence, and local LAN browsing. React DOM owns only the browser chrome and workspace UI around those webviews.

The renderer should be reorganized into reusable browser-chrome components:

- `BrowserChrome` coordinates the tab strip, toolbar, and secondary tools.
- `BrowserToolbar` owns navigation buttons, address bar placement, reload commands, and selected-tile status.
- `BrowserTabs` wraps the existing tab behavior in a browser-like tab strip.
- `BrowserToolsMenu` or an equivalent drawer holds camera list editing, cookie clearing, reset order, reset scale, and job/list controls.
- Small reusable UI primitives handle buttons, icon buttons, select fields, segmented controls, and tool groups.

The existing reducer and Electron IPC model should remain intact unless a performance issue requires a narrow state boundary change.

## Browser Chrome Design

The visual language should be close to native mac browser chrome:

- Dark neutral mac-style window surface, not a saturated dashboard theme.
- Compact tab geometry with active/inactive tab states.
- Icon buttons for back, forward, reload, reload all, add tab, menu, reset, and settings-style controls.
- A single prominent address field centered in the browser toolbar.
- Grid column and scale controls visible but compact, likely grouped on the right side of the toolbar.
- Job/list selection and editor access placed in a drawer/menu area so the main browser view stays clean.

Controls must have stable dimensions so labels, hover states, and dynamic URLs do not resize the chrome.

## Tile Grid Design

The tile grid keeps the existing product rules:

- User chooses the column count.
- All tiles remain visible.
- Tiles are equal size within the available grid area.
- Row-major order is preserved: left to right across row one, then row two, then row three.
- Only the selected tile receives browser commands from the shared address bar unless the user uses an explicit all-tiles command.
- Resizing the Electron window scales the visible webview contents without intentionally reloading the pages.

Tile labels should be minimal and browser-like: small, high-contrast, and unobtrusive. Empty or error states should fit inside the tile without expanding or changing the grid.

## Performance Requirements

The redesign must reduce unnecessary React churn around webviews:

- Memoize heavy tile and tab components where props allow it.
- Keep handler identities stable enough that unchanged webview tiles avoid unnecessary rerenders.
- Debounce workspace persistence so frequent UI changes do not save on every tiny state update.
- Do not remount webviews during chrome-only interactions.
- Avoid adding heavy styling/runtime libraries that do not materially help this Electron React DOM app.

Uniwind is intentionally not part of this redesign because DITBrowse is not a React Native app. Tailwind-style CSS tokens or ordinary CSS modules/classes are acceptable for the Electron React DOM renderer.

## Testing

Testing must cover both behavior and rendered browser feel:

- Unit/component tests should verify the browser chrome renders tabs before the toolbar, exposes one address bar, and keeps secondary controls behind the intended menu/drawer.
- Existing reducer tests should continue to pass unchanged.
- Existing tile grid behavior tests should continue to pass.
- E2E tests should verify the first viewport has browser chrome, the selected tile remains visible, all grid cells keep equal heights, and changing grid columns does not hide the first tile.
- Manual or browser screenshot verification should confirm the interface reads as a browser, not a dashboard.

## Out Of Scope

This redesign does not replace Electron, change the browser engine, implement video playback, add cloud sync, or build a new password manager backend. It also does not change the core camera URL/list model unless required by the chrome refactor.
