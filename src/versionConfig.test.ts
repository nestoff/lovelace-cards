import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

function json(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), "utf8"));
}

describe("v1 release versions", () => {
  it("keeps the app at 1.0.2 and the Companion module at 1.0.0", () => {
    const app = json("package.json");
    const lock = json("package-lock.json") as {
      version: string;
      packages: Record<string, { version?: string }>;
    };
    const companion = json("companion-module-lightlab-ditbrowse/package.json");

    expect(app.version).toBe("1.0.2");
    expect(lock.version).toBe("1.0.2");
    expect(lock.packages[""]?.version).toBe("1.0.2");
    expect(companion.version).toBe("1.0.0");
  });
});
