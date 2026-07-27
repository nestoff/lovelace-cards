import assert from "node:assert/strict";
import test from "node:test";
import { isNotarizationRequested } from "./notarization-policy.mjs";

test("does not infer notarization intent from Apple credentials", () => {
  assert.equal(
    isNotarizationRequested({
      APPLE_ID: "developer@example.com",
      APPLE_APP_SPECIFIC_PASSWORD: "placeholder",
      APPLE_TEAM_ID: "8BWXULM784"
    }),
    false
  );
});

test("requires the explicit notarization opt-in value", () => {
  assert.equal(isNotarizationRequested({ DITBROWSE_NOTARIZE: "true" }), false);
  assert.equal(isNotarizationRequested({ DITBROWSE_NOTARIZE: "1" }), true);
});
