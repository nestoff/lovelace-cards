# Toolbar, Startup, Session, and Sign-In Cleanup Design

## Goal

Remove leftover visual clutter and blue accents, prevent sample camera pages from appearing during startup, consolidate camera session commands on the main page, and provide a correctly routed one-click camera sign-in action.

## Scope and structure

This is one coordinated operator-flow cleanup with four bounded units:

1. Main-toolbar appearance and resolution controls.
2. Workspace bootstrap before any live camera webviews mount.
3. Scoped camera reload/sign-out/credential commands.
4. Correctly routed HTTP-auth prompts with paired one-click credentials.

Each unit has its own state boundary and regression coverage. Existing camera numbering, Companion commands, camera-list editing, workspace file format, and global credential presets remain compatible.

## Neutral visual system

- Remove the blue accent family from focus rings, active states, table selection, sliders, checkboxes, selected tiles, and camera-number labels.
- Use `#c8c8ce` for visible keyboard focus, `#b7b7bd` for neutral accents, `#f1f1f2` for strong accents, and white-alpha fills for selected/pressed states.
- Preserve sufficient contrast for keyboard users; focus indication is recolored, not removed.
- Keep the existing dark graphite surfaces and typography.
- Keep coral red only for destructive actions and the existing warning color for warnings.
- Delete the unused `--accent-cyan` token and replace hard-coded blue alpha values with neutral equivalents.

## Main-toolbar cleanup

### Remove redundant selected-camera status

- Remove the stacked-squares icon and truncated selected-camera title from the layout-control group.
- Camera identity remains visible in the active tab and each camera tile header, so no information is lost.

### One resolution control

- Remove the separate `Default` aspect-ratio dropdown.
- Remove the separate all-view resolution popover.
- Keep one `Resolution` dropdown for the selected camera.
- Format options as full resolution plus ratio, for example `1024×768 · 4:3` and `1920×1080 · 16:9`.
- Selecting a value changes only the selected camera and preserves its per-camera override behavior.
- Add an adjacent `Apply to All` action.
- `Apply to All` applies the currently selected resolution to every open camera, makes it the workspace default for future inherited cameras, and clears per-camera viewport overrides, matching the existing global-resolution behavior.
- Disable selected-resolution controls when no camera tile is selected.

### Camera Session dropdown

- Replace the existing toolbar Reload and Reload All icon buttons with one labeled `Camera Session` dropdown on the main page.
- Menu items appear in this order:
  1. `Reload selected` — reloads the selected camera from its root address and preserves all sessions and credentials.
  2. `Reload all` — staggered reload of every open camera and preserves all sessions and credentials.
  3. Separator.
  4. `Sign out, forget login & reload selected` — destructive selected-camera reset.
  5. `Sign out, forget active-list logins & reload all…` — destructive active-list reset with confirmation.
- Keep Command-R mapped to non-destructive `Reload selected`.
- The dropdown remains usable without opening Settings.

## Session and password semantics

### Selected camera

`Sign out, forget login & reload selected` performs one ordered operation:

1. Stop the selected webview and clear its in-page session state.
2. Clear the selected camera origin's cookies, site data, authentication cache, and connections.
3. After cleanup succeeds, delete saved password records matching the selected tile's camera ID within the active job and camera list. Use normalized origin only as a fallback for legacy or unlinked records that have no camera ID.
4. Reload the camera's base address.
5. Require explicit sign-in on the next authentication challenge.

If session cleanup fails, do not delete the tile password and do not navigate away from the current page. If cleanup succeeds but reload fails, the password remains deleted because the sign-out already completed; report the reload failure.

### Active camera list

`Sign out, forget active-list logins & reload all…` requires confirmation and performs:

1. Clear in-page session state for all open camera tiles.
2. Clear the active list partition's cookies, site data, authentication cache, and connections.
3. After partition cleanup succeeds, delete saved password records scoped only to the active job and active camera list.
4. Stagger reloads from each valid camera base address.
5. Report skipped or failed reloads without restoring credentials after successful sign-out.

Global credential presets and password records belonging to other jobs or camera lists are never deleted by these actions.

### Settings cleanup

- Remove `Sign Out & Reload Camera` and `Sign Out & Reload All` from workspace Settings.
- Remove `Forget Selected Tile Password` from workspace Settings.
- Keep the saved-camera-password list and its per-record Delete actions for manual administration.
- Keep global credential-preset management in Settings.

## Startup behavior

- Do not mount BrowserChrome, TileGrid, or any `<webview>` while the saved workspace is loading.
- Show a neutral dark boot surface during the workspace read and normalization step.
- Normalize the loaded workspace through the same migration path currently used by reducer hydration.
- Mount the live application only after normalized saved state is available.
- The bundled sample workspace is allowed only when storage genuinely returns it for a first run; it is never used as an intermediate renderer placeholder.
- No `192.168.1.*` sample URL may be assigned to a webview when a saved workspace exists.
- If loading fails, show a concise `Workspace could not be loaded` message with a Retry button and continue to mount zero webviews.
- Make bootstrap loading cancellable/idempotent so React development StrictMode cannot race two loads.

## One-click camera sign-in

### Correct prompt routing

- Carry the originating guest `webContentsId` from Electron's login event through `HttpAuthRequest`.
- Resolve the originating tile by matching that ID to the mounted webview before using normalized URL origin as a fallback.
- Use the selected tile only as the final fallback when neither origin source is available.
- This prevents simultaneous or same-origin prompts from being attached to the wrong camera.

### Paired credential actions

- Replace separate username and password suggestion groups with paired credential actions.
- Put an exact camera-type match first and style it as the recommended action.
- Label the primary action clearly, for example `Use VENICE 2 login & Sign In`.
- One click sends the paired username and password to the current HTTP-auth request, honors `Save for this camera`, stores the credential when enabled, closes the current prompt, and advances the queued prompt.
- Other presets appear as paired alternatives labeled by camera type and username.
- Never expose a raw password in a suggestion label.
- Keep manual username/password fields and the ordinary Sign In button as fallback.
- Never submit a preset without an explicit operator click.

### In-page HTML login forms

This change targets DIT Browse's `Camera sign in` HTTP-auth dialog. Existing best-effort filling of in-page HTML username/password fields remains, but arbitrary camera-page forms are not auto-submitted because custom controls, iframes, and ambiguous forms cannot be handled safely without camera-specific adapters.

## Error handling and status

- Disable session commands while a reset is already running.
- Keep confirmation for the active-list destructive action.
- Use existing progress/status notices for reset progress, success, partial reload, and failure.
- Error messages distinguish cleanup failure from reload failure.
- Closing or cancelling an auth prompt sends an empty response exactly once and advances the queue safely.

## Regression coverage

- Neutral palette test: no legacy blue tokens or raw blue alpha values remain; visible focus styles still exist.
- Toolbar tests: redundant selected-camera status and duplicate aspect/default controls are absent; one Resolution dropdown and Apply to All remain.
- Resolution behavior tests: selected change affects only the selected camera; Apply to All updates every tile, default, and overrides exactly once.
- Startup tests: a deferred workspace read mounts no BrowserChrome, TileGrid, webview, or sample URL; success mounts only saved state; failure shows Retry with zero webviews.
- Control-status test: the first published status comes from saved state, never the intermediate sample workspace.
- Reload tests: Reload selected/all never clear sessions or credentials.
- Selected destructive test: successful cleanup deletes only the selected camera/origin record and reloads; failed cleanup retains the password and page.
- Active-list destructive test: deletes only active job/list password records after partition cleanup, preserves global presets and other scopes, confirms first, and reports partial reloads.
- Auth routing tests: guest `webContentsId` wins over selected-tile and origin fallbacks.
- One-click sign-in tests: exact type match appears first, submits one paired credential, honors Save, never exposes password text, and advances queued prompts.
- Existing Companion, focus/grid, camera-list, workspace, and Electron session-reset suites continue to pass.

## Packaging and installation constraints

- Use the existing explicit-opt-in notarization safeguard.
- Do not notarize unless the user explicitly requests notarization in a later message.
- Developer ID sign with `Developer ID Application: Adam Lighterman (8BWXULM784)`.
- Verify the candidate has no stapled notarization ticket.
- Back up and replace `/Applications/DITBrowse.app`, relaunch it, and verify the local API plus Companion WebSocket connection.

## Out of scope

- No changes to Companion protocol commands or camera-number identity.
- No changes to saved workspace JSON format beyond preserving existing normalization.
- No background automatic submission of HTTP-auth presets.
- No automatic submission of arbitrary in-page HTML login forms.
