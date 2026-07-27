import { _electron as electron, expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

test("an empty saved window state cannot prevent the app window from opening", async () => {
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), "ditbrowse-window-e2e-"));
  await fs.writeFile(path.join(userDataPath, "window-state.json"), "", "utf8");
  const packagedExecutable = process.env.DITBROWSE_E2E_EXECUTABLE?.trim();

  const launch = () =>
    electron.launch({
      ...(packagedExecutable ? { executablePath: packagedExecutable } : {}),
      args: packagedExecutable
        ? [`--user-data-dir=${userDataPath}`]
        : [path.resolve("."), `--user-data-dir=${userDataPath}`],
      env: {
        ...process.env,
        DITBROWSE_E2E_CAMERA_URL: "http://127.0.0.1:1"
      }
    });

  try {
    const firstLaunch = await launch();
    const firstWindow = await firstLaunch.firstWindow();
    await expect(firstWindow.getByLabel("Browser toolbar")).toBeVisible();
    await firstLaunch.close();

    const secondLaunch = await launch();
    const secondWindow = await secondLaunch.firstWindow();
    await expect(secondWindow.getByLabel("Browser toolbar")).toBeVisible();
    await secondLaunch.close();
  } finally {
    await fs.rm(userDataPath, { recursive: true, force: true });
  }
});
