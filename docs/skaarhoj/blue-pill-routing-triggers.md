# Blue Pill / Reactor setup for DIT Browse (Probel SW-P-08)

DIT Browse can emulate a small **Probel SW-P-08** video router. SKAARHOJ already ships an SW-P-08 device core, so you do **not** need a custom `core-ditbrowse` package (and you avoid the unsigned `.ipks` verification problem).

## How it maps

| SW-P-08 | DIT Browse |
| --- | --- |
| Source `N` | Camera number `N` |
| Destination `1` (default Focus) | Focus / expand that camera |
| Matrix `1`, Level `1` | Defaults in Settings |

When Reactor’s **Routing Triggers** route source `3` → destination `1`, DIT Browse focuses camera `3`.

## 1. Enable SW-P-08 in DIT Browse

1. Open **Settings** (camera list / tools).
2. Find **Probel SW-P-08 (Blue Pill)**.
3. Enable **Enable SW-P-08 server**.
4. Note the advertised host + port (default **8910**).

The server binds on all interfaces (`0.0.0.0`) so the Blue Pill can reach the Mac.

## 2. Add the stock SW-P-08 core on Blue Pill

1. Packages → install **Probel SW-P-08** if needed (online from SKAARHOJ).
2. Home → **Add device** → choose the **configurable SW-P-08** model.
3. Set:

| Field | Value |
| --- | --- |
| IP | Mac LAN address (shown in DIT Browse settings) |
| Port | `8910` (or your SW-P-08 port) |
| Matrix ID | `1` |
| Sources | `64` (or match Settings) |
| Destinations | `1` |
| Levels | `1` |

## 3. Wire Camera Select → Routing Triggers

1. In Reactor, open **Camera Select**.
2. For each camera row, set **Route Index** to the DIT Browse camera number (`1`, `2`, …).
3. Open **Routing Triggers**.
4. Add a destination row bound to the **SW-P-08** device:
   - Destination / bus = `1` (Focus)
   - Route Index drives the **source**
5. Optionally add another Routing Triggers row for ATEM Aux / Videohub / etc.

Selecting Cam 3 fires Route Index `3` → SW-P-08 source `3` → dest `1` → DIT Browse focuses camera 3.

## 4. Local API (Companion) is separate

The WebSocket Local API (`ws://…:52780/api/ws`) remains for Bitfocus Companion. SW-P-08 is the Blue Pill path.

## Legacy custom core

`core-ditbrowse/` is deprecated in favor of SW-P-08. Prefer the built-in protocol above.
