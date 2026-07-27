import { describe, expect, it } from "vitest";
import { computeFitScale } from "./scale";

describe("computeFitScale", () => {
  it("fits a stable viewport inside the visible tile", () => {
    expect(
      computeFitScale({
        tileWidth: 640,
        tileHeight: 360,
        viewportWidth: 1280,
        viewportHeight: 720,
        manualZoom: 1
      })
    ).toBe(0.5);
  });

  it("applies manual zoom after fit scale", () => {
    expect(
      computeFitScale({
        tileWidth: 640,
        tileHeight: 360,
        viewportWidth: 1280,
        viewportHeight: 720,
        manualZoom: 1.25
      })
    ).toBe(0.625);
  });

  it("throws on invalid dimensions", () => {
    expect(() =>
      computeFitScale({
        tileWidth: 0,
        tileHeight: 360,
        viewportWidth: 1280,
        viewportHeight: 720,
        manualZoom: 1
      })
    ).toThrow("Tile and viewport dimensions must be positive");
  });
});
