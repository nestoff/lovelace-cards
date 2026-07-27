import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearTileRuntimeSession,
  findTileIdForWebContentsId,
  loadTileBaseAddress,
  runAllTileCommand,
  runSelectedTileCommand
} from "./browserControls";

function addWebview(tileId: string): Electron.WebviewTag {
  const webview = document.createElement("webview") as Electron.WebviewTag;
  webview.setAttribute("data-tile-id", tileId);
  webview.canGoBack = vi.fn(() => true);
  webview.canGoForward = vi.fn(() => true);
  webview.goBack = vi.fn();
  webview.goForward = vi.fn();
  webview.reload = vi.fn();
  webview.loadURL = vi.fn(async () => undefined);
  webview.getURL = vi.fn(() => "http://10.20.100.105/rmt.html");
  webview.stop = vi.fn();
  webview.executeJavaScript = vi.fn(async () => undefined);
  document.body.append(webview);
  return webview;
}

describe("findTileIdForWebContentsId", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("maps an Electron guest ID to its mounted camera tile", () => {
    const first = addWebview("tile-a");
    const second = addWebview("tile-b");
    first.getWebContentsId = vi.fn(() => 41);
    second.getWebContentsId = vi.fn(() => 42);

    expect(findTileIdForWebContentsId(42)).toBe("tile-b");
    expect(findTileIdForWebContentsId(undefined)).toBeNull();
    expect(findTileIdForWebContentsId(-1)).toBeNull();
    expect(findTileIdForWebContentsId(999)).toBeNull();
  });

  it("continues looking when a guest disappears during auth routing", () => {
    const disappearing = addWebview("tile-gone");
    const matching = addWebview("tile-live");
    disappearing.getWebContentsId = vi.fn(() => {
      throw new Error("guest destroyed");
    });
    matching.getWebContentsId = vi.fn(() => 52);

    expect(findTileIdForWebContentsId(52)).toBe("tile-live");
  });
});

describe("runSelectedTileCommand", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("runs back on the selected webview only", () => {
    const first = addWebview("tile-1");
    const second = addWebview("tile-2");

    runSelectedTileCommand("tile-2", "back");

    expect(first.goBack).not.toHaveBeenCalled();
    expect(second.goBack).toHaveBeenCalledTimes(1);
  });

  it("reloads the selected webview from the camera root", () => {
    const webview = addWebview("tile-1");

    runSelectedTileCommand("tile-1", "reload");

    expect(webview.loadURL).toHaveBeenCalledWith("http://10.20.100.105");
    expect(webview.reload).not.toHaveBeenCalled();
  });

  it("reloads a typed bare camera IP from the exact root address", () => {
    const webview = addWebview("tile-1");
    webview.getURL = vi.fn(() => "http://10.20.100.107/rmt.html");

    runSelectedTileCommand("tile-1", "reload");

    expect(webview.loadURL).toHaveBeenCalledWith("http://10.20.100.107");
    expect(webview.reload).not.toHaveBeenCalled();
  });

  it("falls back to normal reload for non-http webviews", () => {
    const webview = addWebview("tile-1");
    webview.getURL = vi.fn(() => "about:blank");

    runSelectedTileCommand("tile-1", "reload");

    expect(webview.loadURL).not.toHaveBeenCalled();
    expect(webview.reload).toHaveBeenCalledTimes(1);
  });

  it("reloads all webviews from their camera roots", () => {
    vi.useFakeTimers();
    const first = addWebview("tile-1");
    const second = addWebview("tile-2");
    second.getURL = vi.fn(() => "http://10.20.100.106/index.html");

    runAllTileCommand("reload");

    expect(first.loadURL).not.toHaveBeenCalled();
    expect(second.loadURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(first.loadURL).toHaveBeenCalledWith("http://10.20.100.105");
    expect(second.loadURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(750);
    expect(second.loadURL).toHaveBeenCalledWith("http://10.20.100.106");
  });

  it("clears sessionStorage and stops the selected guest", async () => {
    const webview = addWebview("tile-1");

    await expect(clearTileRuntimeSession("tile-1")).resolves.toBe(true);

    expect(webview.stop).toHaveBeenCalledOnce();
    expect(webview.executeJavaScript).toHaveBeenCalledWith("sessionStorage.clear()", true);
  });

  it("reports a guest cleanup failure without throwing", async () => {
    const webview = addWebview("tile-1");
    webview.executeJavaScript = vi.fn(async () => {
      throw new Error("guest unavailable");
    });

    await expect(clearTileRuntimeSession("tile-1")).resolves.toBe(false);
  });

  it("loads an exact base address into one tile", async () => {
    const webview = addWebview("tile-1");

    await expect(
      loadTileBaseAddress("tile-1", "http://10.20.100.108/")
    ).resolves.toBe(true);

    expect(webview.loadURL).toHaveBeenCalledWith("http://10.20.100.108/");
  });
});
