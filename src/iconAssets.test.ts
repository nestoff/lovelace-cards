import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const iconDirectory = resolve(process.cwd(), "assets/icon");
const sourceSvgPath = resolve(iconDirectory, "ditbrowse-icon-source.svg");
const runOnMac = process.platform === "darwin" ? it : it.skip;

describe("Camera Wall icon assets", () => {
  it("uses the approved vector geometry and palette as its single source", () => {
    expect(existsSync(sourceSvgPath)).toBe(true);
    const svg = readFileSync(sourceSvgPath, "utf8");

    expect(svg).toContain('viewBox="0 0 1024 1024"');
    expect(svg.match(/<rect\b/g)).toHaveLength(5);
    expect(svg.match(/<circle\b/g)).toHaveLength(1);
    expect(svg.match(/<path\b/g)).toHaveLength(1);
    expect(svg).toContain('fill="#FFFFFF"');
    expect(svg).toContain('fill="#202022"');
    expect(svg).toContain('fill="#E27038"');

    const colors = [...svg.matchAll(/#[0-9A-Fa-f]{6}/g)].map(([color]) =>
      color.toUpperCase()
    );
    expect([...new Set(colors)].sort()).toEqual([
      "#202022",
      "#E27038",
      "#FFFFFF"
    ]);
    expect(svg).not.toMatch(/<(?:text|image|linearGradient|radialGradient|filter)\b/);
  });

  runOnMac("builds every required PNG and ICNS from the vector master", () => {
    const outputRoot = mkdtempSync(resolve(tmpdir(), "ditbrowse-icon-"));
    try {
      execFileSync(process.execPath, [
        resolve(process.cwd(), "scripts/build-mac-icon.mjs"),
        "--output-root",
        outputRoot
      ]);

      const expectedFiles = [
        "ditbrowse-icon-source.png",
        "ditbrowse-icon-1024.png",
        "ditbrowse.icns",
        "ditbrowse.iconset/icon_16x16.png",
        "ditbrowse.iconset/icon_16x16@2x.png",
        "ditbrowse.iconset/icon_32x32.png",
        "ditbrowse.iconset/icon_32x32@2x.png",
        "ditbrowse.iconset/icon_128x128.png",
        "ditbrowse.iconset/icon_128x128@2x.png",
        "ditbrowse.iconset/icon_256x256.png",
        "ditbrowse.iconset/icon_256x256@2x.png",
        "ditbrowse.iconset/icon_512x512.png",
        "ditbrowse.iconset/icon_512x512@2x.png",
        "DITBrowse.icon/icon.json",
        "DITBrowse.icon/Assets/ditbrowse-icon-source.svg"
      ];

      for (const relativePath of expectedFiles) {
        const outputPath = resolve(outputRoot, relativePath);
        expect(existsSync(outputPath), relativePath).toBe(true);
        expect(statSync(outputPath).size, relativePath).toBeGreaterThan(0);
      }

      const composerIconPath = resolve(outputRoot, "DITBrowse.icon");
      const composer = JSON.parse(
        readFileSync(resolve(composerIconPath, "icon.json"), "utf8")
      ) as {
        "fill-specializations": Array<{
          appearance?: string;
          value: { solid: string };
        }>;
        groups: Array<{ translucency: { enabled: boolean; value: number } }>;
      };

      expect(composer["fill-specializations"]).toEqual([
        {
          value: { solid: "extended-srgb:1.00000,1.00000,1.00000,1.00000" }
        },
        {
          appearance: "dark",
          value: { solid: "extended-srgb:1.00000,1.00000,1.00000,1.00000" }
        }
      ]);
      expect(composer.groups[0]?.translucency).toEqual({ enabled: false, value: 0 });
      expect(
        readFileSync(resolve(composerIconPath, "Assets/ditbrowse-icon-source.svg")).equals(
          readFileSync(sourceSvgPath)
        )
      ).toBe(true);
    } finally {
      rmSync(outputRoot, { recursive: true, force: true });
    }
  });

  runOnMac("applies explicit icon appearances to a macOS app bundle", () => {
    const temporaryRoot = mkdtempSync(resolve(tmpdir(), "ditbrowse-app-icon-"));
    const appPath = resolve(temporaryRoot, "DITBrowse.app");
    const contentsPath = resolve(appPath, "Contents");
    try {
      mkdirSync(resolve(contentsPath, "Resources"), { recursive: true });
      writeFileSync(
        resolve(contentsPath, "Info.plist"),
        `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleIdentifier</key><string>com.lightlab.ditbrowse.test</string>
<key>CFBundleName</key><string>DITBrowse</string>
<key>CFBundlePackageType</key><string>APPL</string>
<key>LSMinimumSystemVersion</key><string>12.0</string>
</dict></plist>\n`
      );

      execFileSync(process.execPath, [
        resolve(process.cwd(), "scripts/apply-mac-icon.mjs"),
        "--app-path",
        appPath
      ]);

      expect(existsSync(resolve(contentsPath, "Resources/DITBrowse.icns"))).toBe(true);
      expect(existsSync(resolve(contentsPath, "Resources/Assets.car"))).toBe(true);
      expect(
        execFileSync("/usr/bin/plutil", [
          "-extract",
          "CFBundleIconName",
          "raw",
          "-o",
          "-",
          resolve(contentsPath, "Info.plist")
        ], { encoding: "utf8" }).trim()
      ).toBe("DITBrowse");
      const compiledAssetInfo = execFileSync("/usr/bin/xcrun", [
        "assetutil",
        "--info",
        resolve(contentsPath, "Resources/Assets.car")
      ], { encoding: "utf8" });
      expect(compiledAssetInfo).toContain('"Appearance" : "NSAppearanceNameDarkAqua"');
      expect(compiledAssetInfo).toContain('"AssetType" : "IconImageStack"');
      expect(() =>
        execFileSync("/usr/bin/codesign", [
          "--verify",
          "--deep",
          "--strict",
          appPath
        ])
      ).not.toThrow();
    } finally {
      rmSync(temporaryRoot, { recursive: true, force: true });
    }
  });
});
