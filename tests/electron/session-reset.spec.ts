import { _electron as electron, expect, test } from "@playwright/test";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { startMockCameraServer } from "../e2e/mock-camera-server";

test("camera reset clears authentication and reloads the base redirect", async ({}, testInfo) => {
  const camera = await startMockCameraServer({
    landingPath: "/rmt.html",
    requireBasicAuth: true,
    username: "admin",
    password: "secret"
  });
  const userDataPath = await fs.mkdtemp(path.join(os.tmpdir(), "ditbrowse-e2e-"));
  const packagedExecutable = process.env.DITBROWSE_E2E_EXECUTABLE?.trim();
  const app = await electron.launch({
    ...(packagedExecutable ? { executablePath: packagedExecutable } : {}),
    args: packagedExecutable
      ? [`--user-data-dir=${userDataPath}`]
      : [path.resolve("."), `--user-data-dir=${userDataPath}`],
    env: {
      ...process.env,
      DITBROWSE_E2E_CAMERA_URL: camera.url
    }
  });

  try {
    const window = await app.firstWindow();
    const signInDialog = window.getByRole("dialog", { name: "Camera sign in" });
    await signInDialog.waitFor();
    await signInDialog.getByLabel("Username").fill("admin");
    await signInDialog.getByLabel("Password").fill("secret");
    await signInDialog.getByRole("button", { name: "Sign In" }).click();

    await expect(
      window.getByRole("textbox", { name: "Address", exact: true })
    ).toHaveValue(`${camera.url}/rmt.html`);
    const pingStatus = window.locator(".host-ping-indicator").first();
    await expect(pingStatus).toHaveClass(/online/);
    await expect(pingStatus).toHaveAttribute("aria-label", /^Ping 127\.0\.0\.1: /);
    const webview = window.locator('webview[data-tile-id="tile-41"]');
    await expect
      .poll(() =>
        webview.evaluate(async (element) =>
          (element as Electron.WebviewTag).executeJavaScript(
            `({
              local: localStorage.getItem("mock-camera-local"),
              session: sessionStorage.getItem("mock-camera-session")
            })`,
            true
          )
        )
      )
      .toEqual({ local: "active", session: "active" });

    const rootRequestsBeforeResize = camera.requests.filter(
      (request) => request.url === "/"
    ).length;
    for (const viewport of [
      { width: 960, height: 640 },
      { width: 1180, height: 800 },
      { width: 1440, height: 900 }
    ]) {
      await window.setViewportSize(viewport);
      const toolbarBounds = await window.getByLabel("Browser toolbar").boundingBox();
      const resolutionBounds = await window
        .getByLabel("Selected camera resolution")
        .boundingBox();
      expect((toolbarBounds?.x ?? 0) + (toolbarBounds?.width ?? 0)).toBeLessThanOrEqual(
        viewport.width
      );
      expect(
        (resolutionBounds?.x ?? 0) + (resolutionBounds?.width ?? 0)
      ).toBeLessThanOrEqual(viewport.width);
      await expect(
        window.getByRole("textbox", { name: "Address", exact: true })
      ).toHaveValue(`${camera.url}/rmt.html`);
      expect(
        await webview.evaluate((element) => (element as Electron.WebviewTag).getURL())
      ).toBe(`${camera.url}/rmt.html`);
      expect(await window.evaluate(() => document.documentElement.scrollWidth)).toBe(
        viewport.width
      );
      await window.screenshot({
        path: testInfo.outputPath(`workspace-${viewport.width}x${viewport.height}.png`)
      });
    }
    expect(camera.requests.filter((request) => request.url === "/")).toHaveLength(
      rootRequestsBeforeResize
    );

    await window.getByRole("button", { name: "Camera List", exact: true }).click();
    const settingsBeforeReset = window.getByLabel("Camera workspace settings");
    await expect(settingsBeforeReset).toContainText(camera.url);
    await window.getByRole("button", { name: "Discard", exact: true }).click();
    await expect(settingsBeforeReset).toBeHidden();

    await window.getByRole("button", { name: "Camera Session", exact: true }).click();
    await window
      .getByRole("menuitem", {
        name: "Sign out, forget login & reload selected",
        exact: true
      })
      .click();

    await expect(signInDialog).toBeVisible();
    await expect(signInDialog.getByLabel("Username")).toHaveValue("");
    await expect(signInDialog.getByLabel("Password")).toHaveValue("");

    await expect
      .poll(() => camera.requests.filter((request) => request.url === "/").length)
      .toBeGreaterThan(rootRequestsBeforeResize);
    const firstResetRootRequest = camera.requests.filter(
      (request) => request.url === "/"
    )[rootRequestsBeforeResize];
    expect(firstResetRootRequest.authorization).toBe("");

    await signInDialog.getByLabel("Save for this camera").uncheck();
    await signInDialog.getByLabel("Username").fill("admin");
    await signInDialog.getByLabel("Password").fill("secret");
    await signInDialog.getByRole("button", { name: "Sign In", exact: true }).click();

    await expect(window.getByRole("status")).toContainText("Cleared camera data");
    await expect(
      window.getByRole("textbox", { name: "Address", exact: true })
    ).toHaveValue(`${camera.url}/rmt.html`);
    await expect
      .poll(() => webview.evaluate((element) => (element as Electron.WebviewTag).getURL()))
      .toBe(`${camera.url}/rmt.html`);

    await window.getByRole("button", { name: "Camera List", exact: true }).click();
    const settingsAfterReset = window.getByLabel("Camera workspace settings");
    await expect(settingsAfterReset).not.toContainText(camera.url);
    await window.getByRole("button", { name: "Discard", exact: true }).click();
    await expect(settingsAfterReset).toBeHidden();
  } finally {
    await app.close();
    await camera.close();
    await fs.rm(userDataPath, { recursive: true, force: true });
  }
});
