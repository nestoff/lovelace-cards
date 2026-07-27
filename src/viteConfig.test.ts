// @vitest-environment node

import { describe, expect, it } from "vitest";
import config from "../vite.config";

describe("Vite config", () => {
  it("emits relative asset URLs so Electron file:// builds can load the renderer", () => {
    expect(config.base).toBe("./");
  });
});
