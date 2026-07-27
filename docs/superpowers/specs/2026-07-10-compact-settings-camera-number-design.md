# Compact Settings and Camera Number Design

## Goal

Make the workspace settings substantially more compact on wide displays and show each configured camera's integer number in its tile top bar, without changing camera behavior or stored workspace data.

## Approved layout

- Keep the camera table and editor header full width.
- Center only the workspace settings area and cap it at `960px`.
- Keep settings sections in their existing stacked order so the workflow and tab order do not change.
- Reduce settings section padding from `16px` to `12px` and internal gaps from `10px` to `8px`.
- Constrain controls that have intrinsically short values, including the current job name, credential-preset fields, and API port, instead of stretching them across the available width.
- Below the `960px` content limit, let settings use the available editor width and retain the existing responsive stacking rules.
- Continue using the current DIT Browse palette, typography, separators, and control components. Compactness comes from width, spacing, and field sizing rather than new decorative cards.

## Camera number in the tile top bar

- The number comes from the active camera list's configured camera-number field (`CameraEntry.suffix`).
- Parse the stored value as a positive integer so values such as `"01"` display as `CAM 1`.
- Build the camera-ID-to-number lookup from the active camera list without adding camera numbers to persisted `TileState` data.
- Pass the lookup from `App` through `TileGrid` to `WebviewTile`.
- Keep the existing tile title left aligned and ellipsized.
- Center a compact `CAM <number>` label in the existing 24px tile top bar.
- Do not display a number for blank tiles, manually added tiles without a linked camera, or invalid camera-number values.
- The same header is used in grid and expanded modes, so the number remains visible in both.
- Do not change Companion titles, variables, presets, or camera identity behavior.

## Accessibility and responsive behavior

- Expose the visible camera number as normal text rather than decorative content.
- Preserve the existing tile activation label and keyboard behavior.
- Prevent the centered camera number and left title from overlapping by using a three-column header layout with symmetric outer tracks and an ellipsized title.
- Preserve full-width settings below `960px` with no document-level horizontal overflow.

## Regression coverage

- Add component coverage showing `CAM 1` for a linked camera stored as `"01"`.
- Add component coverage confirming blank or unlinked tiles omit the camera number.
- Add grid coverage confirming the camera-number lookup reaches the correct tile after reordering.
- Add Playwright coverage at a `2048px` viewport asserting that workspace settings are no wider than `960px`, are centered relative to the editor content, and do not create horizontal overflow.
- Keep existing workspace, camera-grid, focus-mode, and Companion integration tests passing.

## Packaging and installation constraints

- Developer ID sign the macOS app with `Developer ID Application: Adam Lighterman (8BWXULM784)` so the stable Keychain identity is retained.
- Do not notarize unless the user explicitly requests notarization in a later message.
- Change the signing workflow so notarization is explicit opt-in rather than inferred from credentials present in the environment.
- Back up the installed app, replace `/Applications/DITBrowse.app` with the verified candidate, relaunch it, and verify the local API and Companion WebSocket connection.

## Out of scope

- No changes to camera numbering rules, Companion actions, workspace persistence, password storage, camera titles, or the browser-tab ordering badge.
- No redesign of the camera table or application chrome.
