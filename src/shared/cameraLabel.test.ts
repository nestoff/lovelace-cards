import { describe, expect, it } from "vitest";
import type { CameraEntry } from "./types";
import { formatCameraLabel } from "./cameraLabel";

const baseCamera: CameraEntry = {
  id: "camera-4",
  name: "D",
  url: "http://192.168.1.04",
  suffix: "04",
  prefixOverride: "",
  cameraType: "",
  lens: "",
  displayNote: "",
  notes: "",
  viewportOverride: null,
  zoomOverride: null
};

describe("formatCameraLabel", () => {
  it("shows the camera index when no metadata is set", () => {
    expect(formatCameraLabel(baseCamera)).toBe("D");
  });

  it("shows camera index with type, lens, and display note", () => {
    expect(
      formatCameraLabel({
        ...baseCamera,
        cameraType: "ALEXA 35",
        lens: "50mm",
          displayNote: "Handheld"
      })
    ).toBe("D • ALEXA 35 • 50mm • Handheld");
  });

  it("falls back to the camera number when index is blank", () => {
    expect(formatCameraLabel({ ...baseCamera, name: "" })).toBe("04");
  });
});
