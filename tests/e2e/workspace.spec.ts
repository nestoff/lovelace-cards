import { expect, test, type Locator } from "@playwright/test";

async function readWebviewScale(webview: Locator): Promise<{ fit: number; scale: number }> {
  return webview.evaluate((element) => {
    const frame = element.parentElement?.getBoundingClientRect();
    const viewportWidth = Number.parseFloat((element as HTMLElement).style.width);
    const viewportHeight = Number.parseFloat((element as HTMLElement).style.height);
    const scaleMatch = (element as HTMLElement).style.transform.match(/scale\(([^)]+)\)/);

    if (!frame || !scaleMatch) {
      throw new Error("Unable to measure camera webview scale");
    }

    return {
      fit: Math.min(frame.width / viewportWidth, frame.height / viewportHeight),
      scale: Number(scaleMatch[1])
    };
  });
}

async function expectPersistentZoomMultiplier(
  webview: Locator,
  multiplier: number
): Promise<void> {
  await expect
    .poll(async () => {
      const { fit, scale } = await readWebviewScale(webview);
      return scale / fit;
    })
    .toBeCloseTo(multiplier, 2);
}

test("workspace shows row-major tiles and lets columns change", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByLabel("Camera tabs")).toBeVisible();
  await expect(page.getByLabel("Browser toolbar")).toBeVisible();
  await expect(page.getByRole("button", { name: "Camera List", exact: true })).toBeVisible();
  await expect(page.getByLabel("Grid columns")).toHaveValue("4");

  const tabsBox = await page.getByLabel("Camera tabs").boundingBox();
  const toolbarBox = await page.getByLabel("Browser toolbar").boundingBox();
  expect(tabsBox?.y).toBeLessThan(toolbarBox?.y ?? 0);

  const grid = page.locator(".tile-grid");
  await expect(grid).toHaveCSS("overflow", "hidden");
  const firstTile = page.locator(".tile-slot").first();
  await expect(firstTile).toBeVisible();
  const firstTileBox = await firstTile.boundingBox();
  expect(firstTileBox?.height).toBeGreaterThan(80);

  await page.getByLabel("Grid columns").selectOption("5");
  await expect(page.getByLabel("Grid columns")).toHaveValue("5");
  const resizedTileBox = await firstTile.boundingBox();
  expect(resizedTileBox?.height).toBeGreaterThan(80);

  const secondTileBox = await page.locator(".tile-slot").nth(1).boundingBox();
  expect(Math.abs((resizedTileBox?.height ?? 0) - (secondTileBox?.height ?? 0))).toBeLessThan(1);

  await expect(page.getByLabel("Selected tile zoom")).toBeVisible();
  await page.getByLabel("Selected tile zoom").fill("0.82");
  await expect(page.getByLabel("Selected tile zoom")).toHaveValue("0.82");

  const selectedResolution = page.getByRole("combobox", {
    name: "Selected camera resolution"
  });
  const applyResolutionToAll = page.getByRole("button", {
    name: "Apply resolution to all cameras"
  });
  await expect(selectedResolution).toHaveValue("1024x768");
  await expect(selectedResolution.locator("option:checked")).toHaveText("1024×768 · 4:3");
  await selectedResolution.selectOption("1280x720");
  await expect(page.locator('webview[data-tile-id="tile-41"]')).toHaveCSS(
    "width",
    "1280px"
  );
  await applyResolutionToAll.click();
  await expect(page.locator('webview[data-tile-id="tile-42"]')).toHaveCSS(
    "width",
    "1280px"
  );

  await page.getByLabel("Close A").click();
  await expect(page.getByLabel("Close A")).toHaveCount(0);
  await expect(page.getByRole("textbox", { name: "Address" })).toHaveValue("http://192.168.1.02");
});

test("camera tiles show live base-host ping status in grid and focus modes", async ({ page }) => {
  await page.addInitScript(() => {
    window.ditbrowse = {
      version: "e2e",
      pingHost: async (host) => ({
        host,
        reachable: true,
        latencyMs: 4.2,
        checkedAt: Date.now()
      })
    };
  });
  await page.goto("/");

  const firstTile = page.locator('.tile-slot:has(webview[data-tile-id="tile-41"])');
  await expect(firstTile.getByText("4.2 ms")).toBeVisible();
  await expect(firstTile.locator(".host-ping-indicator")).toHaveClass(/online/);
  await expect(firstTile.locator(".tile-label")).toHaveCSS("height", "24px");
  await expect(page.locator("webview")).toHaveCount(12);
  await expect(page.getByLabel("Tab A")).toHaveClass(/active/);

  await page.getByLabel("Focus selected page").click();

  await expect(firstTile).toBeVisible();
  await expect(firstTile.getByText("4.2 ms")).toBeVisible();
  await expect(page.locator("webview")).toHaveCount(12);
});

test("workspace settings persist the global ping interval", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Camera List", exact: true }).click();

  const interval = page.getByLabel("Ping interval in seconds");
  await expect(interval).toHaveValue("5");
  await interval.fill("12");
  await page.getByRole("button", { name: "Save Interval" }).click();
  await expect(
    page.getByLabel("Camera workspace settings").getByText("12s", { exact: true })
  ).toBeVisible();

  await page.getByRole("button", { name: "Discard", exact: true }).click();
  await page.waitForTimeout(350);
  await page.reload();
  await page.getByRole("button", { name: "Camera List", exact: true }).click();
  await expect(page.getByLabel("Ping interval in seconds")).toHaveValue("12");
});

test("an offline camera offers a reload for only its own webview", async ({ page }) => {
  await page.addInitScript(() => {
    window.ditbrowse = {
      version: "e2e",
      pingHost: async (host) => ({
        host,
        reachable: host.endsWith(".1"),
        latencyMs: host.endsWith(".1") ? 3.2 : null,
        checkedAt: host.endsWith(".1") ? Date.now() : Date.now() - 10_001
      })
    };
  });
  await page.goto("/");

  const firstTile = page.locator('.tile-slot:has(webview[data-tile-id="tile-41"])');
  const offlineTile = page.locator('.tile-slot:has(webview[data-tile-id="tile-42"])');
  const offlineWebview = offlineTile.locator("webview");
  await expect(firstTile.getByText("3.2 ms")).toBeVisible();
  await expect(
    firstTile.getByRole("button", { name: /Reload camera at/ })
  ).toHaveCount(0);

  const reload = offlineTile.getByRole("button", {
    name: "Reload camera at 192.168.1.2"
  });
  await expect(reload).toBeVisible();
  await offlineWebview.evaluate((element) => {
    const webview = element as HTMLElement & {
      getURL: () => string;
      loadURL: (url: string) => Promise<void>;
      reload: () => void;
    };
    webview.getURL = () => "http://192.168.1.02/index.html";
    webview.loadURL = async (url) => {
      webview.setAttribute("data-e2e-reloaded", url);
    };
    webview.reload = () => webview.setAttribute("data-e2e-fallback-reload", "true");
  });

  await reload.click();
  await expect(offlineWebview).toHaveAttribute(
    "data-e2e-reloaded",
    "http://192.168.1.02"
  );
  await expect(offlineWebview).not.toHaveAttribute("data-e2e-fallback-reload", "true");
});

test("Help opens as a full-page local tab and returns to the selected camera", async ({
  page
}) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/");

  const selectedAddress = await page
    .getByRole("textbox", { name: "Address" })
    .inputValue();
  await page.getByRole("button", { name: "Help", exact: true }).click();

  await expect(page.getByLabel("Help Guide")).toBeVisible();
  await expect(page.getByLabel("Browser toolbar")).toHaveCount(0);
  await expect(page.getByLabel("Tab Help")).toHaveClass(/active/);
  await expect(page.locator("webview")).toHaveCount(12);
  await expect(page.locator(".camera-workspace")).toHaveAttribute(
    "aria-hidden",
    "true"
  );
  await expect(page.locator(".camera-workspace")).toBeHidden();
  await expect(page.getByRole("link", { name: "Camera Setup" })).toHaveAttribute(
    "href",
    "#help-camera-setup"
  );
  const mainControlsLink = page.getByRole("link", { name: "Main Page Controls" });
  await expect(mainControlsLink).toHaveAttribute("href", "#help-main-controls");
  await mainControlsLink.click();
  await expect(
    page.getByRole("heading", { name: "Main Page Controls", exact: true })
  ).toBeVisible();
  await expect(page.getByLabel("Main Page Controls reference")).toBeVisible();

  for (const width of [960, 1180, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await expect(page.getByLabel("Help Guide")).toBeVisible();
    await expect(page.getByLabel("Help sections")).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "DITBrowse Help Guide" })
    ).toBeVisible();
    await expect(page.getByLabel("Main Page Controls reference")).toBeVisible();
    expect(
      await page.getByLabel("Help Guide").evaluate((element) => {
        return element.scrollWidth <= element.clientWidth;
      })
    ).toBe(true);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
      width
    );
  }

  await page.getByLabel("Close Help").click();
  await expect(page.getByLabel("Help Guide")).toHaveCount(0);
  await expect(page.getByLabel("Browser toolbar")).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Address" })).toHaveValue(
    selectedAddress
  );
  await expect(page.locator("webview")).toHaveCount(12);
});

test("camera list opens the full table and settings in one click", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("button", { name: "Camera List", exact: true }).click();

  const editor = page.getByLabel("Camera list editor");
  const table = page.getByRole("table");
  const tableWrap = page.locator(".camera-table-wrap");
  const settings = page.getByLabel("Camera workspace settings");
  await expect(editor).toBeVisible();
  await expect(table).toBeVisible();
  await expect(settings).toBeVisible();
  await expect(page.getByRole("button", { name: /Move .* left/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Move .* right/ })).toHaveCount(0);

  const tableWrapBox = await tableWrap.boundingBox();
  const settingsBox = await settings.boundingBox();
  expect(tableWrapBox?.height).toBeGreaterThan(300);
  expect(settingsBox?.y).toBeGreaterThan(
    (tableWrapBox?.y ?? 0) + (tableWrapBox?.height ?? 0)
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    (await page.viewportSize())?.width
  );
});

test("workspace settings stay compact and centered on wide displays", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 2048, height: 1040 });
  await page.goto("/");
  await page.getByRole("button", { name: "Camera List", exact: true }).click();

  const editor = page.getByLabel("Camera list editor");
  const settings = page.getByLabel("Camera workspace settings");
  await settings.scrollIntoViewIfNeeded();

  const editorBox = await editor.boundingBox();
  const settingsBox = await settings.boundingBox();
  expect(settingsBox?.width).toBeLessThanOrEqual(960);
  expect(
    Math.abs(
      (settingsBox?.x ?? 0) + (settingsBox?.width ?? 0) / 2 -
        ((editorBox?.x ?? 0) + (editorBox?.width ?? 0) / 2)
    )
  ).toBeLessThanOrEqual(1);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(2048);
  await settings.screenshot({
    path: testInfo.outputPath("workspace-settings-compact.png")
  });
});

test("toolbar stays inside the window at supported widths", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 2048, height: 1040 });
  await page.goto("/");

  const wideToolbar = page.getByLabel("Browser toolbar");
  const wideToolbarBox = await wideToolbar.boundingBox();
  expect((wideToolbarBox?.x ?? 0) + (wideToolbarBox?.width ?? 0)).toBeLessThanOrEqual(
    2048
  );
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(2048);
  await wideToolbar.screenshot({
    path: testInfo.outputPath("neutral-camera-toolbar.png")
  });

  for (const width of [960, 1180, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    const toolbar = page.getByLabel("Browser toolbar");
    const box = await toolbar.boundingBox();
    expect((box?.x ?? 0) + (box?.width ?? 0)).toBeLessThanOrEqual(width);
    await expect(page.getByRole("textbox", { name: "Address" })).toBeVisible();
    await expect(page.getByLabel("Focus selected page")).toBeVisible();
    await expect(page.getByLabel("Grid columns")).toBeVisible();
    await expect(page.getByLabel("Selected tile zoom")).toBeVisible();
    await expect(
      page.getByRole("combobox", { name: "Selected camera resolution" })
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Apply resolution to all cameras" })
    ).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
  }
});

test("Camera Session keeps safe reloads on the main page and out of settings", async ({
  page
}) => {
  await page.goto("/");

  const selectedWebview = page.locator('webview[data-tile-id="tile-41"]');
  await selectedWebview.evaluate((element) => {
    const webview = element as Electron.WebviewTag;
    webview.getURL = () => webview.getAttribute("src") ?? "";
    webview.reload = () => webview.setAttribute("data-e2e-reloaded", "true");
  });

  await page.getByRole("button", { name: "Camera Session" }).click();
  const sessionMenu = page.getByRole("menu");
  const sessionActions = sessionMenu.getByRole("menuitem");
  await expect(sessionActions).toHaveText([
    "Reload selected",
    "Reload all",
    "Sign out, forget login & reload selected",
    "Sign out, forget active-list logins & reload all…"
  ]);

  await sessionMenu
    .getByRole("menuitem", { name: "Reload selected", exact: true })
    .click();
  await expect(sessionMenu).toHaveCount(0);
  await expect(selectedWebview).toHaveAttribute("data-e2e-reloaded", "true");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "Camera List", exact: true }).click();
  const settings = page.getByLabel("Camera workspace settings");
  await expect(settings).toBeVisible();
  await expect(settings).not.toContainText(/Sign Out/i);
  await expect(settings).not.toContainText("Reload Every Camera");
  await expect(settings).not.toContainText("Forget Selected");
});

test("selected camera address overrides can return to prefix and suffix style", async ({ page }) => {
  await page.goto("/");

  const address = page.getByRole("textbox", { name: "Address" });
  await expect(address).toHaveValue("http://192.168.1.01");

  await address.fill("10.20.100.2");
  await address.press("Enter");

  await expect(address).toHaveValue("http://10.20.100.2");
  await expect(page.locator('webview[data-tile-id="tile-41"]')).toHaveAttribute(
    "src",
    "http://10.20.100.2"
  );

  const returnToPrefix = page.getByRole("button", {
    name: "Go back to prefix and suffix style"
  });
  await expect(returnToPrefix).toBeVisible();

  await returnToPrefix.click();

  await expect(address).toHaveValue("http://192.168.1.01");
  await expect(returnToPrefix).toBeHidden();
});

test("focus mode singles out the selected page without unmounting webviews", async ({ page }) => {
  await page.goto("/");

  const grid = page.locator(".tile-grid");
  const firstWebview = page.locator('webview[data-tile-id="tile-41"]');
  await expect(page.locator("webview")).toHaveCount(12);

  await page.getByLabel("Selected zoom percent").fill("105");
  await page.getByLabel("Selected zoom percent").press("Enter");
  await page.getByLabel("Global zoom controls").click();
  await page.getByLabel("All tiles relative zoom percent").fill("120");
  await page.getByLabel("All tiles relative zoom percent").press("Enter");
  await expectPersistentZoomMultiplier(firstWebview, 1.26);

  const gridBox = await grid.boundingBox();

  await page.getByLabel("Focus selected page").click();

  await expect(grid).toHaveClass(/focus-mode/);
  await expect(page.locator("webview")).toHaveCount(12);
  await expectPersistentZoomMultiplier(firstWebview, 1);

  const firstTile = page.locator('.tile-slot:has(webview[data-tile-id="tile-41"])');
  const secondTile = page.locator('.tile-slot:has(webview[data-tile-id="tile-42"])');
  await expect(firstTile).toBeVisible();
  await expect(secondTile).toBeHidden();

  const focusedBox = await firstTile.boundingBox();
  expect(focusedBox?.width).toBeGreaterThan((gridBox?.width ?? 0) - 20);
  expect(focusedBox?.height).toBeGreaterThan((gridBox?.height ?? 0) - 20);

  await page.locator('[aria-label="Tab B"] .tab-select').click();

  await expect(firstTile).toBeHidden();
  await expect(secondTile).toBeVisible();
  await expect(page.getByLabel("Show all pages")).toBeVisible();
  await expect(page.locator("webview")).toHaveCount(12);

  await page.getByLabel("Show all pages").click();

  await expect(grid).not.toHaveClass(/focus-mode/);
  await expect(firstTile).toBeVisible();
  await expect(secondTile).toBeVisible();
  await expectPersistentZoomMultiplier(firstWebview, 1.26);
});

test("clicking the page area of an inactive tile activates its tab", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByLabel("Tab A")).toHaveClass(/active/);
  await page.getByLabel("Activate B").click();

  await expect(page.getByLabel("Tab B")).toHaveClass(/active/);
  await expect(page.getByRole("textbox", { name: "Address" })).toHaveValue("http://192.168.1.02");
});

test("camera list supports spreadsheet navigation, copy, paste, and row growth", async ({
  page,
  context
}) => {
  await page.goto("/");
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(page.url()).origin
  });

  await page.getByRole("button", { name: "Camera List", exact: true }).click();

  await page.getByLabel("B type").fill("FR7");
  await page.getByLabel("A type").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("B type")).toBeFocused();
  expect(
    await page.getByLabel("B type").evaluate((input: HTMLInputElement) => ({
      start: input.selectionStart,
      end: input.selectionEnd,
      length: input.value.length
    }))
  ).toEqual({ start: 0, end: 3, length: 3 });

  await page.getByLabel("A index").click();
  await page.getByLabel("B camera number").click({ modifiers: ["Shift"] });
  expect(
    await page
      .getByLabel("A index")
      .locator("xpath=..")
      .evaluate((cell) => getComputedStyle(cell).backgroundColor)
  ).not.toBe("rgba(0, 0, 0, 0)");

  await page.keyboard.press("Meta+C");
  await expect
    .poll(() => page.evaluate(() => navigator.clipboard.readText()))
    .toBe("A\t01\nB\t02");

  await page.getByRole("button", { name: "Copy Table" }).click();
  const copiedTable = await page.evaluate(() => navigator.clipboard.readText());
  const copiedRows = copiedTable.split("\n").map((row) => row.split("\t"));
  expect(copiedRows[0]).toEqual([
    "Index",
    "Camera #",
    "Full URL",
    "Type",
    "Lens",
    "Display Note",
    "Viewport",
    "Zoom"
  ]);
  expect(copiedTable).not.toContain("Follow Prefix");

  const typeColumn = copiedRows[0].indexOf("Type");
  const lensColumn = copiedRows[0].indexOf("Lens");
  copiedRows[1][typeColumn] = "BURANO";
  copiedRows[1][lensColumn] = "85mm";
  await page.evaluate(
    (text) => navigator.clipboard.writeText(text),
    copiedRows.map((row) => row.join("\t")).join("\n")
  );

  await page.getByRole("spinbutton", { name: "L zoom", exact: true }).click();
  await page.keyboard.press("Meta+V");
  await expect(page.getByLabel("A type")).toHaveValue("BURANO");
  await expect(page.getByLabel("A lens")).toHaveValue("85mm");
  await expect(page.getByLabel("A follow prefix")).toBeChecked();
  await expect(page.getByRole("status")).toContainText("Pasted 96 cells");
  await expect(page.getByRole("status")).not.toContainText("added");

  await page.getByLabel("L index").click();
  await page.evaluate(() =>
    navigator.clipboard.writeText(
      "L\t12\t\tVENICE 2\t35mm\nM\t13\t\tFR7\t50mm\nN\t14\t\tBURANO\t85mm"
    )
  );
  await page.keyboard.press("Meta+V");

  await expect(page.getByLabel("M type")).toHaveValue("FR7");
  await expect(page.getByLabel("N lens")).toHaveValue("85mm");
  await expect(page.getByRole("status")).toContainText("added 2 camera rows");
  await page.getByRole("button", { name: "Save Changes" }).click();

  await expect(page.getByLabel("Tab N")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    (await page.viewportSize())?.width
  );
});
