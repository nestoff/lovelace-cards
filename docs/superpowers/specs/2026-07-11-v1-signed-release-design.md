# DITBrowse v1.0.0 Signed Release Design

## Goal

Publish DITBrowse v1.0.0 as the first major release, with matching app and Companion module versions, a Developer ID-signed and Apple-notarized macOS app, a signed/notarized DMG, a GitHub release, and the verified v1 app installed in `/Applications`.

## Version Scope

Set both release components to `1.0.0`:

- the root DITBrowse application package and lockfile;
- the `companion-module-lightlab-ditbrowse` package and lockfile.

The macOS bundle version, packaged Companion module metadata, ZIP name, DMG name, Git tag, and GitHub release title must all represent v1.0.0 consistently. Existing workspace data remains outside the app bundle and must survive replacement.

## Signed Release Pipeline

Use the existing production packaging flow as the foundation:

1. Build the white Default/Dark Icon Composer assets, renderer, Electron process, and Companion module.
2. Package the arm64 macOS app.
3. Sign the app with `Developer ID Application: Adam Lighterman (8BWXULM784)`, hardened runtime, and a secure timestamp.
4. Submit the app to Apple notarization and staple the accepted ticket.
5. Create the distributable ZIP from the signed and stapled app. The ZIP container is not itself a code-signable object; the app inside it carries the verified signature and ticket.
6. Build the DMG from the signed and stapled app.
7. Developer ID-sign the DMG with a secure timestamp.
8. Submit the DMG to Apple notarization and staple its accepted ticket.

The notarized package command must fail immediately when the signing identity or supported notarization credentials are unavailable. It must not silently fall back to ad-hoc signing or an unsigned DMG.

## Verification

Before publishing, run the full unit, type, browser, Electron, and production-build checks. Then verify:

- root and Companion versions are both `1.0.0`;
- the app has a valid Developer ID signature, hardened runtime, timestamp, and Team Identifier `8BWXULM784`;
- `spctl` accepts the app as notarized Developer ID software;
- `stapler validate` accepts the app;
- the DMG signature is valid and identifies the same Developer ID team;
- `spctl` accepts the DMG;
- `stapler validate` accepts the DMG;
- the mounted DMG contains the signed app, `/Applications` symlink, Companion module, legacy ICNS, and the real DarkAqua Icon Composer stack;
- the installed app launches from `/Applications` and retains the live workspace recorded immediately before replacement.

## GitHub Publication

Push the current `codex/companion-integration` branch and update its existing draft pull request. Create a new annotated tag `v1.0.0` on the verified release commit, push the tag, and publish a non-draft GitHub release titled `DITBrowse v1.0.0`.

Upload these assets:

- `DITBrowse-mac-arm64.dmg` — primary installer;
- `DITBrowse-mac-arm64.zip` — signed/stapled app archive;
- the Companion module `.tgz` when produced by the v1 module build.

Do not overwrite the existing v0.1.1 release. If a `v1.0.0` tag or release already exists unexpectedly, stop instead of replacing it.

## Local Installation and Handoff

Back up the current `/Applications/DITBrowse.app`, replace it with the verified v1.0.0 app, refresh LaunchServices and the Dock, relaunch it, and confirm the local API reports the preserved camera state.

Provide clickable local paths to the final DMG and ZIP. The DMG path is also the Finder path the user can use for any manual upload:

`/Users/lightlab/DITBrowse/release/DITBrowse-darwin-arm64/DITBrowse-mac-arm64.dmg`

## Acceptance Criteria

- DITBrowse and its Companion module report version 1.0.0.
- The app and DMG are Developer ID-signed, notarized, and stapled.
- The v1 app is running from `/Applications` with the current 11-camera workspace, selected camera 11, and expansion setting preserved.
- The current branch and v1.0.0 tag are pushed to GitHub.
- A new public GitHub v1.0.0 release contains the verified DMG, ZIP, and Companion package.
- The prior v0.1.1 release remains unchanged.
