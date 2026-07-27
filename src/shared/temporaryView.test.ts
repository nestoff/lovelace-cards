import { describe, expect, it } from "vitest";
import { applyTemporaryViewGesture, DEFAULT_TEMPORARY_VIEW } from "./temporaryView";

describe("applyTemporaryViewGesture", () => {
  it("uses trackpad pinch deltas as temporary zoom", () => {
    const view = applyTemporaryViewGesture(
      DEFAULT_TEMPORARY_VIEW,
      { type: "pinch", deltaY: -100 },
      { width: 1024, height: 768 },
      { width: 1024, height: 768 },
      1
    );

    expect(view).toMatchObject({
      zoom: 8,
      offsetX: 0,
      offsetY: 0
    });
  });

  it("uses responsive trackpad pan deltas before clamping", () => {
    const view = applyTemporaryViewGesture(
      { zoom: 2, offsetX: 0, offsetY: 0 },
      { type: "pan", deltaX: 20, deltaY: -10 },
      { width: 500, height: 400 },
      { width: 1024, height: 768 },
      0.5
    );

    expect(view).toEqual({
      zoom: 2,
      offsetX: -70,
      offsetY: 35
    });
  });

  it("resets temporary zoom and pan on reset gestures", () => {
    const view = applyTemporaryViewGesture(
      { zoom: 2, offsetX: 80, offsetY: -40 },
      { type: "reset" },
      { width: 1024, height: 768 },
      { width: 1024, height: 768 },
      1
    );

    expect(view).toEqual(DEFAULT_TEMPORARY_VIEW);
  });

  it("resets pan when pinching back to the fitted view", () => {
    const view = applyTemporaryViewGesture(
      { zoom: 1.2, offsetX: 40, offsetY: -20 },
      { type: "pinch", deltaY: 1000 },
      { width: 1024, height: 768 },
      { width: 1024, height: 768 },
      1
    );

    expect(view).toEqual(DEFAULT_TEMPORARY_VIEW);
  });

  it("pans only while temporarily zoomed and clamps to the visible scaled content", () => {
    const unzoomed = applyTemporaryViewGesture(
      DEFAULT_TEMPORARY_VIEW,
      { type: "pan", deltaX: 50, deltaY: 50 },
      { width: 500, height: 400 },
      { width: 1024, height: 768 },
      0.5
    );
    const zoomed = applyTemporaryViewGesture(
      { zoom: 2, offsetX: 0, offsetY: 0 },
      { type: "pan", deltaX: 1000, deltaY: -1000 },
      { width: 500, height: 400 },
      { width: 1024, height: 768 },
      0.5
    );

    expect(unzoomed).toEqual(DEFAULT_TEMPORARY_VIEW);
    expect(zoomed).toEqual({
      zoom: 2,
      offsetX: -262,
      offsetY: 184
    });
  });
});
