import type { TemporaryViewGesture } from "../shared/temporaryView.js";

interface ZoomLockedWebContents {
  setVisualZoomLevelLimits: (minimumLevel: number, maximumLevel: number) => Promise<void> | void;
  setZoomFactor: (factor: number) => void;
  on: (
    eventName: "zoom-changed",
    listener: (event: { preventDefault: () => void }, zoomDirection?: "in" | "out") => void
  ) => void;
}

export function lockWebContentsZoom(
  webContents: ZoomLockedWebContents,
  onTemporaryViewGesture?: (gesture: TemporaryViewGesture) => void
): void {
  void webContents.setVisualZoomLevelLimits(1, 1);
  webContents.setZoomFactor(1);
  webContents.on("zoom-changed", (event, zoomDirection) => {
    event.preventDefault();
    webContents.setZoomFactor(1);
    if (zoomDirection) {
      onTemporaryViewGesture?.({
        type: "pinch",
        deltaY: zoomDirection === "in" ? -100 : 100
      });
    }
  });
}
