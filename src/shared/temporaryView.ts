import type { ViewportSize } from "./types.js";

export interface TemporaryView {
  zoom: number;
  offsetX: number;
  offsetY: number;
}

export type TemporaryViewGesture =
  | { type: "pinch"; deltaY: number }
  | { type: "pan"; deltaX: number; deltaY: number }
  | { type: "reset" };

export const DEFAULT_TEMPORARY_VIEW: TemporaryView = {
  zoom: 1,
  offsetX: 0,
  offsetY: 0
};

const PINCH_SENSITIVITY = 0.025;
const PAN_SENSITIVITY = 3.5;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function roundView(view: TemporaryView): TemporaryView {
  return {
    zoom: Number(view.zoom.toFixed(4)),
    offsetX: Number(view.offsetX.toFixed(2)),
    offsetY: Number(view.offsetY.toFixed(2))
  };
}

function clampPan(
  view: TemporaryView,
  frame: ViewportSize,
  viewport: ViewportSize,
  fitScale: number
): TemporaryView {
  const scaledWidth = viewport.width * fitScale * view.zoom;
  const scaledHeight = viewport.height * fitScale * view.zoom;
  const maxX = Math.max(0, (scaledWidth - frame.width) / 2);
  const maxY = Math.max(0, (scaledHeight - frame.height) / 2);

  return roundView({
    zoom: view.zoom,
    offsetX: clamp(view.offsetX, -maxX, maxX),
    offsetY: clamp(view.offsetY, -maxY, maxY)
  });
}

export function applyTemporaryViewGesture(
  view: TemporaryView,
  gesture: TemporaryViewGesture,
  frame: ViewportSize,
  viewport: ViewportSize,
  fitScale: number
): TemporaryView {
  if (gesture.type === "reset") {
    return DEFAULT_TEMPORARY_VIEW;
  }

  if (gesture.type === "pinch") {
    const zoom = clamp(view.zoom * Math.exp(-gesture.deltaY * PINCH_SENSITIVITY), 1, 8);
    if (zoom <= 1.0001) {
      return DEFAULT_TEMPORARY_VIEW;
    }

    return clampPan({ ...view, zoom }, frame, viewport, fitScale);
  }

  if (view.zoom <= 1) {
    return DEFAULT_TEMPORARY_VIEW;
  }

  return clampPan(
    {
      zoom: view.zoom,
      offsetX: view.offsetX - gesture.deltaX * PAN_SENSITIVITY,
      offsetY: view.offsetY - gesture.deltaY * PAN_SENSITIVITY
    },
    frame,
    viewport,
    fitScale
  );
}
