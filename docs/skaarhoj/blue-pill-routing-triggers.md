# Blue Pill / Reactor setup for DIT Browse

This fork ships `core-ditbrowse`, a SKAARHOJ device core that speaks DIT Browse’s existing control WebSocket and exposes camera selection as a **Routing Trigger** target.

## 1. Enable LAN API on the Mac

1. Launch DIT Browse.
2. Open **Settings → Local API**.
3. Enable **Allow LAN access (Blue Pill / Skaarhoj)**.
4. Confirm the advertised address (example: `192.168.10.50:52780`).

Loopback (`127.0.0.1`) remains the default so Bitfocus Companion keeps working unchanged on the same Mac.

## 2. Install `core-ditbrowse` on Blue Pill

Build:

```bash
cd core-ditbrowse
GOOS=linux GOARCH=arm64 go build -o core-ditbrowse .
```

Deploy with your usual Blue Pill core sideload process, then add a device:

| Field | Value |
| --- | --- |
| IP | Mac LAN address |
| Port | `52780` (or your Local API port) |

## 3. Wire Camera Select → Routing Triggers

### Goal

When an operator presses a camera on the Skaarhoj panel:

1. The video router / switcher aux changes (optional, existing workflow).
2. DIT Browse expands that same camera number on the DIT wall.

### Steps

1. In Reactor, open your panel configuration’s **Camera Select** table.
2. For each camera row, set **Route Index** to the DIT Browse camera number (`1`, `2`, …).
3. Open **Routing Triggers**.
4. Add a destination row bound to the **DIT Browse** device (`core-ditbrowse`), using the Routing / `route` snippet. Set ME/Bus as needed (use destination `1` if you only need one logical “focus” bus).
5. Optionally add another Routing Triggers row for ATEM Aux / Blackmagic Videohub / etc. Add matching Route Index cells for each destination.

Selecting Cam 3 now fires both triggers with Route Index `3`: the switcher routes input 3, and `core-ditbrowse` focuses camera 3.

## 4. Alternate: bind panel buttons directly

Map hardware buttons to:

- `selected_camera` = `N`
- or `camera_select` (dynamic list from live DIT Browse status)

Use `route_index` feedback with Virtual Triggers if you need to sync Ext. Cam Number across panels.

## Protocol reference

Same as Companion:

- `ws://<host>:<port>/api/ws`
- protocol `ditbrowse.control` version `1`
- commands: `status`, `focusCamera`, `showGrid`, `toggleExpansion`
