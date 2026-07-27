import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readlinkSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const runOnMac = process.platform === "darwin" ? it : it.skip;

describe("unsigned macOS DMG packaging", () => {
  runOnMac("creates a mountable image with the app and Applications link", () => {
    const temporaryRoot = mkdtempSync(resolve(tmpdir(), "ditbrowse-dmg-test-"));
    const fakeAppPath = resolve(temporaryRoot, "source/DITBrowse.app");
    const dmgPath = resolve(temporaryRoot, "output/DITBrowse.dmg");
    const mountPath = resolve(temporaryRoot, "mount");
    let attached = false;

    try {
      mkdirSync(resolve(fakeAppPath, "Contents"), { recursive: true });
      writeFileSync(resolve(fakeAppPath, "Contents/test.txt"), "DITBrowse\n");

      execFileSync(process.execPath, [
        resolve(process.cwd(), "scripts/build-mac-dmg.mjs"),
        "--app-path",
        fakeAppPath,
        "--output",
        dmgPath
      ]);
      expect(existsSync(dmgPath)).toBe(true);

      mkdirSync(mountPath);
      execFileSync("/usr/bin/hdiutil", [
        "attach",
        dmgPath,
        "-readonly",
        "-nobrowse",
        "-mountpoint",
        mountPath
      ]);
      attached = true;
      expect(existsSync(resolve(mountPath, "DITBrowse.app/Contents/test.txt"))).toBe(true);
      expect(readlinkSync(resolve(mountPath, "Applications"))).toBe("/Applications");
    } finally {
      if (attached) {
        execFileSync("/usr/bin/hdiutil", ["detach", mountPath]);
      }
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  }, 20_000);
});
