export interface FitScaleInput {
  tileWidth: number;
  tileHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  manualZoom: number;
}

export function computeFitScale(input: FitScaleInput): number {
  const { tileWidth, tileHeight, viewportWidth, viewportHeight, manualZoom } = input;

  if (tileWidth <= 0 || tileHeight <= 0 || viewportWidth <= 0 || viewportHeight <= 0) {
    throw new Error("Tile and viewport dimensions must be positive");
  }

  const fitScale = Math.min(tileWidth / viewportWidth, tileHeight / viewportHeight);
  return Number((fitScale * manualZoom).toFixed(4));
}
