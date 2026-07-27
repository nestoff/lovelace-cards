# Bitfocus Companion Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a loopback-only WebSocket control protocol to DIT Browse and build a complete Bitfocus Companion module with integer camera actions, live state, and a persistent-grid expansion toggle.

**Architecture:** Extend the existing DIT Browse HTTP control server with a `ws` upgrade endpoint and route both transports through the current Electron renderer dispatcher. Publish renderer status through a context-isolated IPC bridge, then consume the versioned protocol from a self-contained Node 22 Companion module whose connection engine is isolated from Companion definitions for deterministic tests.

**Tech Stack:** Electron 42, React 19, TypeScript, Vitest, `ws` 8, Bitfocus `@companion-module/base` 2.0.4, Node 22, Yarn 4.

## Global Constraints

- Bind DIT Browse control traffic only to `127.0.0.1`.
- Do not add access tokens, passwords, secrets, authorization headers, host configuration, TLS, LAN mode, or discovery.
- The WebSocket protocol and Companion module identify cameras only with positive integer numbers.
- The Companion Focus Camera action uses a number field and does not support variable expansion.
- Keep the existing HTTP routes and normalize legacy padded inputs such as `01` at the HTTP boundary.
- Turning expansion mode off immediately shows the grid and prevents local or remote focus until expansion is enabled again.
- Focus Camera is a successful no-op while expansion mode is off.
- Never replay action commands after reconnect.
- Use the official TypeScript template versions: Node `^22.20`, Yarn `^4`, and `@companion-module/base` `2.0.4`.
- Do not create a nested Git repository inside `companion-module-lightlab-ditbrowse/`.

---

## File Structure

### DIT Browse

- Modify `package.json` and `package-lock.json`: add WebSocket runtime and type dependencies.
- Modify `src/shared/controlApi.ts`: integer camera model, expansion state, and shared commands.
- Create `src/shared/controlProtocol.ts`: WebSocket constants, envelopes, strict runtime parsing, and result conversion.
- Modify `src/shared/controlApi.test.ts`: integer camera/status tests.
- Create `src/shared/controlProtocol.test.ts`: protocol validation tests.
- Modify `src/electron/controlApiServer.ts`: HTTP compatibility plus WebSocket upgrade, handshake, health, status broadcast, and shutdown.
- Modify `src/electron/controlApiServer.test.ts`: HTTP normalization and WebSocket lifecycle tests.
- Modify `src/electron/controlApiConfig.ts` and `src/electron/controlApiConfig.test.ts`: first-run default port `52780`.
- Modify `src/electron/main.ts`: cache and broadcast renderer status.
- Modify `src/electron/preload.cts`: expose status publication.
- Modify `src/renderer/state/workspaceStorage.ts`: type the new bridge method.
- Modify `src/renderer/App.tsx`: expansion gate, command behavior, and status publication.
- Modify `src/renderer/App.test.tsx`: renderer command and publication behavior.
- Modify `src/renderer/components/BrowserChrome.tsx`: pass expansion availability to the toolbar.
- Modify `src/renderer/components/BrowserToolbar.tsx`: disable and explain focus while expansion is off.
- Modify `src/renderer/components/BrowserChrome.test.tsx`: toolbar lock behavior.
- Modify `src/renderer/components/WorkspaceSettings.tsx`: show the Companion WebSocket endpoint and integer HTTP examples.

### Companion module

- Create `companion-module-lightlab-ditbrowse/package.json`, `yarn.lock`, TypeScript, ESLint, Prettier, Vitest, and ignore configuration from the current official template.
- Create `companion-module-lightlab-ditbrowse/companion/manifest.json`, `HELP.md`, and `LICENSE`.
- Create `companion-module-lightlab-ditbrowse/src/protocol.ts`: protocol types and parser.
- Create `companion-module-lightlab-ditbrowse/src/state.ts`: state normalization, revision ordering, catalog comparison, and variable values.
- Create `companion-module-lightlab-ditbrowse/src/connection.ts`: WebSocket lifecycle and request correlation.
- Create `companion-module-lightlab-ditbrowse/src/config.ts`: port and debug fields.
- Create `companion-module-lightlab-ditbrowse/src/actions.ts`: four actions.
- Create `companion-module-lightlab-ditbrowse/src/feedbacks.ts`: five boolean feedbacks.
- Create `companion-module-lightlab-ditbrowse/src/variables.ts`: ten variables.
- Create `companion-module-lightlab-ditbrowse/src/presets.ts`: grid, expansion, and camera presets.
- Create `companion-module-lightlab-ditbrowse/src/upgrades.ts`: stable empty upgrade list for version 0.1.0.
- Create `companion-module-lightlab-ditbrowse/src/main.ts`: Companion lifecycle integration.
- Create focused tests under `companion-module-lightlab-ditbrowse/test/`.

---

### Task 1: Integer Control Contract and Protocol Parser

**Files:**
- Modify: `src/shared/controlApi.ts`
- Modify: `src/shared/controlApi.test.ts`
- Create: `src/shared/controlProtocol.ts`
- Create: `src/shared/controlProtocol.test.ts`

**Interfaces:**
- Produces: `ControlApiCommand` with `{ type: "focusCamera"; cameraNumber: number }` and `{ type: "toggleExpansion" }` variants.
- Produces: `ControlApiStatus.expansionEnabled`, `ControlApiStatus.selectedCameraNumber`, and numeric tab camera numbers.
- Produces: `parseControlProtocolClientMessage(value: unknown): ControlProtocolClientMessage | ControlProtocolParseError`.
- Produces: `toControlProtocolResult(requestId: string, response: ControlApiResponse): ControlProtocolResult`.
- Consumes: existing `WorkspaceState`, `TileState`, and HTTP-compatible `focusTab` command.

- [ ] **Step 1: Write failing integer camera and status tests**

Add cases that call `resolveControlApiCamera(sampleWorkspace, 4)`, reject `0`, fractions, and unsafe integers, and expect status like:

```ts
expect(buildControlApiStatus(sampleWorkspace, {
  expansionEnabled: true,
  focusMode: true
})).toMatchObject({
  expansionEnabled: true,
  focusMode: true,
  selectedCameraNumber: 1,
  tabs: [expect.objectContaining({ cameraNumber: 1 })]
});
```

- [ ] **Step 2: Run the focused shared tests and verify failure**

Run: `npm test -- src/shared/controlApi.test.ts src/shared/controlProtocol.test.ts`

Expected: failure because numeric commands, expansion state, and `controlProtocol.ts` do not exist.

- [ ] **Step 3: Implement the shared integer model**

Use these exact public shapes:

```ts
export type ControlApiCommand =
  | { requestId: string; type: "status" }
  | { requestId: string; type: "focusTab"; specifier: string }
  | { requestId: string; type: "focusCamera"; cameraNumber: number }
  | { requestId: string; type: "showGrid" }
  | { requestId: string; type: "toggleExpansion" };

export interface ControlApiViewState {
  expansionEnabled: boolean;
  focusMode: boolean;
}

export interface ControlApiStatus {
  expansionEnabled: boolean;
  focusMode: boolean;
  selectedCameraNumber: number | null;
  selectedTileId: string | null;
  selectedIndex: number | null;
  tabs: ControlApiStatusTab[];
}
```

Add `parsePositiveCameraNumber(value: unknown): number | null` using `Number.isSafeInteger(value) && value >= 1`. Convert stored suffixes with a separate strict digit-string helper so internal metadata such as `"04"` becomes `4`, while non-numeric suffixes are excluded. Change `buildControlApiStatus(workspace, viewState)` to use the new view-state object.

- [ ] **Step 4: Implement strict WebSocket protocol parsing**

Define:

```ts
export const CONTROL_PROTOCOL = "ditbrowse.control";
export const CONTROL_PROTOCOL_VERSION = 1;
export const CONTROL_WEBSOCKET_PATH = "/api/ws";

export type ControlProtocolClientMessage =
  | ControlProtocolClientHello
  | ControlProtocolCommandMessage;

export type ControlProtocolServerMessage =
  | ControlProtocolServerHello
  | ControlProtocolResult
  | ControlProtocolStatusEvent
  | ControlProtocolError;
```

The parser must accept only a valid hello or a command envelope with a non-empty string `requestId`. Supported WebSocket commands are `status`, `focusCamera`, `showGrid`, and `toggleExpansion`; reject `focusTab`. Reject camera strings, fractions, zero, and negative numbers. Convert the flat internal `ControlApiResponse` failure into `{ ok: false, error: { code, message } }`.

- [ ] **Step 5: Run focused tests and typecheck**

Run: `npm test -- src/shared/controlApi.test.ts src/shared/controlProtocol.test.ts`

Expected: all focused tests pass.

Run: `npm run typecheck`

Expected: failures only in existing callers that still pass string camera numbers or the old status-builder arguments; these are deliberately repaired in Tasks 2 and 4.

- [ ] **Step 6: Commit the shared contract**

```bash
git add src/shared/controlApi.ts src/shared/controlApi.test.ts src/shared/controlProtocol.ts src/shared/controlProtocol.test.ts
git commit -m "feat: define Companion control protocol"
```

---

### Task 2: Loopback WebSocket Server and HTTP Compatibility

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `src/electron/controlApiServer.ts`
- Modify: `src/electron/controlApiServer.test.ts`
- Modify: `src/electron/controlApiConfig.ts`
- Modify: `src/electron/controlApiConfig.test.ts`

**Interfaces:**
- Consumes: `parseControlProtocolClientMessage`, protocol constants, and shared commands from Task 1.
- Produces: `ControlApiServer.publishStatus(status: ControlApiStatus, revision: number): void`.
- Produces: `ControlApiServer.clientCount: number` getter.
- Preserves: `host`, `port`, `baseUrl`, and `close(): Promise<void>`.

- [ ] **Step 1: Install DIT Browse WebSocket dependencies**

Run: `npm install ws@^8`

Run: `npm install --save-dev @types/ws@^8`

Expected: `package.json` and `package-lock.json` contain `ws` and `@types/ws`.

- [ ] **Step 2: Write failing HTTP normalization and WebSocket tests**

Update HTTP assertions so `/api/focus/01` dispatches `cameraNumber: 1`. Add a `ws` test client that verifies:

```ts
socket.send(JSON.stringify({
  type: "hello",
  protocol: "ditbrowse.control",
  protocolVersion: 1,
  client: { name: "test", version: "1.0.0" }
}));
```

receives a server hello, a valid camera command dispatches integer `4`, a string camera returns `bad_request`, `publishStatus(status, 7)` emits revision 7, and `close()` terminates the client.

- [ ] **Step 3: Run server tests and verify failure**

Run: `npm test -- src/electron/controlApiServer.test.ts src/electron/controlApiConfig.test.ts`

Expected: failure because HTTP still dispatches strings and WebSocket support is absent.

- [ ] **Step 4: Normalize legacy HTTP camera values**

Add a boundary helper that accepts string or number HTTP values, requires decimal digits after trimming, converts with `Number`, and validates with `parsePositiveCameraNumber`. Return `bad_request` for invalid camera values instead of falling through to tab lookup when a camera key was explicitly supplied.

Preserve `/api/tabs/:specifier/focus`, `?tab=`, and `{ "tab": ... }` compatibility exactly.

- [ ] **Step 5: Add the WebSocket upgrade server**

Create `new WebSocketServer({ noServer: true })`, accept upgrades only for `/api/ws`, and track per-client state:

```ts
interface ClientState {
  handshaken: boolean;
  alive: boolean;
}
```

Require hello before commands. Send a server hello with app identity and the approved capabilities. Dispatch parsed commands, preserve the external request ID in the result envelope, and never expose `focusTab` through WebSocket.

Start a 15-second unref'd health interval. Set `alive = false` before ping, mark true on pong, and terminate clients that miss two health checks. Ensure all event listeners, sockets, the interval, WebSocket server, and HTTP server close cleanly.

- [ ] **Step 6: Add revisioned status caching and broadcast**

`publishStatus(status, revision)` stores the latest event and sends it to every open, handshaken client. Send the cached event immediately after a successful hello. Expose `clientCount` as the number of open WebSocket clients.

- [ ] **Step 7: Set first-run port default**

Export `DEFAULT_CONTROL_API_PORT = 52780`. When the config file does not exist, `loadControlApiConfig()` returns `{ port: 52780 }`. Preserve an explicitly saved `null` as automatic-port mode and preserve current port validation.

- [ ] **Step 8: Run server tests and typecheck**

Run: `npm test -- src/electron/controlApiServer.test.ts src/electron/controlApiConfig.test.ts`

Expected: all server/config tests pass with no leaked handles.

Run: `npm run typecheck`

Expected: only renderer/main callers scheduled for Tasks 3 and 4 may still fail.

- [ ] **Step 9: Commit the server transport**

```bash
git add package.json package-lock.json src/electron/controlApiServer.ts src/electron/controlApiServer.test.ts src/electron/controlApiConfig.ts src/electron/controlApiConfig.test.ts
git commit -m "feat: add loopback WebSocket control server"
```

---

### Task 3: Electron Status Publication Bridge

**Files:**
- Modify: `src/electron/main.ts`
- Modify: `src/electron/preload.cts`
- Modify: `src/renderer/state/workspaceStorage.ts`

**Interfaces:**
- Consumes: `ControlApiStatus` and `ControlApiServer.publishStatus()`.
- Produces: `window.ditbrowse.publishControlApiStatus(status: ControlApiStatus): void`.

- [ ] **Step 1: Add the typed preload bridge**

Expose:

```ts
publishControlApiStatus: (status: ControlApiStatus) => {
  ipcRenderer.send("control-api:status", status);
}
```

Add the same optional method to the renderer's global `Window` interface.

- [ ] **Step 2: Cache and broadcast renderer status in Electron main**

Add:

```ts
let latestControlApiStatus: ControlApiStatus | null = null;
let controlApiStatusRevision = 0;
```

Handle `control-api:status` by caching the complete snapshot, incrementing the revision, and calling `controlApiServer?.publishStatus(status, revision)`. After a server restart, seed `nextServer` with the cached status and current revision before assigning it as active.

- [ ] **Step 3: Keep command response publication ordered**

When a renderer command response includes status, update the cached snapshot and publish it before resolving the pending request. The renderer's later identical status publication may be deduplicated with a structural equality check so one logical state change does not advance the revision twice.

- [ ] **Step 4: Run Electron typecheck and preload tests**

Run: `npm test -- src/electron/preloadPaths.test.ts`

Expected: pass.

Run: `npm run typecheck`

Expected: remaining errors are limited to renderer control handling updated in Task 4.

- [ ] **Step 5: Commit the bridge**

```bash
git add src/electron/main.ts src/electron/preload.cts src/renderer/state/workspaceStorage.ts
git commit -m "feat: publish control status from renderer"
```

---

### Task 4: Renderer Expansion Gate and Live Status

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/App.test.tsx`
- Modify: `src/renderer/components/BrowserChrome.tsx`
- Modify: `src/renderer/components/BrowserToolbar.tsx`
- Modify: `src/renderer/components/BrowserChrome.test.tsx`
- Modify: `src/renderer/components/WorkspaceSettings.tsx`

**Interfaces:**
- Consumes: numeric shared commands and `publishControlApiStatus()`.
- Produces: session-scoped `expansionEnabled` behavior for local and remote controls.
- Produces: `BrowserChrome.expansionEnabled` and `BrowserToolbar.expansionEnabled` props.

- [ ] **Step 1: Write failing renderer command tests**

Update focus calls to `cameraNumber: 2`. Capture `publishControlApiStatus` calls. Add a test sequence:

```ts
controlApiCommandHandler?.({ requestId: "focus-1", type: "focusCamera", cameraNumber: 2 });
controlApiCommandHandler?.({ requestId: "lock-1", type: "toggleExpansion" });
controlApiCommandHandler?.({ requestId: "focus-2", type: "focusCamera", cameraNumber: 3 });
```

Assert the grid appears immediately after `lock-1`, the selected address does not change after `focus-2`, both commands return success, and the final status has `expansionEnabled: false` and `focusMode: false`.

Add toolbar tests that expansion-off disables the focus button and exposes a tooltip explaining that Companion has locked the grid.

- [ ] **Step 2: Run focused renderer tests and verify failure**

Run: `npm test -- src/renderer/App.test.tsx src/renderer/components/BrowserChrome.test.tsx`

Expected: failure because expansion state and publication are absent.

- [ ] **Step 3: Add session-scoped expansion state and synchronous refs**

Add `expansionEnabled` state defaulting to true and an `expansionEnabledRef`. Local focus toggling must return immediately when expansion is disabled. Toggle commands must update the ref synchronously so back-to-back commands observe the latest value.

Command rules:

```ts
if (command.type === "toggleExpansion") {
  const nextEnabled = !expansionEnabledRef.current;
  expansionEnabledRef.current = nextEnabled;
  setExpansionEnabled(nextEnabled);
  if (!nextEnabled) setFocusMode(false);
  respondWithComputedStatus(nextEnabled, nextEnabled ? currentFocusMode : false);
  return;
}

if (command.type === "focusCamera" && !expansionEnabledRef.current) {
  respondWithCurrentSuccessfulStatus();
  return;
}
```

Keep legacy `focusTab` behavior behind the same expansion gate because persistent grid mode applies globally even though Companion never emits that command.

- [ ] **Step 4: Publish only control-relevant status**

Memoize `buildControlApiStatus()` from these dependencies only: tiles, camera lists, active camera-list ID, selected tile ID, effective focus mode, and expansion state. Publish it after workspace hydration and whenever that memoized status changes. Do not depend on password records, credential presets, editor state, reset notices, or authentication queue state.

- [ ] **Step 5: Lock the local toolbar focus control**

Pass `expansionEnabled` through `BrowserChrome` to `BrowserToolbar`. Disable the focus button when there is no selection or expansion is disabled. When disabled by expansion, use tooltip copy:

```text
Expansion locked
Companion expansion mode is off, so the camera grid stays visible.
```

Leaving focus mode remains possible only through Show Grid before the disabling transition; disabling itself already forces grid mode.

- [ ] **Step 6: Update Local API settings copy**

Show the WebSocket URL derived from the current port, retain `GET /api/focus/1`, retain `GET /api/grid`, and explain that Companion connects locally with integer camera numbers. Do not add host or token inputs.

- [ ] **Step 7: Run renderer tests, full tests, and typecheck**

Run: `npm test -- src/renderer/App.test.tsx src/renderer/components/BrowserChrome.test.tsx`

Expected: pass.

Run: `npm test`

Expected: all DIT Browse tests pass.

Run: `npm run typecheck`

Expected: pass with no TypeScript errors.

- [ ] **Step 8: Commit renderer behavior**

```bash
git add src/renderer/App.tsx src/renderer/App.test.tsx src/renderer/components/BrowserChrome.tsx src/renderer/components/BrowserToolbar.tsx src/renderer/components/BrowserChrome.test.tsx src/renderer/components/WorkspaceSettings.tsx
git commit -m "feat: add persistent grid expansion mode"
```

---

### Task 5: Scaffold and Test the Companion Protocol Engine

**Files:**
- Create: `companion-module-lightlab-ditbrowse/package.json`
- Create: `companion-module-lightlab-ditbrowse/yarn.lock`
- Create: `companion-module-lightlab-ditbrowse/tsconfig.json`
- Create: `companion-module-lightlab-ditbrowse/tsconfig.build.json`
- Create: `companion-module-lightlab-ditbrowse/eslint.config.mjs`
- Create: `companion-module-lightlab-ditbrowse/vitest.config.ts`
- Create: `companion-module-lightlab-ditbrowse/.gitignore`
- Create: `companion-module-lightlab-ditbrowse/.prettierignore`
- Create: `companion-module-lightlab-ditbrowse/src/protocol.ts`
- Create: `companion-module-lightlab-ditbrowse/src/state.ts`
- Create: `companion-module-lightlab-ditbrowse/src/connection.ts`
- Create: `companion-module-lightlab-ditbrowse/test/protocol.test.ts`
- Create: `companion-module-lightlab-ditbrowse/test/state.test.ts`
- Create: `companion-module-lightlab-ditbrowse/test/connection.test.ts`

**Interfaces:**
- Produces: `DitBrowseConnection` independent of `InstanceBase`.
- Produces: `applyStatus(previous, incoming, revision?)` with stale-revision protection.
- Produces: `cameraCatalog(status)` containing unique integer cameras in tab order.
- Consumes: `ws` client and protocol V1.

- [ ] **Step 1: Copy current template build configuration and customize package metadata**

Use package name `companion-module-lightlab-ditbrowse`, version `0.1.0`, `main: dist/main.js`, and scripts for `build`, `dev`, `lint`, `test`, `typecheck`, and `package`. Keep template engine constraints and add:

```json
{
  "dependencies": {
    "@companion-module/base": "2.0.4",
    "ws": "^8.18.3"
  },
  "devDependencies": {
    "@companion-module/tools": "^3.0.1",
    "@types/ws": "^8.18.1",
    "vitest": "^3.2.4"
  }
}
```

Run Yarn through the template-declared package manager to generate `yarn.lock`.

- [ ] **Step 2: Write failing protocol and state tests**

Verify strict server-message validation, nested errors, unique integer camera catalog construction, selected camera lookup, and stale revision rejection. Use complete status fixtures with `expansionEnabled`, `focusMode`, and numeric camera fields.

- [ ] **Step 3: Implement the module protocol and state modules**

Mirror the server constants and message shapes without importing source across package boundaries. Keep all incoming values `unknown` until validated. Define connection snapshot defaults that contain no stale selection after disconnect.

- [ ] **Step 4: Write failing connection lifecycle tests**

Start a loopback `WebSocketServer` on an ephemeral port. Assert hello, initial status request, correlated Focus Camera result, pending rejection on close, stale event rejection, reconnect status request, and absence of action replay.

- [ ] **Step 5: Implement `DitBrowseConnection`**

Constructor dependencies:

```ts
interface ConnectionCallbacks {
  onPhase: (phase: "disconnected" | "connecting" | "handshaking" | "connected", message?: string) => void;
  onStatus: (status: DitBrowseStatus, catalogChanged: boolean) => void;
  onError: (message: string) => void;
  debug: (message: string) => void;
}
```

Public methods:

```ts
start(port: number): void;
reconfigure(port: number): void;
stop(): Promise<void>;
sendCommand(command: DitBrowseCommand): Promise<DitBrowseStatus>;
refreshStatus(): Promise<DitBrowseStatus>;
```

Use backoff delays 1, 2, 5, then 10 seconds, cap at 10 seconds, and unref timers. Resolve commands by external request ID. Reject all pending requests on disconnect. Never retain an action queue.

- [ ] **Step 6: Run module engine tests and typecheck**

Run from `companion-module-lightlab-ditbrowse`: `yarn test`

Expected: protocol, state, and connection tests pass.

Run: `yarn typecheck`

Expected: pass.

- [ ] **Step 7: Commit the module engine**

```bash
git add companion-module-lightlab-ditbrowse
git commit -m "feat: add DIT Browse Companion connection engine"
```

---

### Task 6: Companion Actions, Feedbacks, Variables, and Presets

**Files:**
- Create: `companion-module-lightlab-ditbrowse/src/config.ts`
- Create: `companion-module-lightlab-ditbrowse/src/actions.ts`
- Create: `companion-module-lightlab-ditbrowse/src/feedbacks.ts`
- Create: `companion-module-lightlab-ditbrowse/src/variables.ts`
- Create: `companion-module-lightlab-ditbrowse/src/presets.ts`
- Create: `companion-module-lightlab-ditbrowse/src/upgrades.ts`
- Create: `companion-module-lightlab-ditbrowse/src/main.ts`
- Create: `companion-module-lightlab-ditbrowse/test/definitions.test.ts`
- Create: `companion-module-lightlab-ditbrowse/test/presets.test.ts`

**Interfaces:**
- Consumes: `DitBrowseConnection`, cached status, and catalog from Task 5.
- Produces: `ModuleSchema` with config, actions, feedbacks, and variables.
- Produces: `GetActionDefinitions`, `GetFeedbackDefinitions`, `GetVariableDefinitions`, and `GetPresetDefinitions` pure builders for testing.

- [ ] **Step 1: Write failing definition tests**

Assert the config contains only `port` and `debug`. Assert Focus Camera has one option:

```ts
{
  id: "cameraNumber",
  type: "number",
  label: "Camera number",
  default: 1,
  min: 1,
  max: 999999,
  step: 1,
  required: true
}
```

Assert the remaining actions have no options. Assert camera feedback fields are numeric. Assert no definition contains `host`, `token`, `password`, or variable parsing.

- [ ] **Step 2: Implement config and actions**

Config defaults to `{ port: 52780, debug: false }`. Focus Camera validates `Number.isSafeInteger` and `>= 1` at callback time before calling `sendCommand`. Show Grid, Toggle Expansion Mode, and Refresh Status send their exact protocol commands and await results.

- [ ] **Step 3: Implement feedbacks and variables**

Feedback IDs:

```text
connected
expansion_enabled
grid_visible
camera_focused
camera_selected
```

Variable IDs:

```text
connection_status
app_version
protocol_version
expansion_enabled
focus_mode
selected_camera_number
selected_title
selected_url
camera_count
last_error
```

Use `Yes`/`No` for boolean variable values, empty strings for absent selection details, and `Connected`, `Connecting`, `Handshaking`, or `Disconnected` for connection status.

- [ ] **Step 4: Write failing preset tests and implement presets**

Build simple presets for Show Grid and Toggle Expansion Mode. Build one camera preset per unique catalog entry, with stable ID `focus_camera_<number>`, unpadded button text, Focus Camera action, and Camera Focused feedback. Catalog title changes rebuild the relevant preset; focus-only changes do not rebuild definitions.

- [ ] **Step 5: Integrate the Companion lifecycle**

In `main.ts`, create the connection in `init`, register definitions, apply phase/status callbacks to `updateStatus`, `setVariableValues`, and `checkFeedbacks`, and rebuild presets only on catalog changes. `configUpdated` reconfigures only when the port changes and updates debug behavior without reconnecting. `destroy` awaits `connection.stop()`.

Use current API 2.0 variable definition objects and preset section/definition objects from the official template.

- [ ] **Step 6: Run module tests, lint, typecheck, and build**

Run: `yarn test`

Expected: all module tests pass.

Run: `yarn lint`

Expected: no ESLint errors.

Run: `yarn typecheck`

Expected: no TypeScript errors.

Run: `yarn build`

Expected: `dist/main.js` is created.

- [ ] **Step 7: Commit Companion definitions**

```bash
git add companion-module-lightlab-ditbrowse
git commit -m "feat: add Companion controls and live feedback"
```

---

### Task 7: Module Manifest, Help, Packaging, and End-to-End Contract Test

**Files:**
- Create: `companion-module-lightlab-ditbrowse/companion/manifest.json`
- Create: `companion-module-lightlab-ditbrowse/companion/HELP.md`
- Create: `companion-module-lightlab-ditbrowse/LICENSE`
- Create: `companion-module-lightlab-ditbrowse/README.md`
- Create: `companion-module-lightlab-ditbrowse/test/ditbrowse-integration.test.ts`

**Interfaces:**
- Consumes: completed app server and module connection engine.
- Produces: packageable module identity `lightlab-ditbrowse`.

- [ ] **Step 1: Add official module metadata**

Use manifest identity:

```json
{
  "type": "connection",
  "id": "lightlab-ditbrowse",
  "name": "DIT Browse",
  "shortname": "DITBrowse",
  "description": "Control local DIT Browse cameras and expansion mode with live feedback.",
  "version": "0.0.0",
  "license": "MIT",
  "manufacturer": "Light Lab",
  "products": ["DIT Browse"],
  "runtime": {
    "type": "node22",
    "api": "nodejs-ipc",
    "apiVersion": "0.0.0",
    "entrypoint": "../dist/main.js"
  }
}
```

Use repository and bugs URLs under `lightlab/companion-module-lightlab-ditbrowse`. Do not invent maintainer email addresses; include the maintainer name only if allowed by the manifest schema, otherwise use the repository owner without fabricated contact data.

- [ ] **Step 2: Write operator help and developer README**

Document same-computer operation, default port 52780, matching custom ports, integer camera numbers, the distinction between Show Grid and Toggle Expansion Mode, the persistent-grid behavior, feedbacks, variables, presets, reconnection, local development, tests, and package build. Explicitly state that no token exists because the server is loopback-only.

- [ ] **Step 3: Add an end-to-end protocol contract test**

Start the real DIT Browse `startControlApiServer` with a fake renderer dispatcher and connect the module `DitBrowseConnection`. Verify handshake, integer Focus Camera, expansion toggle, status broadcast, and reconnect snapshot behavior. Import built or source-level modules without crossing runtime package boundaries in production code.

- [ ] **Step 4: Run module validation and package build**

Run from the module directory: `yarn companion-module-check`

Expected: the `@companion-module/tools` manifest and connection checks exit zero.

Run: `yarn package`

Expected: the Bitfocus module builder produces an installable archive without manifest errors.

- [ ] **Step 5: Commit metadata and packaging**

```bash
git add companion-module-lightlab-ditbrowse
git commit -m "docs: package DIT Browse Companion module"
```

---

### Task 8: Full Verification and Release Handoff

**Files:**
- Modify: `docs/verification.md`
- Modify only if verification reveals defects: files introduced or changed in Tasks 1 through 7.

**Interfaces:**
- Consumes: completed DIT Browse and Companion module.
- Produces: reproducible verification record and final installable module archive.

- [ ] **Step 1: Run DIT Browse verification**

Run from workspace root:

```bash
npm test
npm run typecheck
npm run build
```

Expected: every command exits zero.

- [ ] **Step 2: Run Companion module verification**

Run from `companion-module-lightlab-ditbrowse`:

```bash
yarn test
yarn lint
yarn typecheck
yarn build
yarn package
```

Expected: every command exits zero and package output exists.

- [ ] **Step 3: Exercise the real app/module connection**

Launch DIT Browse with fixed port 52780 and run the module connection test or Companion developer module loader. Verify:

1. Connection reaches Connected with no host or token field.
2. Camera 2 focuses from its integer action.
3. Toggle Expansion Mode off immediately shows the grid.
4. Camera 3 does nothing while expansion is off.
5. Local focus control is disabled while expansion is off.
6. Toggle Expansion Mode on keeps the grid visible.
7. Camera 3 then focuses.
8. Manual selection/focus changes update Companion feedback without polling.
9. Restarting DIT Browse reconnects and restores state without replaying the last action.

- [ ] **Step 4: Update verification documentation**

Add the commands, manual workflow, expected WebSocket URL, and generated package location to `docs/verification.md`.

- [ ] **Step 5: Inspect the final diff**

Run: `git status --short`

Expected: only intended integration files are modified or untracked.

Run: `git diff --check`

Expected: no whitespace errors.

- [ ] **Step 6: Commit final verification adjustments**

```bash
git add docs/verification.md
git commit -m "test: document Companion integration verification"
```

Do not create an empty commit when verification required no documentation adjustment.

---

## Plan Self-Review

- Every approved design requirement maps to a task: loopback security, no tokens, fixed default port, strict integer protocol, HTTP compatibility, expansion gate, status events, reconnect behavior, Companion definitions, dynamic presets, packaging, and verification.
- Shared type names are consistent across tasks: `ControlApiViewState`, `ControlApiStatus`, `ControlProtocol*`, `DitBrowseStatus`, and `DitBrowseConnection`.
- Production packages do not import source code across the DIT Browse/module boundary; only the final test may compare both implementations.
- The plan contains no deferred features or unspecified error-handling steps.
