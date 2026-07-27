import { describe, expect, it } from "vitest";
import {
  cameraDefaultsFromNumber,
  cameraNumberFromIndex,
  cameraNumberSuffix,
  nextCameraDefaults
} from "./cameraIndex";
import type { CameraEntry } from "./types";

function camera(name: string, suffix: string): CameraEntry {
  return {
    id: `camera-${name}-${suffix}`,
    name,
    url: `http://192.168.1.${suffix}`,
    suffix,
    prefixOverride: "",
    usesListPrefix: true,
    cameraType: "",
    lens: "",
    displayNote: "",
    notes: "",
    viewportOverride: null,
    zoomOverride: null
  };
}

describe("cameraIndex", () => {
  it("maps camera numbers to default index labels", () => {
    expect(cameraDefaultsFromNumber(1)).toEqual({ index: "A", suffix: "01" });
    expect(cameraDefaultsFromNumber(4)).toEqual({ index: "D", suffix: "04" });
    expect(cameraDefaultsFromNumber(26)).toEqual({ index: "Z", suffix: "26" });
    expect(cameraDefaultsFromNumber(27)).toEqual({ index: "ZA", suffix: "27" });
    expect(cameraDefaultsFromNumber(28)).toEqual({ index: "ZB", suffix: "28" });
    expect(cameraDefaultsFromNumber(52)).toEqual({ index: "ZZ", suffix: "52" });
  });

  it("maps default index labels back to camera numbers", () => {
    expect(cameraNumberFromIndex("A")).toBe(1);
    expect(cameraNumberFromIndex("D")).toBe(4);
    expect(cameraNumberFromIndex("Z")).toBe(26);
    expect(cameraNumberFromIndex("ZA")).toBe(27);
    expect(cameraNumberFromIndex("ZC")).toBe(29);
  });

  it("formats camera numbers with at least two digits", () => {
    expect(cameraNumberSuffix(1)).toBe("01");
    expect(cameraNumberSuffix(12)).toBe("12");
    expect(cameraNumberSuffix(100)).toBe("100");
  });

  it("finds the next default index and two-digit camera number", () => {
    expect(nextCameraDefaults([])).toEqual({ index: "A", suffix: "01" });
    expect(nextCameraDefaults([camera("A", "01"), camera("B", "02")])).toEqual({
      index: "C",
      suffix: "03"
    });
    expect(
      nextCameraDefaults(Array.from({ length: 26 }, (_, index) => camera("", `${index + 1}`)))
    ).toEqual({ index: "ZA", suffix: "27" });
  });
});
