import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/electron",
  workers: 1,
  timeout: 120_000,
  use: {
    trace: "on-first-retry"
  }
});
