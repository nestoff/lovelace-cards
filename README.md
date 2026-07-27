# DITBrowse + Skaarhoj Blue Pill (fork)

Fork of [Lightlab24/DITBrowse](https://github.com/Lightlab24/DITBrowse) with a **custom SKAARHOJ Blue Pill / Reactor device core** that selects DIT Browse cameras and acts as a **Routing Trigger** destination.

Upstream releases: https://github.com/Lightlab24/DITBrowse/releases

## What’s new in this fork

1. **LAN Local API** — Settings → Local API → *Allow LAN access (Blue Pill / Skaarhoj)* binds `0.0.0.0` so a Blue Pill on the network can reach DIT Browse (still defaults to loopback for Companion).
2. **`core-ditbrowse`** — Go device core for Reactor:
   - Camera select / focus by integer camera number
   - `GenericType_Routing` parameter for Blue Pill **Routing Triggers**
   - Grid / expansion controls matching the Companion module protocol

## Quick start (Blue Pill routing)

```text
Skaarhoj panel Camera Select
    → Route Index = DIT Browse camera number
    → Routing Triggers row #1 → Videohub / ATEM Aux  (video)
    → Routing Triggers row #2 → core-ditbrowse.route (focus DIT Browse tile)
```

See [core-ditbrowse/README.md](./core-ditbrowse/README.md) for install and parameter details.

## Layout

| Path | Purpose |
| --- | --- |
| `src/` | DIT Browse Electron app (forked) |
| `companion-module-lightlab-ditbrowse/` | Upstream Bitfocus Companion module |
| `core-ditbrowse/` | **New** SKAARHOJ Blue Pill device core |
| `docs/skaarhoj/` | Blue Pill setup notes |

## Development

```bash
# App
npm install
npm test

# Skaarhoj core
cd core-ditbrowse && go test ./... && go build .
```

## Upstream

DIT Browse is a macOS tiled browser for local camera web GUIs, with Bitfocus Companion integration over `ws://127.0.0.1:52780/api/ws`.
