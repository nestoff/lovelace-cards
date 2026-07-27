import { expect, test, type Locator, type Page } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { HttpAuthRequest } from "../../src/shared/httpAuth";
import { sampleWorkspace } from "../../src/shared/sampleData";
import type { WorkspaceState } from "../../src/shared/types";

declare global {
  interface Window {
    __helpAuthCallback?: (request: HttpAuthRequest) => void;
  }
}

test.skip(
  process.env.DITBROWSE_CAPTURE_HELP !== "1",
  "manual documentation capture"
);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const cleanDirectory = path.join(root, "docs/help/source-stills");
const annotatedDirectory = path.join(root, "src/renderer/help/assets");

interface Annotation {
  number: number;
  target: Locator;
  edge: "top" | "right" | "bottom" | "left";
  destructive?: boolean;
  targetRatio?: number;
  startRatio?: { x: number; y: number };
  viaRatios?: { x: number; y: number }[];
}

interface AnnotationGeometry {
  number: number;
  points: { x: number; y: number }[];
  destructive: boolean;
}

interface CaptureOptions {
  maxHeight?: number;
  extraBottom?: number;
  annotationBandHeight?: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(value, maximum));
}

async function captureStill(
  page: Page,
  name: string,
  crop: Locator,
  annotations: Annotation[],
  options: CaptureOptions = {}
): Promise<void> {
  await mkdir(cleanDirectory, { recursive: true });
  await mkdir(annotatedDirectory, { recursive: true });
  await crop.scrollIntoViewIfNeeded();
  await expect(crop).toBeVisible();

  const measuredCropBox = await crop.boundingBox();
  if (!measuredCropBox) {
    throw new Error(`Could not measure ${name} capture region`);
  }
  const cropBox = {
    ...measuredCropBox,
    height: Math.min(
      measuredCropBox.height + (options.extraBottom ?? 0),
      options.maxHeight ?? measuredCropBox.height + (options.extraBottom ?? 0)
    )
  };
  const scroll = await page.evaluate(() => ({ x: window.scrollX, y: window.scrollY }));
  const screenshotClip = {
    x: cropBox.x + scroll.x,
    y: cropBox.y + scroll.y,
    width: cropBox.width,
    height: cropBox.height
  };
  const cleanPath = path.join(cleanDirectory, `${name}.png`);
  const annotatedPath = path.join(annotatedDirectory, `${name}.png`);
  await page.screenshot({
    path: cleanPath,
    animations: "disabled",
    clip: screenshotClip
  });

  const geometry: AnnotationGeometry[] = [];
  for (const annotation of annotations) {
    await expect(annotation.target).toBeVisible();
    const targetBox = await annotation.target.boundingBox();
    if (!targetBox) {
      throw new Error(`Could not measure callout ${annotation.number} for ${name}`);
    }

    const targetRatio = annotation.targetRatio ?? 0.5;
    let endX = targetBox.x - cropBox.x + targetBox.width * targetRatio;
    let endY = targetBox.y - cropBox.y + targetBox.height * targetRatio;
    if (annotation.edge === "top") {
      endY = targetBox.y - cropBox.y;
    } else if (annotation.edge === "right") {
      endX = targetBox.x - cropBox.x + targetBox.width;
    } else if (annotation.edge === "bottom") {
      endY = targetBox.y - cropBox.y + targetBox.height;
    } else {
      endX = targetBox.x - cropBox.x;
    }

    let startX = annotation.startRatio
      ? cropBox.width * annotation.startRatio.x
      : endX;
    let startY = annotation.startRatio
      ? cropBox.height * annotation.startRatio.y
      : endY;
    if (!annotation.startRatio) {
      if (annotation.edge === "top") {
        startY -= 52;
      } else if (annotation.edge === "right") {
        startX += 52;
      } else if (annotation.edge === "bottom") {
        startY += 52;
      } else {
        startX -= 52;
      }
    }

    geometry.push({
      number: annotation.number,
      points: [
        {
          x: clamp(startX, 18, cropBox.width - 18),
          y: clamp(startY, 18, cropBox.height - 18)
        },
        ...(annotation.viaRatios ?? []).map((point) => ({
          x: clamp(cropBox.width * point.x, 8, cropBox.width - 8),
          y: clamp(cropBox.height * point.y, 8, cropBox.height - 8)
        })),
        {
          x: clamp(endX, 8, cropBox.width - 8),
          y: clamp(endY, 8, cropBox.height - 8)
        }
      ],
      destructive: annotation.destructive ?? false
    });
  }

  await page.evaluate(
    ({ box, items, annotationBandHeight }) => {
      document.getElementById("help-capture-annotations")?.remove();
      const namespace = "http://www.w3.org/2000/svg";
      const svg = document.createElementNS(namespace, "svg");
      svg.id = "help-capture-annotations";
      svg.setAttribute("viewBox", `0 0 ${box.width} ${box.height}`);
      Object.assign(svg.style, {
        position: "fixed",
        left: `${box.x}px`,
        top: `${box.y}px`,
        width: `${box.width}px`,
        height: `${box.height}px`,
        overflow: "visible",
        pointerEvents: "none",
        zIndex: "2147483647"
      });

      const defs = document.createElementNS(namespace, "defs");
      for (const [id, color] of [
        ["neutral", "#f1f1f1"],
        ["danger", "#e6817c"]
      ] as const) {
        const marker = document.createElementNS(namespace, "marker");
        marker.id = `help-arrow-${id}`;
        marker.setAttribute("markerWidth", "10");
        marker.setAttribute("markerHeight", "10");
        marker.setAttribute("refX", "8");
        marker.setAttribute("refY", "3");
        marker.setAttribute("orient", "auto");
        marker.setAttribute("markerUnits", "strokeWidth");
        const arrow = document.createElementNS(namespace, "path");
        arrow.setAttribute("d", "M0,0 L0,6 L9,3 z");
        arrow.setAttribute("fill", color);
        marker.append(arrow);
        defs.append(marker);
      }
      svg.append(defs);

      if (annotationBandHeight > 0) {
        const band = document.createElementNS(namespace, "rect");
        band.setAttribute("x", "0");
        band.setAttribute("y", String(box.height - annotationBandHeight));
        band.setAttribute("width", String(box.width));
        band.setAttribute("height", String(annotationBandHeight));
        band.setAttribute("fill", "#09090a");
        band.setAttribute("fill-opacity", "0.94");
        svg.append(band);
      }

      for (const item of items) {
        const color = item.destructive ? "#e6817c" : "#f1f1f1";
        const marker = item.destructive ? "danger" : "neutral";
        const path = document.createElementNS(namespace, "polyline");
        path.setAttribute(
          "points",
          item.points.map((point) => `${point.x},${point.y}`).join(" ")
        );
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", color);
        path.setAttribute("stroke-width", "3");
        path.setAttribute("stroke-linecap", "round");
        path.setAttribute("stroke-linejoin", "round");
        path.setAttribute("marker-end", `url(#help-arrow-${marker})`);
        svg.append(path);

        const start = item.points[0];

        const circle = document.createElementNS(namespace, "circle");
        circle.setAttribute("cx", String(start.x));
        circle.setAttribute("cy", String(start.y));
        circle.setAttribute("r", "14");
        circle.setAttribute("fill", "#1b1b1d");
        circle.setAttribute("stroke", color);
        circle.setAttribute("stroke-width", "3");
        svg.append(circle);

        const label = document.createElementNS(namespace, "text");
        label.setAttribute("x", String(start.x));
        label.setAttribute("y", String(start.y + 1));
        label.setAttribute("fill", color);
        label.setAttribute("font-family", "-apple-system, BlinkMacSystemFont, sans-serif");
        label.setAttribute("font-size", "13");
        label.setAttribute("font-weight", "750");
        label.setAttribute("text-anchor", "middle");
        label.setAttribute("dominant-baseline", "middle");
        label.textContent = String(item.number);
        svg.append(label);
      }

      document.body.append(svg);
    },
    { box: cropBox, items: geometry, annotationBandHeight: options.annotationBandHeight ?? 0 }
  );

  await page.screenshot({
    path: annotatedPath,
    animations: "disabled",
    clip: screenshotClip
  });
  await page.locator("#help-capture-annotations").evaluate((element) => element.remove());
}

async function createCaptureRegion(
  page: Page,
  id: string,
  targets: Locator[],
  padding = 0
): Promise<Locator> {
  const boxes = [];
  for (const target of targets) {
    await expect(target).toBeVisible();
    const box = await target.boundingBox();
    if (!box) {
      throw new Error(`Could not measure ${id} capture target`);
    }
    boxes.push(box);
  }
  const left = Math.min(...boxes.map((box) => box.x)) - padding;
  const top = Math.min(...boxes.map((box) => box.y)) - padding;
  const right = Math.max(...boxes.map((box) => box.x + box.width)) + padding;
  const bottom = Math.max(...boxes.map((box) => box.y + box.height)) + padding;

  await page.evaluate(
    ({ regionId, x, y, width, height }) => {
      document.getElementById(regionId)?.remove();
      const region = document.createElement("div");
      region.id = regionId;
      Object.assign(region.style, {
        position: "fixed",
        left: `${x}px`,
        top: `${y}px`,
        width: `${width}px`,
        height: `${height}px`,
        background: "transparent",
        pointerEvents: "none",
        zIndex: "2147483646"
      });
      document.body.append(region);
    },
    { regionId: id, x: left, y: top, width: right - left, height: bottom - top }
  );

  return page.locator(`#${id}`);
}

function buildSanitizedWorkspace(): WorkspaceState {
  const cameras = sampleWorkspace.cameraLists[0].cameras
    .slice(0, 4)
    .map((camera, index) => {
      const number = index + 1;
      const networkSuffix = String(number).padStart(2, "0");
      return {
        ...camera,
        name: String.fromCharCode(65 + index),
        suffix: String(number),
        url: `http://192.0.2.${networkSuffix}`,
        cameraType: index < 2 ? "Studio Camera" : "",
        lens: index === 0 ? "35mm" : "",
        displayNote: index === 0 ? "Wide" : ""
      };
    });

  return {
    ...sampleWorkspace,
    jobs: [{ id: "job-sample", name: "Example Job", listIds: ["list-sample"] }],
    cameraLists: [
      {
        ...sampleWorkspace.cameraLists[0],
        name: "Camera List",
        defaultPrefix: "http://192.0.2.",
        cameras
      }
    ],
    tiles: sampleWorkspace.tiles.slice(0, 4).map((tile, index) => ({
      ...tile,
      cameraId: cameras[index].id,
      url: cameras[index].url,
      title: `Camera ${index + 1}`
    })),
    selectedTileId: sampleWorkspace.tiles[0].id,
    credentialPresets: [
      {
        id: "preset-example",
        username: "operator",
        password: "••••••••",
        cameraType: "Studio Camera"
      }
    ],
    passwordRecords: [
      {
        id: "password-example",
        jobId: "job-sample",
        cameraListId: "list-sample",
        cameraId: cameras[0].id,
        url: cameras[0].url,
        username: "operator",
        password: "••••••••"
      }
    ],
    gridColumns: 2
  };
}

test("captures sanitized annotated Help stills from the real interface", async ({
  page
}) => {
  const workspace = buildSanitizedWorkspace();
  await page.setViewportSize({ width: 2048, height: 1200 });
  await page.addInitScript(({ initialWorkspace }) => {
    let authCallback: ((request: HttpAuthRequest) => void) | null = null;
    Object.defineProperty(window, "__helpAuthCallback", {
      configurable: true,
      get: () => authCallback
    });
    window.ditbrowse = {
      version: "help-capture",
      loadWorkspace: async () => initialWorkspace,
      saveWorkspace: async () => undefined,
      publishControlApiStatus: () => undefined,
      onHttpAuthRequest: (callback) => {
        authCallback = callback;
        return () => {
          authCallback = null;
        };
      },
      sendHttpAuthResponse: () => undefined
    } as Window["ditbrowse"];
  }, { initialWorkspace: workspace });

  await page.goto("/");
  await expect(page.getByRole("button", { name: "Help" })).toBeVisible();
  await expect(page.getByText(/AJ 12|ABCD1234|10\.20\.100\.|admin/i)).toHaveCount(0);

  await captureStill(page, "main-workspace", page.locator(".app-shell"), [
    {
      number: 1,
      target: page.getByRole("button", { name: "Camera List", exact: true }),
      edge: "bottom",
      startRatio: { x: 0.92, y: 0.16 },
      viaRatios: [
        { x: 0.985, y: 0.16 },
        { x: 0.985, y: 0.07 }
      ]
    },
    { number: 2, target: page.locator(".tile-camera-number").first(), edge: "bottom" },
    { number: 3, target: page.getByRole("button", { name: "Camera Session" }), edge: "bottom" }
  ]);

  const firstCameraTab = page.getByRole("button", { name: /^1 A/ });
  await captureStill(page, "main-tabs", page.locator(".browser-tab-row"), [
    {
      number: 1,
      target: firstCameraTab,
      edge: "bottom",
      targetRatio: 0.35
    },
    {
      number: 2,
      target: page.getByRole("button", { name: /^Close A/ }),
      edge: "bottom"
    },
    { number: 3, target: page.getByRole("button", { name: "Add tile", exact: true }), edge: "bottom" },
    { number: 4, target: page.getByRole("button", { name: "Help", exact: true }), edge: "bottom" },
    { number: 5, target: page.getByRole("button", { name: "Camera List", exact: true }), edge: "bottom" }
  ], { extraBottom: 64, annotationBandHeight: 58 });

  await page.getByRole("button", { name: "Camera List", exact: true }).click();
  const editor = page.getByLabel("Camera list editor");
  await expect(editor).toBeVisible();
  const tableSection = page.getByLabel("Editable camera table");
  await captureStill(page, "camera-list", tableSection, [
    {
      number: 1,
      target: page.getByLabel("List Prefix"),
      edge: "bottom",
      targetRatio: 0.25
    },
    { number: 2, target: page.getByLabel("Camera count"), edge: "bottom" },
    {
      number: 3,
      target: page.locator(".camera-table tbody tr").first(),
      edge: "top"
    }
  ], { maxHeight: 360 });

  const tableWrap = page.locator(".camera-table-wrap");
  await captureStill(page, "camera-row", tableWrap, [
    { number: 1, target: page.getByLabel("A camera number"), edge: "top" },
    { number: 2, target: page.getByLabel("A follow prefix"), edge: "bottom" },
    { number: 3, target: page.getByLabel("A URL"), edge: "bottom" },
    { number: 4, target: page.getByLabel("A type"), edge: "top" },
    { number: 5, target: page.getByLabel("A lens"), edge: "bottom" },
    { number: 6, target: page.getByLabel("A display note"), edge: "top" }
  ], { maxHeight: 230 });

  const settings = page.getByLabel("Camera workspace settings");
  await settings.scrollIntoViewIfNeeded();
  const credentialPresetSection = page.locator(".credential-preset-section");
  const savedPasswordSection = page.locator(".saved-password-section");
  const passwordRegion = await createCaptureRegion(
    page,
    "help-password-capture-region",
    [credentialPresetSection, savedPasswordSection],
    8
  );
  await captureStill(page, "password-settings", passwordRegion, [
    { number: 1, target: credentialPresetSection, edge: "right" },
    { number: 2, target: savedPasswordSection, edge: "right" }
  ]);
  await passwordRegion.evaluate((element) => element.remove());

  await page.getByRole("button", { name: "Discard" }).click();
  await expect(editor).toHaveCount(0);

  await page.getByRole("button", { name: "Camera List", exact: true }).click();
  await expect(editor).toBeVisible();
  await page.getByLabel("A follow prefix").uncheck();
  await page.getByLabel("A URL").fill("http://192.0.2.41");
  await page.getByRole("button", { name: "Save Changes", exact: true }).click();
  await expect(editor).toHaveCount(0);

  const address = page.getByRole("textbox", { name: "Address", exact: true });
  await page.locator(".tile-slot.selected webview").evaluate((element) => {
    const navigationEvent = new Event("did-navigate");
    Object.defineProperty(navigationEvent, "url", { value: "http://192.0.2.42" });
    Object.defineProperty(navigationEvent, "isMainFrame", { value: true });
    element.dispatchEvent(navigationEvent);
  });
  await expect(address).toHaveValue("http://192.0.2.42");
  const useListAddress = page.getByRole("button", {
    name: "Go back to prefix and suffix style",
    exact: true
  });
  const saveCurrentUrl = page.getByRole("button", {
    name: "Save current URL to camera list",
    exact: true
  });
  await expect(useListAddress).toBeVisible();
  await expect(saveCurrentUrl).toBeEnabled();

  const navigationRegion = await createCaptureRegion(
    page,
    "help-navigation-capture-region",
    [page.locator(".browser-navigation"), page.locator(".browser-toolbar-main")],
    8
  );
  await captureStill(page, "main-navigation", navigationRegion, [
    { number: 1, target: page.getByRole("button", { name: "Back", exact: true }), edge: "bottom" },
    { number: 2, target: page.getByRole("button", { name: "Forward", exact: true }), edge: "bottom" },
    { number: 3, target: page.getByRole("button", { name: "Camera Session", exact: true }), edge: "bottom" },
    { number: 4, target: address, edge: "bottom", targetRatio: 0.42 },
    { number: 5, target: page.getByRole("button", { name: "Open address", exact: true }), edge: "bottom" },
    { number: 6, target: page.getByRole("button", { name: "Open address in new tile", exact: true }), edge: "bottom" },
    { number: 7, target: saveCurrentUrl, edge: "bottom" },
    { number: 8, target: useListAddress, edge: "bottom" }
  ], { extraBottom: 64, annotationBandHeight: 58 });
  await navigationRegion.evaluate((element) => element.remove());

  const globalZoomButton = page.getByRole("button", {
    name: "Global zoom controls",
    exact: true
  });
  await globalZoomButton.click();
  const globalZoomPanel = page.getByLabel("Global zoom controls panel");
  await expect(globalZoomPanel).toBeVisible();
  const layoutRegion = await createCaptureRegion(
    page,
    "help-layout-capture-region",
    [page.locator(".browser-layout-controls"), globalZoomPanel],
    8
  );
  await captureStill(page, "main-layout", layoutRegion, [
    { number: 1, target: page.getByRole("button", { name: "Focus selected page", exact: true }), edge: "bottom" },
    { number: 2, target: page.getByLabel("Grid columns"), edge: "bottom" },
    {
      number: 3,
      target: page.locator(".zoom-control"),
      edge: "bottom",
      targetRatio: 0.32,
      startRatio: { x: 0.43, y: 0.91 },
      viaRatios: [
        { x: 0.05, y: 0.91 },
        { x: 0.05, y: 0.28 },
        { x: 0.32, y: 0.28 }
      ]
    },
    {
      number: 4,
      target: globalZoomButton,
      edge: "bottom",
      startRatio: { x: 0.57, y: 0.91 },
      viaRatios: [
        { x: 0.62, y: 0.91 },
        { x: 0.62, y: 0.29 },
        { x: 0.53, y: 0.29 }
      ]
    },
    { number: 5, target: globalZoomPanel, edge: "right" },
    { number: 6, target: page.getByLabel("Selected camera resolution"), edge: "bottom" },
    { number: 7, target: page.getByRole("button", { name: "Apply resolution to all cameras", exact: true }), edge: "bottom" }
  ], { extraBottom: 48, annotationBandHeight: 42 });
  await layoutRegion.evaluate((element) => element.remove());
  await globalZoomButton.click();

  await page.evaluate(() => {
    window.__helpAuthCallback?.({
      requestId: "help-auth",
      url: "http://192.0.2.02",
      host: "192.0.2.02",
      port: 80
    });
  });
  const signInDialog = page.getByRole("dialog");
  await expect(signInDialog).toBeVisible();
  await captureStill(page, "sign-in", signInDialog, [
    {
      number: 1,
      target: page.getByRole("button", { name: "Use Studio Camera login & Sign In" }),
      edge: "right"
    },
    { number: 2, target: page.locator(".http-auth-save"), edge: "right" }
  ]);
  await page.getByRole("button", { name: "Cancel" }).click();

  await page.getByRole("button", { name: "Camera Session" }).click();
  const sessionPanel = page.getByRole("menu");
  await expect(sessionPanel).toBeVisible();
  await captureStill(page, "camera-session", sessionPanel, [
    {
      number: 1,
      target: page.getByRole("menuitem", { name: "Reload selected", exact: true }),
      edge: "right"
    },
    {
      number: 2,
      target: page.getByRole("menuitem", { name: "Reload all", exact: true }),
      edge: "right"
    },
    {
      number: 3,
      target: page.getByRole("menuitem", {
        name: "Sign out, forget login & reload selected",
        exact: true
      }),
      edge: "right",
      destructive: true
    },
    {
      number: 4,
      target: page.getByRole("menuitem", {
        name: "Sign out, forget active-list logins & reload all…",
        exact: true
      }),
      edge: "right",
      destructive: true
    }
  ]);
});
