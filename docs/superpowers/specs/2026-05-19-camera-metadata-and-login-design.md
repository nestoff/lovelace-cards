# Camera Metadata And Login Persistence Design

## Purpose

DITBrowse camera rows should describe what appears above each camera GUI tile, not pretend to be a login form. The camera list should show simple camera numbers plus optional display metadata. Login persistence should behave like a browser: cookies stay in the existing Electron session, and typed credentials can be saved from inside the camera GUI.

## Camera Metadata

Each camera row keeps its URL behavior and gains display metadata:

- Camera number: stored in the existing `suffix` field and shown without the word `Camera`.
- Type: an optional camera body/type label.
- Lens: an optional lens label.
- Display note: an optional short note that appears in the tile label.

The tile, tab, and selected-tile status should use one compact display label:

`<camera number> • <type> • <lens> • <display note>`

Blank metadata is skipped. If only the camera number exists, the label is only the number.

## Camera List Editor

The editor should remove the visible username/password fields. It should rename `Suffix` to `Camera #` and expose only operational camera fields:

- Camera #
- Full URL
- Type
- Lens
- Display Note
- Viewport
- Zoom

CSV import should support the same shape. Old CSV headers may still be accepted where practical, but username/password columns should not be required or surfaced.

## Login Persistence

The app keeps the existing Electron session/cookie persistence. That remains the primary reason camera GUIs stay logged in between launches.

For password saving, DITBrowse should capture credentials typed into password forms inside each camera webview via a webview preload script. Captured credentials are stored in the existing job/list-scoped `passwordRecords` collection, keyed to the active camera/tile URL. When that camera GUI loads again, the preload script can receive the saved credential and fill matching username/password fields when possible.

This is intentionally best-effort. Camera GUIs vary, and some may block autofill or use custom login controls. The app should not show manual username/password columns in the camera list as a substitute for browser-style credential capture.

## Migration

Existing saved rows that have names such as `Camera 41` should display as `41` when no custom metadata exists. Existing stale username/password fields in camera rows can remain in old JSON but should not be used for list editing. Existing password records should continue to be job/list scoped.

## Testing

Tests should cover:

- Metadata label formatting.
- Reducer updates for type, lens, display note, and camera number.
- Camera list editor no longer showing username/password columns.
- CSV import not requiring username/password.
- Webview credential capture dispatching a save action.
- Existing grid/browser shell behavior remaining intact.
