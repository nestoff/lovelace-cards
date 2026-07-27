import { cameraRootFromUrl } from "../shared/url";

export type SelectedTileCommand = "back" | "forward" | "reload";

const RELOAD_ALL_STAGGER_MS = 750;

function findWebviewForTile(tileId: string | null): Electron.WebviewTag | null {
  if (!tileId) {
    return null;
  }

  const webviews = Array.from(document.querySelectorAll("webview")) as Electron.WebviewTag[];
  return webviews.find((webview) => webview.getAttribute("data-tile-id") === tileId) ?? null;
}

export function findTileIdForWebContentsId(
  webContentsId: number | undefined
): string | null {
  if (!Number.isSafeInteger(webContentsId) || (webContentsId ?? 0) <= 0) {
    return null;
  }

  const webviews = Array.from(
    document.querySelectorAll("webview[data-tile-id]")
  ) as Electron.WebviewTag[];
  for (const webview of webviews) {
    try {
      if (
        typeof webview.getWebContentsId === "function" &&
        webview.getWebContentsId() === webContentsId
      ) {
        return webview.getAttribute("data-tile-id");
      }
    } catch {
      // A guest can disappear while an authentication challenge is being routed.
    }
  }

  return null;
}

export async function clearTileRuntimeSession(tileId: string): Promise<boolean> {
  const webview = findWebviewForTile(tileId);
  if (!webview || typeof webview.executeJavaScript !== "function") {
    return false;
  }

  try {
    webview.stop?.();
    await webview.executeJavaScript("sessionStorage.clear()", true);
    return true;
  } catch {
    return false;
  }
}

export async function loadTileBaseAddress(
  tileId: string,
  baseUrl: string
): Promise<boolean> {
  const webview = findWebviewForTile(tileId);
  if (!webview || typeof webview.loadURL !== "function") {
    return false;
  }

  try {
    await webview.loadURL(baseUrl);
    return true;
  } catch {
    return false;
  }
}

export function reloadWebviewFromCameraRoot(
  webview: Electron.WebviewTag,
  fallbackUrl?: string
): void {
  const currentUrl = typeof webview.getURL === "function" ? webview.getURL() : "";
  const sourceUrl = currentUrl || fallbackUrl || webview.getAttribute("src") || "";
  const rootUrl = cameraRootFromUrl(sourceUrl);

  if (
    rootUrl &&
    rootUrl !== sourceUrl &&
    typeof webview.loadURL === "function"
  ) {
    void webview.loadURL(rootUrl).catch(() => webview.reload());
    return;
  }

  webview.reload();
}

export function runSelectedTileCommand(
  tileId: string | null,
  command: SelectedTileCommand
): void {
  const webview = findWebviewForTile(tileId);
  if (!webview) {
    return;
  }

  if (command === "back" && webview.canGoBack()) {
    webview.goBack();
    return;
  }

  if (command === "forward" && webview.canGoForward()) {
    webview.goForward();
    return;
  }

  if (command === "reload") {
    reloadWebviewFromCameraRoot(webview);
  }
}

export function runAllTileCommand(command: Extract<SelectedTileCommand, "reload">): void {
  if (command !== "reload") {
    return;
  }

  const webviews = Array.from(document.querySelectorAll("webview")) as Electron.WebviewTag[];
  webviews.forEach((webview, index) => {
    window.setTimeout(() => reloadWebviewFromCameraRoot(webview), index * RELOAD_ALL_STAGGER_MS);
  });
}
