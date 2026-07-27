import { describe, expect, it, vi } from "vitest";
import { lockWebContentsZoom } from "./zoomGuard";

describe("lockWebContentsZoom", () => {
  it("keeps BrowserWindow zoom fixed so trackpad zoom is handled by individual webviews", () => {
    const listeners = new Map<string, (event: { preventDefault: () => void }) => void>();
    const webContents = {
      setVisualZoomLevelLimits: vi.fn(),
      setZoomFactor: vi.fn(),
      on: vi.fn((eventName: string, listener: (event: { preventDefault: () => void }) => void) => {
        listeners.set(eventName, listener);
      })
    };

    const onTemporaryViewGesture = vi.fn();

    lockWebContentsZoom(webContents, onTemporaryViewGesture);

    expect(webContents.setVisualZoomLevelLimits).toHaveBeenCalledWith(1, 1);
    expect(webContents.setZoomFactor).toHaveBeenCalledWith(1);
    expect(webContents.on).toHaveBeenCalledWith("zoom-changed", expect.any(Function));

    const preventDefault = vi.fn();
    listeners.get("zoom-changed")?.({ preventDefault }, "in");

    expect(preventDefault).toHaveBeenCalledTimes(1);
    expect(webContents.setZoomFactor).toHaveBeenLastCalledWith(1);
    expect(onTemporaryViewGesture).toHaveBeenCalledWith({ type: "pinch", deltaY: -100 });
  });
});
