# Bitfocus Companion Integration Design

## Summary

DIT Browse will gain a first-party Bitfocus Companion connection module backed by a persistent, versioned WebSocket control protocol. The connection is intentionally limited to the same computer: DIT Browse binds its control server to `127.0.0.1`, and the module connects to that loopback address. The integration has no access tokens, secrets, authentication headers, LAN mode, or remote-host configuration.

Companion identifies cameras only by positive integer camera number, such as `1`, `2`, or `3`. The integration does not use padded camera strings, tab positions, tile IDs, titles, URLs, or Companion variable expansion to identify a camera.

A global expansion-mode gate determines whether a camera can fill the DIT Browse window. When expansion mode is disabled, DIT Browse immediately returns to the grid and stays there. Individual camera actions are acknowledged but do not change selection or focus while expansion is disabled.

## Goals

- Replace Companion HTTP GET button workflows with a persistent WebSocket connection.
- Preserve the existing local HTTP control endpoints for existing scripts.
- Publish DIT Browse state changes to Companion without polling.
- Identify cameras in Companion and the WebSocket protocol with positive integers only.
- Add a toggleable expansion mode that can enforce a persistent grid.
- Supply useful Companion actions, feedbacks, variables, and generated presets.
- Produce a complete TypeScript Companion module that follows the official Node 22 module toolchain.
- Test and package both the DIT Browse changes and the Companion module locally.

## Non-Goals

- LAN or internet control.
- Access tokens, passwords, shared secrets, or any other authentication mechanism.
- Automatic network discovery.
- Companion variable substitution in the camera-number action.
- WebSocket camera lookup by title, URL, tab position, tile ID, or internal camera ID.
- Removing the existing HTTP control API.
- Automatically replaying actions after a reconnect.
- Submitting or publishing the module to Bitfocus as part of the local implementation.

## Repository Layout

The DIT Browse application remains at the workspace root. The Companion module is created as a self-contained package at:

```text
companion-module-lightlab-ditbrowse/
```

The module directory contains its own package manifest, lockfile, TypeScript configuration, Bitfocus manifest and help files, source files, tests, and build output rules. It is not initialized as a nested Git repository. It can later be moved into the official Bitfocus repository without changing its module identity.

## Architecture

The existing DIT Browse control server remains the single control endpoint. It continues serving HTTP routes and handles WebSocket upgrades on `/api/ws` using the same configured port.

```text
Companion button
    -> companion-module-lightlab-ditbrowse
    -> ws://127.0.0.1:<port>/api/ws
    -> DIT Browse Electron main process
    -> existing renderer command dispatcher
    -> renderer state update and response
    -> WebSocket result and status event
    -> Companion variables, feedbacks, and presets
```

The default port is `52780`. DIT Browse continues to expose its existing port setting, including the ability to select another fixed port. The Companion module exposes the port as an integer configuration field and always connects to `127.0.0.1`.

Application commands remain transport-independent. HTTP and WebSocket translate input into the shared command model and use the same Electron main-to-renderer dispatcher. WebSocket framing, handshakes, revisions, and events live in transport-level protocol types rather than in renderer business logic.

## Control State

DIT Browse reports this state to control clients:

```ts
interface ControlApiStatus {
  expansionEnabled: boolean;
  focusMode: boolean;
  selectedCameraNumber: number | null;
  selectedTileId: string | null;
  selectedIndex: number | null;
  tabs: ControlApiStatusTab[];
}

interface ControlApiStatusTab {
  index: number;
  tileId: string;
  cameraId: string | null;
  cameraNumber: number | null;
  title: string;
  url: string;
}
```

`cameraNumber` is `null` only for a tile that is not assigned to a valid positive-integer camera. `selectedCameraNumber` is derived from the selected tile and its active camera-list assignment.

`expansionEnabled` is session-scoped and defaults to `true` when DIT Browse starts. It is not stored in workspace data. `focusMode` can only be true when expansion mode is enabled and a selected tile exists.

## Camera Number Rules

The WebSocket protocol accepts camera numbers only as JSON numbers satisfying all of these rules:

- The value is finite.
- The value is an integer.
- The value is at least `1`.

The values `"1"`, `"01"`, `1.5`, `0`, `-1`, `null`, and omitted values are invalid WebSocket camera identifiers and produce `bad_request`.

Camera metadata is currently stored as strings in DIT Browse. The control layer converts a numeric camera suffix to an integer for protocol and status output. A camera suffix that is empty, non-numeric, zero, negative, fractional, or not safely representable as an integer is not exposed as a numbered Companion camera.

The legacy HTTP API remains tolerant at its boundary. Routes such as `/api/focus/01` and query/body values containing `"01"` normalize to integer camera `1` before dispatch. This compatibility does not relax the WebSocket schema or the Companion action field.

## Expansion Mode Rules

Expansion mode is a global renderer state gate used by local controls and remote commands.

When expansion mode is enabled:

- A valid Focus Camera command selects the matching tile and enters focus mode.
- The local focus control may enter or leave focus mode.
- Show Grid exits focus mode without changing expansion mode.

When expansion mode is disabled:

- DIT Browse immediately exits focus mode.
- The full grid stays visible.
- A Focus Camera command returns a successful result containing unchanged status.
- Focus Camera does not select a different tile.
- The local focus control cannot enter focus mode and is visibly disabled or otherwise presented as unavailable.
- Show Grid remains a successful idempotent operation.

Toggling expansion from disabled to enabled leaves the grid visible. A later Focus Camera action or local focus operation may then enter focus mode.

The remote toggle is deliberately a toggle operation with no action options. State feedback and the `expansion_enabled` variable let a Companion button display the resulting state.

## WebSocket Protocol

### Endpoint and version

```text
ws://127.0.0.1:<configured-port>/api/ws
protocol: ditbrowse.control
protocolVersion: 1
```

Connections upgraded on any other path are rejected. DIT Browse never accepts non-loopback connections because the HTTP server itself binds only to `127.0.0.1`.

### Handshake

The client must send a hello message before commands:

```json
{
  "type": "hello",
  "protocol": "ditbrowse.control",
  "protocolVersion": 1,
  "client": {
    "name": "companion-module-lightlab-ditbrowse",
    "version": "0.1.0"
  }
}
```

DIT Browse responds with server identity and capabilities:

```json
{
  "type": "hello",
  "protocol": "ditbrowse.control",
  "protocolVersion": 1,
  "server": {
    "name": "DIT Browse",
    "version": "0.1.0"
  },
  "capabilities": [
    "status",
    "focusCamera",
    "showGrid",
    "toggleExpansion",
    "statusEvents"
  ]
}
```

An unsupported protocol name or major version produces a protocol error and closes the socket. Commands received before a valid hello are rejected.

### Commands

Request current status:

```json
{
  "type": "command",
  "requestId": "request-1",
  "command": { "type": "status" }
}
```

Focus an integer-numbered camera:

```json
{
  "type": "command",
  "requestId": "request-2",
  "command": {
    "type": "focusCamera",
    "cameraNumber": 4
  }
}
```

Show the grid without changing expansion mode:

```json
{
  "type": "command",
  "requestId": "request-3",
  "command": { "type": "showGrid" }
}
```

Toggle expansion mode:

```json
{
  "type": "command",
  "requestId": "request-4",
  "command": { "type": "toggleExpansion" }
}
```

The WebSocket protocol does not define a focus-tab command.

### Results

A successful command result contains the state after command handling:

```json
{
  "type": "result",
  "requestId": "request-2",
  "ok": true,
  "status": {
    "expansionEnabled": true,
    "focusMode": true,
    "selectedCameraNumber": 4,
    "selectedTileId": "tile-camera-04",
    "selectedIndex": 4,
    "tabs": []
  }
}
```

A failed command returns a stable error code and readable message:

```json
{
  "type": "result",
  "requestId": "request-5",
  "ok": false,
  "error": {
    "code": "not_found",
    "message": "No camera number matches 25"
  }
}
```

The supported error codes remain:

```text
bad_request
not_found
renderer_unavailable
timeout
internal_error
```

### Status events

DIT Browse publishes a complete status snapshot after the handshake and whenever control-relevant state changes:

```json
{
  "type": "event",
  "event": "status",
  "revision": 42,
  "status": {
    "expansionEnabled": false,
    "focusMode": false,
    "selectedCameraNumber": 4,
    "selectedTileId": "tile-camera-04",
    "selectedIndex": 4,
    "tabs": []
  }
}
```

Control-relevant changes include:

- Selected tile.
- Focus mode.
- Expansion mode.
- Tab addition, removal, or order.
- Tab title or URL.
- Camera assignment.
- Camera number.
- Camera-list selection that changes the active mapping.

Unrelated UI edits, including password entry, do not publish status.

The Electron main process owns a monotonically increasing revision counter and the latest status snapshot. A newly connected client receives the latest full snapshot. If no renderer snapshot is available yet, the server obtains status through the existing dispatcher before completing synchronization.

### Connection health

- DIT Browse sends WebSocket ping frames every 15 seconds.
- A connection is terminated after two unanswered health intervals.
- Companion reconnects after 1, 2, 5, and then 10 seconds, retaining a 10-second maximum delay.
- Companion requests a complete snapshot after every reconnect.
- Pending command promises reject on timeout or disconnect.
- Action commands are never replayed automatically.
- A command acknowledgment must arrive within the existing 2.5-second renderer command timeout plus a small protocol margin.

## DIT Browse Changes

### Shared control model

The transport-independent command union adds `toggleExpansion`. `focusCamera.cameraNumber` becomes a number internally. Control status gains `expansionEnabled` and `selectedCameraNumber`, while tab camera numbers become `number | null`.

HTTP parsing owns legacy string normalization before creating a shared command. WebSocket parsing performs strict runtime validation before creating the same shared command.

Transport-level hello, command envelope, result, error, and event types are defined separately from the shared command union.

### Electron control server

The current HTTP server gains a `WebSocketServer` in `noServer` mode and handles HTTP upgrade events for `/api/ws`. Its public interface adds status publication and observable client count while retaining host, port, base URL, and asynchronous close.

Closing or restarting the control server:

- Stops the health timer.
- Rejects new upgrades.
- Closes active WebSocket clients.
- Closes the underlying HTTP listener.
- Leaves no pending timer or socket that can keep Electron alive.

### Electron main and preload bridge

The existing request-ID dispatcher remains responsible for renderer availability and timeouts. The preload bridge gains a context-isolated renderer-to-main method for publishing status. Electron main validates the publication payload, increments the revision, caches the snapshot, and broadcasts it through the active server.

### Renderer

The renderer owns session-scoped `expansionEnabled` state alongside focus state. It publishes complete status after the initial workspace load and after relevant state changes. Status construction remains a shared pure function so command responses and events use the same representation.

The command handler performs expansion gating before camera resolution and selection. With expansion disabled, Focus Camera returns the current successful status immediately. Toggle Expansion updates the gate, forces focus off when disabling it, and acknowledges the resulting state.

The local focus UI uses the same gate. It cannot enter focus mode while expansion is disabled and clearly communicates that expansion is locked by Companion control.

## Companion Module

### Identity and runtime

```text
Repository/package: companion-module-lightlab-ditbrowse
Manifest ID: lightlab-ditbrowse
Name: DIT Browse
Manufacturer: Light Lab
Product: DIT Browse
Language: TypeScript
Runtime: Node 22
Module API: 2.0
License: MIT
```

The module uses the official Bitfocus module template conventions and current `@companion-module/base` 2.0 release line.

### Configuration

The Connections page exposes:

- `Port`: integer from 1 through 65535, default `52780`.
- `Debug logging`: boolean, default off.

The host is fixed internally to `127.0.0.1`. There is no host field, token field, password field, secret storage, TLS option, or LAN switch.

Changing the port closes the old socket, rejects its pending commands, resets connection-derived state, and begins a new connection lifecycle.

### Actions

#### Focus Camera

The action has one Companion number input:

```text
Camera number
minimum: 1
step: 1
required: true
```

The action callback validates that the received value is a positive integer before sending it. The field does not accept or parse Companion variables. The action waits for the matching DIT Browse result before resolving.

#### Show Grid

The action has no options. It exits focus mode without changing expansion mode.

#### Toggle Expansion Mode

The action has no options. It toggles the current DIT Browse expansion gate. The returned state drives the expansion feedback and variable.

#### Refresh Status

The action has no options. It requests and applies a complete status snapshot.

### Feedbacks

- `DIT Browse connected`: true while the WebSocket is handshaken and ready.
- `Expansion mode enabled`: true when `expansionEnabled` is true.
- `Grid visible`: true when `focusMode` is false.
- `Camera focused`: accepts a positive integer camera number and is true when expansion is enabled, focus mode is true, and that camera is selected.
- `Camera selected`: accepts a positive integer camera number and is true when that camera is selected, regardless of focus or expansion mode.

Status application calls only the feedback checks whose inputs may have changed, or all module feedbacks when connection state changes.

### Variables

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

Boolean state variables use stable readable values rather than ambiguous emptiness. Selection-dependent variables become empty when no numbered camera is selected. `last_error` is cleared after a successful handshake and records the latest connection, protocol, timeout, or command failure message.

### Presets

The module publishes:

- A Show Grid preset.
- A Toggle Expansion Mode preset with expansion-state feedback styling.
- One Focus Camera preset for each uniquely numbered camera in the current catalog.

Each camera preset uses its integer camera number in the action and feedback. The button text includes the normal unpadded number and title. Duplicate camera numbers do not create ambiguous duplicate presets; the first camera in active tab order is used, matching DIT Browse camera resolution.

Preset definitions are rebuilt only when the ordered catalog of numbered cameras or their titles changes. Selection-only and focus-only events do not rebuild presets.

## Connection State and Data Flow

The module connection lifecycle has four observable phases:

```text
Disconnected -> Connecting -> Handshaking -> Connected
```

Only `Connected` permits action commands. The module updates Companion instance status for each phase. A valid server hello and initial status snapshot establish the connected state.

Incoming messages are parsed as unknown data and validated before use. Results resolve or reject a matching pending request. Status events apply only when their revision is newer than the cached revision. A full snapshot received as a direct status result can re-synchronize the module after reconnect.

Connection and state management are separated from Companion definitions so protocol validation and reconnection can be unit tested without a running Companion instance.

## Error Handling

- Invalid JSON produces a protocol error without crashing either process.
- Invalid message shapes or camera numbers return `bad_request` where a request ID is usable.
- A valid positive integer with no assigned tile returns `not_found` when expansion is enabled.
- Focus Camera while expansion is disabled returns success and does not perform camera lookup.
- Renderer unavailability returns `renderer_unavailable`.
- Renderer command expiration returns `timeout`.
- Unexpected failures return `internal_error` and are logged without exposing secrets because the integration stores none.
- Companion rejects pending requests when the socket closes.
- Stale results for already-expired request IDs are ignored.
- Stale status revisions are ignored.
- Protocol mismatch is surfaced as a configuration-level connection error rather than an infinite reconnect loop with no explanation.

## Testing Strategy

### DIT Browse unit and integration tests

- Convert valid stored camera suffixes to unpadded positive integers.
- Exclude invalid stored suffixes from the control catalog.
- Resolve cameras by integer number independently of tab position.
- Preserve legacy HTTP normalization for padded string routes and bodies.
- Reject invalid WebSocket camera values including strings and fractions.
- Complete the WebSocket hello handshake and initial status synchronization.
- Dispatch every supported WebSocket command and correlate request IDs.
- Broadcast status with increasing revisions to all connected clients.
- Cleanly close clients, timers, and the HTTP server.
- Force grid mode immediately when expansion is disabled.
- Keep focus commands successful and inert while expansion is disabled.
- Prevent local focus entry while expansion is disabled.
- Publish status only for control-relevant state changes.

### Companion module tests

- Validate config defaults and port bounds.
- Confirm Focus Camera uses a numeric field and rejects non-integers.
- Verify outgoing hello and command envelopes.
- Resolve command promises only for matching request IDs.
- Apply only newer status revisions.
- Update variables and feedbacks from status.
- Create stable presets from unique integer cameras.
- Avoid preset rebuilds for selection-only changes.
- Reject pending actions on disconnect.
- Reconnect with bounded backoff and request a fresh snapshot.
- Never replay a prior Focus Camera action.

### Verification commands

DIT Browse must pass its focused tests, full unit suite, typecheck, and production build.

The Companion module must pass its unit tests, TypeScript checks, linting, Bitfocus module validation, and package build using the scripts supplied by the official template/toolchain.

## Acceptance Criteria

- Starting DIT Browse exposes HTTP and WebSocket control on a loopback-only port.
- Companion connects without any token or host configuration.
- Companion camera actions expose an integer-only camera-number field.
- Camera `4` focuses the camera assigned number 4, regardless of tab order.
- A padded or string camera identifier is rejected by the WebSocket protocol.
- Turning expansion mode off while focused immediately shows the grid.
- Camera actions do not change selection or focus while expansion is off.
- Local controls cannot break the persistent-grid lock.
- Turning expansion back on does not automatically focus a camera.
- Manual DIT Browse selection and focus changes update Companion feedbacks without polling.
- Reconnecting restores current state but does not repeat actions.
- Existing HTTP control routes continue to work.
- Both packages build and their automated tests pass.
