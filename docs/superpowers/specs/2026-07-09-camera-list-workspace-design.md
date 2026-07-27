# Camera List Workspace Design

## Purpose

DITBrowse should make camera-list editing the primary management workflow. The current toolbar opens a workspace popover, which then requires a second click on **Edit List** before the camera table appears. The replacement is one full Camera List workspace that opens the editable table immediately and places all less-frequent workspace settings below it.

## Entry And Navigation

- Replace the toolbar's sliders-only **Workspace tools** control with a labeled **Camera List** button.
- Clicking **Camera List** opens the full Camera List workspace in one action.
- Remove the old workspace popover and its nested **Edit List** command.
- Keep a persistent header in the full workspace with the active list name, **Discard**, and **Save Changes**.
- Closing or discarding a dirty list continues to require confirmation.
- Switching to another job or camera list while the table is dirty requires **Save and Switch**, **Discard and Switch**, or **Cancel**.
- Saving applies table changes and returns to the camera grid, matching the existing editor behavior.

## Workspace Layout

The workspace is a full-window scrolling surface. Content appears in this order:

1. Camera-list prefix and row controls.
2. Editable camera table.
3. Job and camera-list management.
4. Camera session and workspace actions.
5. Password presets and saved camera passwords.
6. Local control API settings.

The camera table remains the visual priority and uses the available width. Settings below it use clearly labeled, full-width sections rather than a narrow sidebar or nested tabs. The header remains visible while the workspace scrolls so Save and Discard are always reachable.

## Tab Strip

- Remove the left and right arrow buttons from every tab.
- Preserve drag-and-drop reordering.
- Preserve the close button and add-camera-tile button.
- Dragging a tab continues to update camera-list order, and dragging a table row continues to update tab/grid order.

No reducer behavior or persisted ordering schema changes are required; only the redundant directional controls are removed.

## Session Actions

Replace data-oriented labels with outcome-oriented labels:

- **Sign Out & Reload Camera** resets the selected camera.
- **Sign Out & Reload All** resets every open camera in the active list.

Tooltips and the all-camera confirmation dialog explain the full behavior: clear cookies, site data, current authentication, and affected connections, then reload from each camera's base IP. Saved usernames, password records, and password presets are retained.

The underlying reset behavior remains unchanged.

## Component Boundaries

- `BrowserChrome` owns the direct Camera List entry and no longer owns popover state.
- `CameraListEditor` becomes the full Camera List workspace shell and continues to own the unsaved camera-list draft.
- Reusable management sections currently composed by `BrowserToolsMenu` move into the workspace below the camera table. They continue to receive committed workspace state and dispatch existing actions immediately unless they edit the camera-list draft.
- `TabStrip` retains drag reordering and close/add behavior without directional move callbacks.
- `CookieCommands` keeps the same callbacks and adopts the new labels and descriptions.

This change does not modify persisted workspace data, camera webviews, authentication queues, or Electron session-reset IPC.

## Save Semantics

Camera table, prefix, camera count, CSV import, row order, and per-camera fields remain draft changes. They take effect only after **Save Changes**.

Job creation/deletion, credential management, session actions, workspace reset actions, and API-port settings retain their current immediate behavior. Job or camera-list selection switches immediately only when the table is clean; otherwise the workspace first resolves the draft through the save/discard/cancel prompt. These settings are visually separated from the draft table so users can distinguish list edits from commands.

## Error Handling

- Existing inline API-port errors remain in the Local API section.
- Existing status notices remain visible over the camera workspace while reset operations run.
- Destructive all-camera reset retains its confirmation dialog.
- Controls remain disabled when no selected camera or active list makes the command invalid.
- If the active list changes externally while the workspace is open and clean, the table draft resets to the newly selected list.
- A dirty draft cannot be replaced by an in-workspace job or list selection without explicit save or discard confirmation.

## Verification

Automated coverage will verify:

- The Camera List button opens the full table in one click.
- The old Workspace tools popover and Edit List command are absent.
- Tab directional controls are absent while drag reorder and close remain functional.
- Camera-list settings appear below the table.
- Session actions use the new labels and still invoke the existing selected/all reset callbacks.
- Save, discard, dirty confirmation, keyboard table navigation, and responsive width behavior continue to work.
- Switching lists while dirty presents save, discard, and cancel paths without losing changes implicitly.

Visual QA will cover the full workspace at compact, standard, and wide desktop sizes to ensure the camera table is not clipped and the settings sections remain readable.
