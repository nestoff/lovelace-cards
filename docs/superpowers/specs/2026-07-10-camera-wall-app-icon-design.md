# Camera Wall App Icon Design

## Goal

Replace DITBrowse's current lens-and-grid icon with a simpler Camera Wall mark that communicates multicamera browsing immediately and remains legible at small macOS Dock sizes.

## Approved Direction

The icon is a flat monitor-wall composition inside a rounded-square app-icon shell:

- A warm cream shell.
- Four equal camera-feed tiles arranged as a two-by-two wall.
- Three charcoal feeds.
- One burnt-orange active feed in the bottom-right position.
- One charcoal circular camera/aperture cue centered in the active feed.
- One broad charcoal monitor-base line below the feed wall.

The mark contains no lettering, gradients, lens rendering, blue accent, interface labels, or small controls.

## Visual Specification

### Palette

- Shell: `#EDE9DF`
- Inactive feeds, aperture cue, and monitor base: `#202022`
- Active feed: `#E27038`
- Transparent exterior outside the macOS icon silhouette

The palette must not introduce blue or cyan. Color values remain consistent across the SVG, PNG, and ICNS outputs.

### Geometry

Use a square `1024 × 1024` SVG artboard with these proportions derived from the approved preview:

- Shell bounds: approximately `3.3%` inset on every edge.
- Shell corner radius: approximately `21.4%` of the shell width.
- Feed wall left and right inset: approximately `16.2%` of the artboard.
- Each feed: approximately `29.5%` artboard width by `24.3%` artboard height.
- Horizontal feed gap: approximately `8.6%` of the artboard.
- Vertical feed gap: approximately `8.1%` of the artboard.
- Feed corner radius: approximately `3.8%` of the artboard.
- Aperture cue diameter: approximately `9.5%` of the artboard, centered in the bottom-right feed.
- Monitor base: approximately `40%` of the artboard width, with a round stroke cap and stroke width approximately `4.8%` of the artboard.

Optical centering takes precedence over mechanically exact percentages if the exported small-size previews reveal imbalance. All shapes must land on whole or half pixels in the rendered iconset sizes where practical.

### Small-Size Behavior

The four-feed silhouette, active orange feed, aperture dot, and monitor base must remain recognizable at `32 × 32` and visually coherent at `16 × 16`.

No special alternate artwork is required initially. If the standard SVG rasterization causes the aperture cue or monitor base to become muddy at `16 × 16`, the implementation may use an optically adjusted 16px raster with the same composition and colors. It may not add or remove semantic elements.

## Approaches Considered

Three primary concepts were rejected before selecting Camera Wall: a grid-plus-lens mark, layered browser monitors, and a DIT monogram. Ten broader metaphors were then compared, including viewfinder selection, signal routing, waveform monitoring, a numbered camera tile, a slate, a DIT cart, and metadata imagery.

For Camera Wall itself, three render treatments were compared:

- Flat Editorial: strongest small-size clarity and most distinctive silhouette.
- Dark Hardware: more cinematic, but too detailed and heavy at Dock sizes.
- Premium Hybrid: polished macOS depth, but less direct than the approved flat mark.

Four non-blue palettes were compared. The approved cream, charcoal, and burnt-orange palette is warmer and more ownable than monochrome/lime, sand/red, or charcoal/gold alternatives.

## Source and Generated Assets

The implementation will replace the current icon assets while preserving non-destructive backups in git history:

- `assets/icon/ditbrowse-icon-source.svg` — new editable vector master.
- `assets/icon/ditbrowse-icon-source.png` — 1024px raster source generated from the SVG.
- `assets/icon/ditbrowse-icon-1024.png` — packaged 1024px PNG.
- `assets/icon/ditbrowse.iconset/` — complete macOS iconset generated from the master.
- `assets/icon/ditbrowse.icns` — final macOS application icon.

The SVG is the single source of truth. PNG and ICNS files are generated outputs and must not be edited independently.

## Build Integration

The existing `scripts/apply-mac-icon.mjs` remains the packaging integration point. It copies `assets/icon/ditbrowse.icns` into the packaged application and sets `CFBundleIconFile` to `DITBrowse.icns`.

No runtime application code, Companion module behavior, camera state, passwords, or Help content changes as part of this icon project.

## Verification

Before replacing the installed app:

1. Validate that the SVG is square, contains the exact approved colors, and has no embedded raster image or text.
2. Render the master at 1024, 512, 256, 128, 64, 32, and 16 pixels.
3. Inspect 1024, 128, 32, and 16 pixel outputs for balanced padding, recognizable feeds, a clean active-camera cue, and no blue/cyan pixels.
4. Generate the macOS ICNS and verify it contains the expected icon representations.
5. Run the existing build and package verification relevant to icon packaging.
6. Confirm the packaged app's `Info.plist` points to `DITBrowse.icns` and the resource matches the generated ICNS.
7. Launch the packaged app and confirm existing camera count and local control status remain unchanged.

## Packaging and Installation Constraints

- Run only the unsigned/ad-hoc `npm run package:mac` workflow.
- Do not run Developer ID signing or notarization until the user explicitly requests it.
- Back up the current `/Applications/DITBrowse.app` to `/Users/lightlab/Documents/DITBrowse App Backups/DITBrowse-<timestamp>.app`.
- Replace `/Applications/DITBrowse.app` with the verified build and relaunch it.
- Preserve the user's workspace and confirm the local API returns the existing camera count after launch.

## Acceptance Criteria

- The final icon matches the approved Flat Camera Wall geometry and exact palette.
- The icon contains no blue, cyan, text, gradients, or realistic lens rendering.
- It remains recognizable at 32px and coherent at 16px.
- SVG, PNG, iconset, and ICNS deliverables are generated from one vector master.
- The packaged and installed application shows the new icon resource.
- The installed app launches with the existing camera workspace intact.
- No Developer ID signing or notarization occurs.
