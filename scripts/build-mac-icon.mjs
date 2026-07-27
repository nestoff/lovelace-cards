import { execFileSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync
} from "node:fs";
import path from "node:path";

const sourceSvgPath = path.resolve("assets/icon/ditbrowse-icon-source.svg");
const outputRootArgumentIndex = process.argv.indexOf("--output-root");
const outputRootArgument =
  outputRootArgumentIndex >= 0 ? process.argv[outputRootArgumentIndex + 1] : undefined;
if (outputRootArgumentIndex >= 0 && !outputRootArgument) {
  throw new Error("--output-root requires a directory path");
}
const outputRoot = outputRootArgument
  ? path.resolve(outputRootArgument)
  : path.resolve("assets/icon");

if (!existsSync(sourceSvgPath)) {
  throw new Error(`Missing vector icon source: ${sourceSvgPath}`);
}
const sourcePngPath = path.join(outputRoot, "ditbrowse-icon-source.png");
const png1024Path = path.join(outputRoot, "ditbrowse-icon-1024.png");
const iconsetPath = path.join(outputRoot, "ditbrowse.iconset");
const icnsPath = path.join(outputRoot, "ditbrowse.icns");
const composerIconPath = path.join(outputRoot, "DITBrowse.icon");

mkdirSync(outputRoot, { recursive: true });
rmSync(iconsetPath, { recursive: true, force: true });
mkdirSync(iconsetPath, { recursive: true });

execFileSync("/usr/bin/sips", [
  "-s",
  "format",
  "png",
  sourceSvgPath,
  "--out",
  sourcePngPath
]);
execFileSync("/usr/bin/sips", [
  "-z",
  "1024",
  "1024",
  sourcePngPath,
  "--out",
  png1024Path
]);

const iconsetEntries = [
  ["icon_16x16.png", 16],
  ["icon_16x16@2x.png", 32],
  ["icon_32x32.png", 32],
  ["icon_32x32@2x.png", 64],
  ["icon_128x128.png", 128],
  ["icon_128x128@2x.png", 256],
  ["icon_256x256.png", 256],
  ["icon_256x256@2x.png", 512],
  ["icon_512x512.png", 512],
  ["icon_512x512@2x.png", 1024]
];

for (const [fileName, size] of iconsetEntries) {
  execFileSync("/usr/bin/sips", [
    "-z",
    String(size),
    String(size),
    png1024Path,
    "--out",
    path.join(iconsetPath, String(fileName))
  ]);
}

rmSync(composerIconPath, { recursive: true, force: true });
mkdirSync(path.join(composerIconPath, "Assets"), { recursive: true });
copyFileSync(
  sourceSvgPath,
  path.join(composerIconPath, "Assets", "ditbrowse-icon-source.svg")
);
writeFileSync(
  path.join(composerIconPath, "icon.json"),
  `${JSON.stringify(
    {
      "fill-specializations": [
        {
          value: {
            solid: "extended-srgb:1.00000,1.00000,1.00000,1.00000"
          }
        },
        {
          appearance: "dark",
          value: {
            solid: "extended-srgb:1.00000,1.00000,1.00000,1.00000"
          }
        }
      ],
      groups: [
        {
          layers: [
            {
              "image-name": "ditbrowse-icon-source.svg",
              name: "ditbrowse-icon-source"
            }
          ],
          shadow: {
            kind: "neutral",
            opacity: 0.5
          },
          translucency: {
            enabled: false,
            value: 0
          }
        }
      ],
      "supported-platforms": {
        circles: ["watchOS"],
        squares: "shared"
      }
    },
    null,
    2
  )}\n`
);

execFileSync("/usr/bin/iconutil", [
  "-c",
  "icns",
  iconsetPath,
  "-o",
  icnsPath
]);
copyFileSync(png1024Path, sourcePngPath);

console.log(`Built Camera Wall icon assets at ${outputRoot}`);
