# DITBrowse + Skaarhoj Blue Pill (fork)

Fork of [Lightlab24/DITBrowse](https://github.com/Lightlab24/DITBrowse) with **Probel SW-P-08** router emulation so Blue Pill can select cameras using SKAARHOJ’s existing SW-P-08 device core (no custom unsigned `.ipks`).

Upstream releases: https://github.com/Lightlab24/DITBrowse/releases

## What’s new in this fork

1. **Probel SW-P-08 server** — Settings → *Probel SW-P-08 (Blue Pill)*. Routing source `N` → destination `1` focuses camera `N`.
2. **LAN Local API** — optional bind `0.0.0.0` for Companion / tools on the LAN (still defaults to loopback).

## Quick start (Blue Pill routing)

```text
Enable SW-P-08 in DIT Browse (port 8910)
    → Blue Pill: add configurable Probel SW-P-08 device (Matrix 1)
    → Camera Select Route Index = camera number
    → Routing Triggers → SW-P-08 dest 1 (Focus)
    → (optional) second trigger → Videohub / ATEM Aux
```

See [docs/skaarhoj/blue-pill-routing-triggers.md](./docs/skaarhoj/blue-pill-routing-triggers.md).

## Layout

| Path | Purpose |
| --- | --- |
| `src/` | DIT Browse Electron app (forked) |
| `companion-module-lightlab-ditbrowse/` | Upstream Bitfocus Companion module |
| `docs/skaarhoj/` | Blue Pill / SW-P-08 setup notes |
| `core-ditbrowse/` | Deprecated custom core (prefer SW-P-08) |

## Development

```bash
npm install
npm test
```

## Upstream

DIT Browse is a macOS tiled browser for local camera web GUIs, with Bitfocus Companion integration over `ws://127.0.0.1:52780/api/ws`.
