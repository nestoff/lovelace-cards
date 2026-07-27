# Focus Mode Zoom Isolation Design

## Purpose

When one camera is expanded into focus mode, DITBrowse should use the full available window to fit that camera's configured viewport. Grid-oriented persistent zoom settings should not carry into the expanded view.

## Required Behavior

DITBrowse has three zoom layers:

1. Per-camera zoom, stored on the camera tile.
2. Global **All** zoom, applied relatively across the grid.
3. Temporary trackpad zoom and pan, stored only in the mounted tile component.

The first two layers are grid presentation settings. The third is an inspection tool.

In normal grid mode, the existing scale remains:

```text
fit scale * per-camera zoom * All zoom * temporary trackpad zoom
```

For the selected tile in focus mode, the scale becomes:

```text
fit scale * temporary trackpad zoom
```

The fit scale is still calculated from the focused tile's available frame and configured viewport. This centers and fits the full camera GUI at its intended aspect ratio while ignoring both persistent grid zoom layers.

## State And Transitions

Entering focus mode must not modify the persisted per-camera zoom or global **All** zoom. It only changes which scale factors participate in rendering.

The selected webview remains mounted throughout the transition. Entering focus mode, changing the focused tab, and returning to the grid must not reload or navigate any camera page.

When focus mode ends, the saved per-camera and global zoom factors immediately participate in grid rendering again. No snapshot or restoration state is required because those values were never changed.

Temporary trackpad state remains available in focus mode:

- Pinch zoom continues from the tile's current temporary zoom.
- Two-finger pan continues while temporary zoom is above `1`.
- Shift+Z continues to reset temporary zoom and pan.
- Temporary zoom remains non-persistent and does not change the camera or global zoom controls.

Switching the focused camera keeps each mounted tile's existing temporary state, matching current tile-lifetime behavior.

## Component Design

`TileGrid` already identifies the focused tile with the `focused` prop and keeps all webviews mounted. No new focus state or data model is needed.

`WebviewTile` will derive an effective persistent zoom factor:

```ts
const persistentZoom = focused ? 1 : tile.zoom * globalZoom;
```

`computeFitScale` receives that factor as `manualZoom`. The existing temporary gesture calculation and final transform continue to multiply the resulting fit scale by `temporaryView.zoom`.

This keeps the behavior local to the component that composes the scale and avoids coupling focus-mode presentation to workspace persistence or reducer actions.

## Controls

The zoom controls remain visible and unchanged in focus mode. Adjusting them may update their saved values, but the focused page ignores those values until the user returns to grid mode. No new disabled state, tooltip, or explanatory UI is added.

## Error Handling

No new runtime error state is needed. The focused override uses the existing default factor of `1`, while `computeFitScale` retains its current positive-dimension validation.

## Verification

Component tests will verify:

- Grid mode still multiplies per-camera zoom by global **All** zoom.
- A focused tile uses a persistent factor of `1` even when both saved zoom values differ from `1`.
- Temporary pinch zoom still multiplies the focused fit scale.
- Leaving focused rendering restores the combined persistent zoom without remounting the webview.

Grid and browser tests will verify:

- Focus mode keeps every webview mounted.
- The selected tile expands while the others remain hidden.
- The focused transform ignores persistent grid zoom.
- Returning to the grid restores the previous combined zoom.
- The existing no-reload focus workflow continues to pass.

## Out Of Scope

- Changing or resetting stored zoom values.
- Disabling zoom controls while focused.
- Changing viewport dimensions or aspect-ratio settings.
- Changing temporary gesture sensitivity, pan limits, or reset shortcuts.
- Changing API focus/grid commands.
