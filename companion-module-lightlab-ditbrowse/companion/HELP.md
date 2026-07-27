# DIT Browse

Control the DIT Browse app from Bitfocus Companion with a persistent local WebSocket connection, live feedback, and ready-made camera presets.

## Requirements

- DIT Browse and Companion must run on the same computer.
- DIT Browse must be open.
- The port in Companion must match the Local API port shown in DIT Browse settings.
- The default port is `52780`.

DIT Browse listens only on `127.0.0.1`. This module has no host, access-token, password, LAN, or discovery settings because it cannot accept connections from another computer.

## Configuration

| Setting         | Default | Purpose                                                    |
| --------------- | ------: | ---------------------------------------------------------- |
| DIT Browse port | `52780` | Local HTTP and WebSocket control port.                     |
| Debug logging   |     Off | Adds connection and protocol details to the Companion log. |

The WebSocket endpoint is `ws://127.0.0.1:<port>/api/ws`.

## Camera numbers

Camera actions use normal positive integers: `1`, `2`, `3`, and so on. Camera number is an integer-only field. Padded strings such as `01`, titles, URLs, tab positions, tile IDs, and Companion variables are not camera identifiers in this module.

## Actions

### Focus Camera

Selects and expands the requested integer-numbered camera when expansion mode is enabled. If expansion mode is disabled, DIT Browse acknowledges the action but deliberately keeps the grid and current selection unchanged.

### Show Grid

Returns to the camera grid without changing whether future camera expansion is allowed.

### Toggle Expansion Mode

Turns single-camera expansion on or off. Turning it off immediately shows the full grid and locks DIT Browse in grid mode. Turning it back on leaves the grid visible until a camera is focused.

### Refresh Status

Requests a complete state snapshot. Normal state changes arrive automatically, so this is primarily a troubleshooting action.

## Feedbacks

- DIT Browse Connected
- Expansion Mode Enabled
- Grid Visible
- Camera Focused
- Camera Selected

Camera Focused is true only when expansion is enabled, focus mode is active, and the requested integer camera is selected. Camera Selected reports the selection independently of grid or focus mode.

## Variables

```text
$(ditbrowse:connection_status)
$(ditbrowse:app_version)
$(ditbrowse:protocol_version)
$(ditbrowse:expansion_enabled)
$(ditbrowse:focus_mode)
$(ditbrowse:selected_camera_number)
$(ditbrowse:selected_title)
$(ditbrowse:selected_url)
$(ditbrowse:camera_count)
$(ditbrowse:last_error)
```

The Companion connection label determines the variable prefix shown in your installation.

## Presets

The module supplies Show Grid, Toggle Expansion Mode, and one Focus Camera preset per uniquely numbered camera. Camera presets update when the DIT Browse camera catalog or titles change. Selecting another camera does not rebuild the preset catalog.

## Reconnection

The module reconnects automatically with bounded delays and requests current status after reconnecting. It never replays a camera action after a disconnect.

## Troubleshooting

1. Confirm both apps run on the same computer.
2. Confirm DIT Browse shows the expected Local API port.
3. Enter that same port in the Companion connection.
4. Enable Debug logging temporarily if the connection does not reach `OK`.
5. Use Refresh Status after the connection is restored.
