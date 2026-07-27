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

### Why “Verification failed, File corrupted or invalid”?

Blue Pill **Packages → Upload and Install Package** only accepts **SKAARHOJ-signed `.ipks`** files (produced by their private `skaarOS-cli` signing keys).

Our GitHub `.ipk` / renamed `.ipks` builds are **structurally valid but unsigned**. The panel correctly rejects them with that error. Renaming `.ipk` → `.ipks` does not help.

### Recommended: SSH sideload (unsigned)

```bash
cd core-ditbrowse
./scripts/pack-sideload.sh
./scripts/push-sideload.sh <BLUE_PILL_IP>
```

Or manually:

```bash
./scripts/pack-sideload.sh
scp -r dist/core-ditbrowse-sideload*  # extract first if you only have the .tar.gz
# extract:
tar -xzf dist/core-ditbrowse-sideload.tar.gz
scp -r core-ditbrowse-sideload root@<BLUE_PILL_IP>:/tmp/
ssh root@<BLUE_PILL_IP> 'sh /tmp/core-ditbrowse-sideload/install-on-bluepill.sh'
```

If SSH is closed, enable support mode from the USB serial console (SKAARHOJ Discovery / Updater → Serial Monitor):

```text
support=1
```

Then retry SSH as `root`. If that still fails, email **support@skaarhoj.com** and ask them to either open support access or **sign** `core-ditbrowse` into a real `.ipks`.

### Unsigned `.ipk` (for `opkg` if available over SSH)

```bash
./scripts/pack-ipk.sh
# on Blue Pill, if opkg works:
#   opkg install /tmp/core-ditbrowse.ipk
```

Do **not** upload this via the web Packages UI.

### After install

1. Reboot the Blue Pill if `core-ditbrowse` does not show under Packages.
2. Add a device pointing at the DIT Browse Mac IP (port `52780`).
3. Default gRPC listen port for this core is `:8517`.

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
./scripts/pack-sideload.sh
./scripts/pack-ipk.sh
```

Protocol: DIT Browse WebSocket `ws://<host>:<port>/api/ws` (`ditbrowse.control` v1), same as the Bitfocus Companion module.

## License

MIT (same intent as the Companion module). DIT Browse upstream © Lightlab24.
