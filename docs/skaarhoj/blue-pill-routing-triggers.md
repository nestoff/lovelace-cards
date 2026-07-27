# Blue Pill / Reactor setup for DIT Browse (Probel SW-P-08)

DIT Browse emulates a small **Probel SW-P-08** router. Use SKAARHOJ’s stock **Probel SW-P-08 → Configurable Model** — no custom core package.

The same field-by-field guide lives in **Settings → Probel SW-P-08 (Blue Pill)**.

## Values for Configurable Model

| Blue Pill field | Value |
| --- | --- |
| Active | checked |
| IP | Mac LAN IP running DIT Browse |
| Port | `8910` (not `0`) |
| Name | `DIT Browse` (optional) |
| Device Id | `1` (any unique id) |
| Model Id | Configurable Model |
| MatrixID | `0` |
| Sources / Destinations / Levels | set in Home → core settings → `64` / `1` / `1` |

## Steps

1. DIT Browse → Settings → enable **SW-P-08 server** (port 8910).
2. Blue Pill Packages → install **Probel SW-P-08** if needed.
3. Home → Add device → Probel SW-P-08 → **Configurable Model**.
4. Fill IP / Port / MatrixID as above → **Save**.
5. Home → core settings for that device: sources `64`, destinations `1`, levels `1`.
6. Camera Select **Route Index** = camera number → Routing Triggers → destination `1`.

Routing source `N` → destination `1` focuses camera `N` in DIT Browse.
