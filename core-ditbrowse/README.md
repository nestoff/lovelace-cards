# core-ditbrowse

SKAARHOJ Blue Pill / Reactor **device core** for [DIT Browse](https://github.com/Lightlab24/DITBrowse).

This core lets a Skaarhoj panel **select cameras in DIT Browse** and participate in Blue Pill **Camera Select → Routing Triggers**.

## What it does

| Reactor parameter | Behavior |
| --- | --- |
| `selected_camera` | Focuses DIT Browse camera `N` (integer camera number) |
| `camera_select` | Dynamic option list of live cameras from DIT Browse |
| `route` (`GenericType_Routing`) | **Routing Trigger destination** — setting destination bus → camera `N` focuses that camera |
| `route_index` | Mirrors the selected camera for Virtual Triggers / Ext. Cam sync |
| `show_grid` / `toggle_expansion` / `expansion_enabled` | Grid and expansion controls |

## Network setup

Upstream DIT Browse binds its Local API to `127.0.0.1` only. This fork adds **Allow LAN access** so Blue Pill can reach the Mac:

1. Open DIT Browse → Settings → **Local API**
2. Enable **Allow LAN access (Blue Pill / Skaarhoj)**
3. Note the advertised host/port (default port `52780`)
4. On Blue Pill, add device core `core-ditbrowse` and set the Mac IP + port

## Install on Blue Pill

1. Build for linux/arm64 (typical Blue Pill):

```bash
cd core-ditbrowse
go generate
GOOS=linux GOARCH=arm64 go build -o core-ditbrowse .
```

2. Copy the binary into the Blue Pill device-cores directory (or sideload via System Manager / your usual core packaging workflow).
3. Restart Reactor / enable the core.
4. Add a device pointing at the DIT Browse Mac IP.

Default gRPC listen port for this core is `:8517`.

## Blue Pill: Camera Select + Routing Triggers

### A. Use this core as a Routing Trigger destination (focus DIT Browse)

1. Configure **Camera Select** as usual for your PTZ/cameras (or a simple Ext. Cam Number layout).
2. Open **Routing Triggers**.
3. Add a row that targets **DIT Browse** (`core-ditbrowse`):
   - Device ID / name = your DIT Browse host device
   - Use the `route` / Routing configuration snippet
   - ME/Bus Select = destination index (often `1` if you only need one “monitor” destination)
4. In **Camera Select**, set **Route Index** on each camera row to the DIT Browse camera number (`1`, `2`, `3`…).
5. When the operator selects a camera, Reactor fires the routing trigger → this core focuses that camera in DIT Browse.

### B. Also route a real switcher / videohub

Add a **second** Routing Triggers row for ATEM Aux / Videohub / etc., and add a matching Route Index cell on each Camera Select row. Blue Pill supports multiple routing destinations per camera select.

### C. Direct panel binding (no Camera Select table)

Map panel buttons to `selected_camera` or `camera_select` on the DIT Browse device. Optionally set a Virtual Trigger that copies `route_index` into your router.

## Development

```bash
go test ./...
go build -o core-ditbrowse .
```

Protocol: DIT Browse WebSocket `ws://<host>:<port>/api/ws` (`ditbrowse.control` v1), same as the Bitfocus Companion module.

## License

MIT (same intent as the Companion module). DIT Browse upstream © Lightlab24.
