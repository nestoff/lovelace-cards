# DITBrowse Modern UI And Session Reset Design

**Date:** 2026-07-09  
**Status:** Approved for implementation

## Summary

DITBrowse will keep its current browser-first layout while adopting the visual language of the modern Codex chat app. The tab row, command strip, and camera grid remain in their current order and retain their current behavior. The redesign changes the control system, surfaces, spacing, tooltips, dialogs, menus, editor, and status feedback across the entire app.

The cookie-clearing commands will become complete camera-session reset commands. They will clear site data, active HTTP authentication, temporary app authentication, and open network connections before loading cameras from their base addresses. Saved usernames and passwords remain available, but the first authentication after a reset requires an explicit **Sign in** action.

## Goals

- Keep the existing DITBrowse layout and browser workflow.
- Make the entire app feel visually consistent with the modern Codex chat app.
- Replace generic outlined pill buttons with quiet, modern control surfaces.
- Give every unfamiliar or icon-only control an accessible, descriptive tooltip.
- Make selected-camera and whole-list data clearing reliable across camera types.
- Reload reset cameras from their base addresses so each camera can choose its current landing page.
- Preserve saved usernames, passwords, jobs, lists, URLs, zoom, viewport, and tile state.
- Handle 10-15 simultaneous camera pages without losing authentication prompts.

## Non-Goals

- Changing the tab row, command strip, or camera-grid information architecture.
- Replacing Electron, React, or Electron webviews.
- Changing camera-list persistence or password storage format.
- Automatically saving redirect destinations into camera-list URLs.
- Deleting saved usernames or passwords as part of clearing cookies or site data.
- Adding a new theme selector in this pass.

## Visual Direction

### Structure

The current structure remains:

1. Camera tabs in a horizontal top row.
2. Browser navigation, address, layout, zoom, viewport, and focus controls in the command strip.
3. Equal-size camera tiles below the command strip.
4. Workspace tools in the existing overlay location.
5. Camera-list editing and authentication in dialogs or overlays.

No control changes location solely for the redesign.

### Design System

The visual system follows the modern Codex chat app:

- Near-black page and camera-grid canvas.
- Subtle differences between chrome, controls, selected controls, and elevated surfaces.
- Almost no persistent control borders; spacing and background contrast establish hierarchy.
- Borderless icon controls with soft hover backgrounds.
- Soft-filled rectangular command buttons with approximately 10px corner radii.
- Larger elevated surfaces and dialogs with approximately 14px corner radii.
- White primary actions, muted neutral secondary actions, restrained red destructive actions, and one cool focus/selection accent.
- System typography using the existing macOS font stack; no additional font dependency.
- No gradients, decorative glows, or pill styling applied indiscriminately.

Initial CSS tokens should be derived from the approved mockup:

| Token | Initial value | Use |
| --- | --- | --- |
| Window | `#080809` | Main canvas and deepest background |
| Chrome | `#111112` | Tabs and command strip |
| Surface | `#1d1d1f` | Inputs, buttons, menus, and dialogs |
| Hover | `#2a2a2d` | Hover and pressed feedback |
| Selected | `#303033` | Selected tabs and menu rows |
| Text | `#f1f1f2` | Primary text |
| Muted | `#a0a0a6` | Secondary text |
| Quiet | `#6f6f76` | Tertiary labels and shortcuts |
| Focus | `#7d9dee` | Selected tile and keyboard focus |
| Danger | `#e88c86` | Destructive actions and failures |

The final values may be tuned during screenshot review, but the contrast hierarchy and restrained color usage must remain.

### Controls

The current `PillButton` abstraction will be replaced by a neutral reusable button system with these variants:

- `ghost`: icon-only and low-emphasis actions, transparent until hover.
- `subtle`: ordinary commands on a soft filled surface.
- `primary`: the single preferred action in a dialog, using a light surface with dark text.
- `danger`: destructive commands using restrained danger text and hover feedback.

Browser navigation remains icon-only. Columns, zoom, viewport, and comparable controls use compact text-and-value buttons. Related controls may share alignment and spacing, but they must not become a wall of outlined capsules.

### Responsive Command Strip

The command strip must never overflow the right edge.

Priority order when horizontal space becomes constrained:

1. Keep navigation and the selected tile's address usable.
2. Keep the focus/full-page control available.
3. Compact labels such as `Viewport` while preserving their current values.
4. Move genuinely secondary actions into the existing workspace menu if necessary.

Tabs retain horizontal scrolling. Controls must have stable dimensions, and no hover, loading, tooltip, or status state may change the toolbar's height or shift neighboring controls.

## Tooltips

A single reusable tooltip component will replace CSS-generated `data-tooltip` content and duplicate native `title` tooltips.

Each tooltip contains:

- A short action title.
- One sentence describing the result in plain language.
- A keyboard shortcut when one exists.

Tooltip behavior:

- Appears after a short pointer-hover delay.
- Appears for keyboard focus without requiring a pointer.
- Uses a portal or equivalent positioning layer so it is not clipped by toolbars or panels.
- Automatically stays within the application window.
- Is connected with `aria-describedby` and does not replace the control's `aria-label`.
- Never contains the same text as the button without adding useful meaning.
- Does not intercept pointer input or resize surrounding layout.

Every icon-only action and every ambiguous control must have a tooltip. Ordinary labeled actions such as **Cancel** do not need redundant tooltips.

## Whole-App Application

The approved design system applies to:

- Camera tabs and tab actions.
- Browser navigation and address controls.
- Grid, zoom, viewport, and full-page controls.
- Workspace and job/list menus.
- Camera-list editor and its table controls.
- Saved-password and credential-preset management.
- Authentication dialogs and suggestions.
- Confirmation dialogs.
- Loading, empty, success, partial-success, and error states.

The camera web pages themselves are not restyled.

## Camera Base Address

The reset flow derives a base address from each tile's current live URL.

For HTTP and HTTPS URLs, the base address is:

```text
protocol + // + hostname + optional port + /
```

Examples:

- `http://10.20.100.108/rmt.html` becomes `http://10.20.100.108/`.
- `https://10.20.100.107:8443/index.html?mode=remote` becomes `https://10.20.100.107:8443/`.

Using the live URL ensures that a manually typed address is respected. Loading the root lets the camera redirect to `/rmt.html`, `/index.html`, HTTPS, or another current landing page. The redirect updates the tile and address bar only. It does not modify the saved camera-list URL unless the user explicitly selects **Save current URL**.

Non-HTTP URLs such as `about:blank` and invalid URLs cannot be session-reset targets and are reported as skipped.

## Selected Camera Reset

The selected-camera command will be labeled **Clear camera data** and described as clearing the selected camera's browsing session before reloading its base address.

The operation is atomic from the renderer's point of view:

1. Validate the selected tile and derive its base address and origin.
2. Mark the tile so its next HTTP-authentication challenge requires explicit confirmation.
3. Clear the selected guest page's in-memory `sessionStorage` and stop its in-flight navigation or requests.
4. Ask the Electron main process to clear data for the tile origin in its persistent partition.
5. Clear cookies, cache, file-system data, IndexedDB, local storage, service workers, WebSQL, and background-fetch data for that origin using Electron's thorough session data API. Connection closing remains enabled so affected origin connections do not preserve the old session.
6. Clear Electron/Chromium's HTTP authentication cache for the partition.
7. Clear DITBrowse's short-lived in-memory HTTP-authentication cache.
8. After cleanup succeeds, navigate only the selected tile to its base address.

Electron exposes HTTP-authentication clearing at session scope rather than origin scope. Because a camera list currently shares one persistent partition, clearing the selected camera also clears in-memory HTTP authentication for other tiles in that list. Other tiles remain loaded and are not reloaded. Their cookies and origin-specific site data remain intact.

If cleanup fails, the tile is not navigated away from its current page. The one-time manual-authentication marker is removed, and the UI reports the failure.

## Whole-List Reset

The whole-list command will be labeled **Clear list data** and requires confirmation because it signs every camera out.

After confirmation:

1. Snapshot the current list ID, tile order, and each tile's base address.
2. Mark every valid HTTP/HTTPS tile for one-time explicit authentication.
3. Clear in-memory `sessionStorage` in every open guest page and stop in-flight tile requests.
4. Clear all browsing data in the list's persistent partition.
5. Clear Electron/Chromium HTTP authentication, DITBrowse's temporary authentication cache, and open network connections.
6. Reload every valid tile from its base address in current row-major order.
7. Skip invalid or non-web URLs and report them in the result.

Reload starts in row-major order with a short stagger to avoid a single network burst. The operation does not wait for one camera to finish before starting the next because a slow or offline camera must not block the list.

If the active job or camera list changes before cleanup completes, stale reload work is cancelled. If cleanup succeeds but individual navigations fail, the UI reports partial success and identifies the affected cameras.

## Authentication After Reset

Saved password records and global credential presets are never deleted by either reset command.

For the first HTTP-authentication challenge after a reset:

- DITBrowse does not automatically submit a saved password.
- The sign-in dialog opens with the best matching saved values already filled.
- The user must select **Sign in** or **Cancel**.
- After that explicit decision, normal saved-password behavior resumes for the tile.

Form-based camera login pages may still receive best-effort field filling from the existing webview preload, but DITBrowse does not submit those forms automatically.

### Authentication Queue

HTTP-authentication requests are stored in a FIFO queue instead of one replaceable prompt state.

- Only the first request is shown.
- Submitting or cancelling advances to the next request.
- Closing a tile, changing lists, or closing the app cancels affected queued requests by sending an empty authentication response.
- Requests waiting behind another prompt must not be silently overwritten or expire under the existing short prompt timeout.
- Duplicate bursts for the same tile and challenge may reuse the existing short-lived in-memory response after the user explicitly signs in.

This queue applies generally, not only during clear-list reloads, because opening many cameras can create the same authentication race.

## Status And Error Handling

Reset controls are disabled while their operation is running. Repeated clicks cannot create overlapping cleanup operations.

Status feedback must distinguish:

- Clearing data.
- Reloading from a base address.
- Complete success.
- Partial list success.
- Cleanup failure.
- Skipped invalid or non-web URLs.

The selected-camera success message includes the base address used. The whole-list result includes counts for reloaded and skipped cameras. Messages use the same compact Codex-style elevated surface and must not cover essential toolbar controls.

## Data And Persistence

The redesign does not change the workspace schema.

The following remain persisted exactly as before:

- Jobs and camera lists.
- Camera URLs and prefix-following choices.
- Camera metadata.
- Tile order and selected tile.
- Zoom and viewport settings.
- Saved password records and credential presets.
- Persistent session data until a reset command removes it.

One-time manual-authentication markers, operation progress, notifications, and queued authentication requests are runtime-only state and are never saved.

## Component Boundaries

The implementation should keep these responsibilities separate:

- Electron session module: persistent session-data clearing, auth-cache clearing, and list-wide connection closing.
- Electron main process: IPC registration and temporary HTTP-authentication cache coordination.
- Shared URL helper: safe base-address derivation.
- Renderer session-reset coordinator: guest `sessionStorage` cleanup, operation state, stale-operation protection, tile marking, ordered reload dispatch, and result messages.
- Authentication queue hook or reducer: queued request lifecycle and current dialog state.
- Reusable UI controls: button variants, tooltip, dialog, menu row, status message, and confirmation dialog.
- Existing browser and editor components: compose reusable controls without owning session internals.

These boundaries keep UI styling independent from Electron session behavior and make each part testable without loading real camera pages.

## Testing

### Unit Tests

- Base-address extraction preserves protocol and port and removes path, query, and fragment.
- Invalid and non-HTTP URLs are rejected safely.
- Selected reset calls Electron's thorough data clearing for only the selected origin.
- List reset clears the complete partition.
- Both reset scopes clear HTTP authentication, temporary app authentication, and network connections.
- Guest-page `sessionStorage` is cleared without destroying or replacing webviews.
- Cleanup failure prevents navigation.
- Saved password records and credential presets are unchanged.
- One-time manual authentication suppresses automatic submission once and then clears.
- Authentication requests queue, submit, cancel, deduplicate, and advance correctly.
- List reload order matches the current tile row order.
- Stale operations do not reload a newly selected list.
- Partial results identify invalid or failed cameras.

### Component Tests

- Icon-only controls have accessible labels and descriptive tooltip content.
- Tooltips open on delayed hover and keyboard focus and close on escape, blur, and pointer exit.
- Tooltip positioning does not alter toolbar geometry.
- Reset controls expose busy and disabled states.
- List reset requires confirmation.
- Status messages distinguish success, partial success, and failure.
- The toolbar remains within representative desktop widths without horizontal page overflow.

### Electron Integration And Manual Verification

- Run local mock camera servers that set cookies, store local data, require HTTP authentication, and redirect from `/` to camera-specific landing pages.
- Verify selected reset shows explicit sign-in and reloads the correct base address.
- Verify list reset reloads every open mock camera and preserves saved password records.
- Verify a mock camera that stores login state in `sessionStorage` is signed out by both reset scopes.
- Verify multiple authentication challenges are presented in order.
- Package and launch a fresh macOS Electron app because main-process, preload, and IPC changes cannot be validated by renderer hot reload alone.
- Capture screenshots at wide and compact desktop sizes and inspect tabs, command strip, workspace menu, camera editor, sign-in dialog, confirmations, status messages, and tooltip placement.

## Acceptance Criteria

The work is complete when:

1. The app retains its current layout but the entire interface matches the approved Codex-inspired visual direction.
2. No command-strip control is clipped or runs beyond the right window edge at supported sizes.
3. Every icon-only or ambiguous control has an accessible tooltip with a useful description.
4. Clearing a selected camera removes its persistent and in-memory browsing data and active authentication, preserves saved credentials, and reloads only that tile from its base address.
5. Clearing a list removes list-wide persistent and in-memory browsing data and authentication, preserves saved credentials, and reloads all valid tiles from their base addresses.
6. The first HTTP-authentication challenge after either reset requires an explicit **Sign in** action with saved values available.
7. Multiple camera authentication requests cannot overwrite each other.
8. Camera redirects update live tile URLs without silently changing saved camera-list URLs.
9. Failures and partial results are visible and actionable.
10. Unit, component, build, and packaged-app verification pass.
