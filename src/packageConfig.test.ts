import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

interface PackageManifest {
  scripts?: Record<string, string>;
}

function packageManifest(): PackageManifest {
  return JSON.parse(
    readFileSync(resolve(process.cwd(), "package.json"), "utf8")
  ) as PackageManifest;
}

function packageIgnorePattern(): RegExp {
  const manifest = packageManifest();
  const packageScript = manifest.scripts?.["package:mac"] ?? "";
  const ignoreSource = packageScript.match(/--ignore="([^"]+)"/)?.[1];

  expect(ignoreSource, "package:mac must declare an electron-packager ignore regex").toBeTruthy();
  return new RegExp(ignoreSource);
}

describe("macOS package configuration", () => {
  it("excludes local worktrees and development artifacts from every packaged path", () => {
    const ignore = packageIgnorePattern();

    expect(ignore.test("/.worktrees")).toBe(true);
    expect(ignore.test("/.worktrees/browser-shell-redesign/release/DITBrowse.app")).toBe(true);
    expect(ignore.test("/.superpowers")).toBe(true);
    expect(ignore.test("/.superpowers/brainstorm/content.html")).toBe(true);
    expect(ignore.test("/release/DITBrowse-darwin-arm64/DITBrowse.app")).toBe(true);
    expect(ignore.test("/src/renderer/App.tsx")).toBe(true);
    expect(ignore.test("/companion-module-lightlab-ditbrowse/src/main.ts")).toBe(true);
    expect(ignore.test("/resources/companion-module/lightlab-ditbrowse/main.js")).toBe(true);
    expect(ignore.test("/dist-renderer/index.html")).toBe(false);
    expect(ignore.test("/dist-electron/electron/main.js")).toBe(false);
  });

  it("stages the Companion module and copies it as an extra macOS resource", () => {
    const scripts = packageManifest().scripts ?? {};
    const packageScript = scripts["package:mac"] ?? "";

    expect(scripts["stage:companion-module"]).toContain("stage-companion-module.mjs");
    expect(packageScript).toContain("npm run stage:companion-module");
    expect(packageScript.indexOf("npm run stage:companion-module")).toBeLessThan(
      packageScript.indexOf("electron-packager")
    );
    expect(packageScript).toContain("--extra-resource=resources/companion-module");
  });

  it("regenerates the icon from its vector master before macOS packaging", () => {
    const scripts = packageManifest().scripts ?? {};
    const packageScript = scripts["package:mac"] ?? "";

    expect(scripts["build:mac-icon"]).toBe("node scripts/build-mac-icon.mjs");
    expect(packageScript).toContain("npm run build:mac-icon");
    expect(packageScript.indexOf("npm run build:mac-icon")).toBeLessThan(
      packageScript.indexOf("electron-packager")
    );
  });

  it("builds the DMG only from the ad-hoc package workflow", () => {
    const scripts = packageManifest().scripts ?? {};
    expect(scripts["package:mac:dmg"]).toBe(
      "npm run package:mac && node scripts/build-mac-dmg.mjs"
    );
    expect(scripts["package:mac:dmg"]).not.toContain("signed");
    expect(scripts["package:mac:dmg"]).not.toContain("notar");
  });
});
