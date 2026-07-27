import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(
  new URL("./sign-and-notarize-mac.mjs", import.meta.url),
  "utf8"
);

test("the production release builds, signs, and notarizes the DMG", () => {
  assert.match(source, /DITBROWSE_DMG_PATH/);
  assert.match(source, /build-mac-dmg\.mjs/);
  assert.match(source, /Signing DMG/);
  assert.match(source, /Notarizing DMG/);
  assert.match(source, /codesign.*--timestamp/s);
  assert.match(source, /await notarize\(\{\s*appPath: dmgPath/s);
});
