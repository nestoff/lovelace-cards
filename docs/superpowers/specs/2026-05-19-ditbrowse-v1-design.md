# DITBrowse V1 Design

## Overview

DITBrowse v1 is a macOS desktop app for previewing and controlling multiple camera-hosted web GUIs on a local network. It is a focused tiled browser for DIT/camera workflows, not a full daily-driver browser.

The app should let a user open 10-15 camera web pages, keep every page visible, preserve camera page state while resizing, save credentials locally by job/list, and reopen the same workspace between launches.

## Goals

- Provide one macOS app window for viewing multiple camera web GUIs.
- Keep all camera tiles visible with equal-size tiles.
- Let the user choose grid density/column count.
- Map tabs to the grid in row-major order: left to right across row 1, then left to right across row 2, and so on.
- Scale live camera pages during resize without reloading them.
- Persist jobs, camera lists, tile order, open workspace state, viewport/zoom settings, cookies, and saved passwords.
- Support local LAN URLs typed directly into the address bar.
- Support shortcut entry from a camera list prefix, such as typing `42` to open `http://192.168.1.42`.
- Provide in-app camera list editing and CSV import.

## Non-Goals For V1

- Windows or Linux support.
- Browser extensions.
- Cloud sync.
- User accounts.
- Network auto-discovery of cameras.
- Special handling for invalid or self-signed certificates.
- Full browser history/bookmark management beyond jobs and camera lists.
- Custom Chromium fork.
- Mobile app.

## Recommended Technical Direction

Build v1 with Electron and Chromium.

Electron is the best fit because DITBrowse needs multiple embedded browser surfaces, persistent site data, isolated browser contexts, browser-like navigation controls, and direct control over tile layout and scaling. A native macOS `WKWebView` app is possible, but it gives less control over the tiled browser behavior and browser-session model. A Chromium fork would be too large for v1.

Each camera tile should be a live embedded browser surface. Resizing the app or changing grid density must not reload the tile. Resize behavior should update layout and visual scale only.

## Core Product Model

DITBrowse is organized around jobs and camera lists.

A job represents a real-world shoot/job context. A camera list belongs to a job and contains ordered camera entries. The same LAN address can appear in multiple jobs with different credentials.

Each camera entry can include:

- Display name.
- Full URL.
- URL suffix.
- Optional prefix override.
- Optional notes.
- Optional viewport override.
- Optional zoom/scale override.
- Username.
- Password.

Each camera list has a default URL prefix. If the prefix is `http://192.168.1.` and the user types `42`, the app can resolve that shortcut to `http://192.168.1.42`.

If both a full URL and suffix exist for an entry, the full URL wins.

## Browser Workspace

The app opens directly into the tiled browser workspace.

Top controls:

- Back button for selected tile.
- Forward button for selected tile.
- Reload button for selected tile.
- One address bar for the selected tile.
- Open-in-new-tile action for typed URLs or shortcuts.
- One horizontal scrollable tab row.
- `+` button for a blank tile.
- Job/list selector.
- Grid column selector.
- Global viewport and zoom/scale defaults.

The address bar controls only the selected tile. Typing a full LAN URL navigates the selected tile by default. The user can also open the typed URL or shortcut into a new tile.

The tab row stays as a single horizontal row and scrolls when there are too many tabs to fit.

## Tile Grid

The main area is an equal-size visible tile grid.

Rules:

- Every tile stays visible in the app window.
- The grid does not scroll in normal use.
- Tiles are equal size.
- Tiles do not need to be literal squares.
- The user controls grid density/column count.
- Camera/tab order fills the grid left to right across each row.
- Uneven counts leave empty slots instead of making one tile a different size.
- The selected tile has a clear visual outline.
- Empty slots are visible placeholders.
- Tiles can show compact labels based on camera name or IP.
- Tile controls should be minimal and should not cover the camera GUI.

## Scaling Behavior

Camera pages should scale to fit their tiles without reloading.

Each tile has:

- A stable internal viewport size.
- A global default viewport size.
- A per-tile viewport override.
- Automatic fit-to-tile scaling.
- A manual per-tile zoom/scale override.
- A global default zoom/scale behavior.

Expected behavior:

- If a camera GUI was visible before resizing, it should remain visible after resizing.
- The app should not reload or recreate the camera page during resize.
- The app should avoid letting the camera page reflow unpredictably when the grid changes.
- Scroll position and page state should be preserved when Chromium allows it.

Implementation should keep each tile's browser contents alive while only changing layout and scale.

## Jobs, Lists, And Loading

The app supports:

- Creating a blank tile with `+`.
- Opening a typed URL in the selected tile.
- Opening a typed URL in a new tile.
- Loading a saved camera list into the grid.
- Reordering tabs/cameras, with grid order following tab order.
- Saving and restoring the current workspace between launches.

When loading a camera list:

- Tile 1 gets the first camera.
- Tile 2 gets the second camera.
- Loading continues left to right across row 1.
- After row 1 is full, loading continues left to right across row 2.
- The number of cameras per row is determined by the current column count.

## Passwords And Cookies

DITBrowse includes a local password manager.

For v1, password records do not need encryption. They are stored as local app data with this structure:

- Job / Camera List
- URL
- Username
- Password

This is intentional v1 behavior. It keeps the workflow simple and lets the same LAN URL have different saved credentials on different jobs.

Cookies and site data should persist so camera pages can stay logged in between launches.

The app must include cookie-clearing commands:

- Clear cookies/site data for the selected tile.
- Clear cookies/site data for the current job/list.

Clearing cookies must not delete saved password records. Deleting a job or camera list should ask before deleting password records attached to it.

## Camera List Editor And CSV Import

V1 includes an in-app camera list editor and CSV import.

The in-app editor should support rows with:

- Name.
- Prefix.
- Suffix.
- Full URL.
- Username.
- Password.
- Notes.
- Viewport override.
- Zoom/scale override.

CSV is the first import format.

Minimum useful CSV columns:

- `name`
- `url`
- `suffix`
- `username`
- `password`
- `notes`

Import behavior:

- The user can import into a new list or update an existing list.
- If `url` is blank, the app builds the URL from the list prefix plus `suffix`.
- If both `url` and `suffix` exist, `url` wins.
- The app should preview import changes before applying them.
- Bad rows should be shown clearly.
- Valid rows should still be importable when other rows fail.

## Persistence

DITBrowse should save everything needed to reopen the same workspace later.

Saved state includes:

- Jobs.
- Camera lists.
- Camera entries.
- Password records.
- Current open tiles.
- Selected tile.
- Tile order.
- Grid column count.
- Global viewport default.
- Global zoom/scale default.
- Per-tile viewport override.
- Per-tile zoom override.
- Window size and position.
- Last active job/list.
- Cookies and site data.

All storage is local to the Mac in v1. There is no cloud sync or account system.

## Error Handling

Expected error behavior:

- If a camera URL fails to load, the tile shows a failed-load state with the URL and retry action.
- If a LAN address is unreachable, the tile stays in place and the grid does not collapse.
- If a CSV import has bad rows, the app shows which rows failed and why.
- If a password lookup matches multiple entries, the app asks which credential to use.
- If the tile count does not divide evenly by the selected column count, the app leaves empty slots.
- If a camera page has a certificate or browser-security issue, v1 uses normal Chromium behavior.

## Testing Focus

V1 verification should cover:

- Loading 10-15 camera URLs.
- Row-major tab/grid ordering.
- Single horizontal scrollable tab row.
- Changing grid columns without reloading pages.
- Resizing the app without reloading pages.
- Fit-to-tile scaling.
- Manual per-tile zoom override.
- Per-tile viewport override.
- Persisting and reopening a workspace.
- CSV import with valid and invalid rows.
- Password lookup by job/list, URL, username, and password.
- Cookie clearing for selected tile.
- Cookie clearing for current job/list.

## Acceptance Criteria

The v1 design is successful when a user can create a job, import or enter a camera list, load 10-15 camera web GUIs, resize the app without page reloads, keep every tile visible at equal size, use shortcut URL entry from a prefix, save local credentials, clear cookies when needed, quit, relaunch, and return to the same workspace.
