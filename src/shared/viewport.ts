import type { ViewportSize } from "./types.js";

export const DEFAULT_VIEWPORT: ViewportSize = { width: 1024, height: 768 };
export const LEGACY_DEFAULT_VIEWPORT: ViewportSize = { width: 1280, height: 720 };

export interface ViewportPreset {
  label: string;
  value: string;
  viewport: ViewportSize;
}

export const VIEWPORT_PRESETS: ViewportPreset[] = [
  { label: "1024×768 · 4:3", value: "1024x768", viewport: DEFAULT_VIEWPORT },
  {
    label: "1280×720 · 16:9",
    value: "1280x720",
    viewport: { width: 1280, height: 720 }
  },
  {
    label: "1200×800 · 3:2",
    value: "1200x800",
    viewport: { width: 1200, height: 800 }
  },
  {
    label: "1024×1024 · 1:1",
    value: "1024x1024",
    viewport: { width: 1024, height: 1024 }
  },
  {
    label: "1920×1080 · 16:9",
    value: "1920x1080",
    viewport: { width: 1920, height: 1080 }
  }
];

export function sameViewport(a: ViewportSize, b: ViewportSize): boolean {
  return a.width === b.width && a.height === b.height;
}

export function viewportToValue(viewport: ViewportSize): string {
  return `${viewport.width}x${viewport.height}`;
}

export function viewportFromValue(value: string): ViewportSize {
  const [width, height] = value.split("x").map(Number);
  return { width, height };
}
