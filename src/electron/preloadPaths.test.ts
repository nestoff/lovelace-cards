import path from "node:path";
import { describe, expect, it } from "vitest";
import { getMainPreloadPath, getWebviewPreloadPath } from "./preloadPaths";

describe("preload paths", () => {
  it("uses CommonJS preload outputs that Electron can load in sandboxed preload contexts", () => {
    const electronDir = path.join("dist-electron", "electron");

    expect(getMainPreloadPath(electronDir)).toBe(path.join(electronDir, "preload.cjs"));
    expect(getWebviewPreloadPath(electronDir)).toBe(
      path.join(electronDir, "webviewPreload.cjs")
    );
  });
});
