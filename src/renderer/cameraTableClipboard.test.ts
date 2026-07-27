import { describe, expect, it } from "vitest";
import type { CameraList } from "../shared/types";
import {
  CAMERA_TABLE_COLUMNS,
  appendSequentialCamera,
  applyDraftCameraPatch,
  cameraTableSelectionBounds,
  cloneCameraList,
  createCameraTableSelection,
  isCameraTableCellSelected,
  pasteCameraTableText,
  resizeDraftCameraList,
  serializeCameraTableSelection,
  serializeWholeCameraTable
} from "./cameraTableClipboard";

const list: CameraList = {
  id: "list-test",
  jobId: "job-test",
  name: "Test Cameras",
  defaultPrefix: "http://10.20.100.",
  cameras: [
    {
      id: "camera-a",
      name: "A",
      suffix: "01",
      url: "http://10.20.100.01",
      prefixOverride: "",
      usesListPrefix: true,
      cameraType: "VENICE 2",
      lens: "35mm",
      displayNote: "Wide",
      notes: "",
      viewportOverride: null,
      zoomOverride: null
    },
    {
      id: "camera-b",
      name: "B",
      suffix: "02",
      url: "http://10.20.100.55/rmt.html",
      prefixOverride: "",
      usesListPrefix: false,
      cameraType: "FR7",
      lens: "50mm",
      displayNote: "Close",
      notes: "",
      viewportOverride: { width: 1280, height: 720 },
      zoomOverride: 1.05
    }
  ]
};

describe("camera table selection", () => {
  it("normalizes cell, row, and column bounds", () => {
    expect(
      cameraTableSelectionBounds(
        createCameraTableSelection(
          "cells",
          { rowIndex: 1, columnIndex: 3 },
          { rowIndex: 0, columnIndex: 1 }
        ),
        2
      )
    ).toEqual({ rowStart: 0, rowEnd: 1, columnStart: 1, columnEnd: 3 });

    expect(
      cameraTableSelectionBounds(
        createCameraTableSelection(
          "rows",
          { rowIndex: 1, columnIndex: 0 },
          { rowIndex: 0, columnIndex: 0 }
        ),
        2
      )
    ).toEqual({ rowStart: 0, rowEnd: 1, columnStart: 0, columnEnd: 8 });

    expect(
      cameraTableSelectionBounds(
        createCameraTableSelection(
          "columns",
          { rowIndex: 0, columnIndex: 5 },
          { rowIndex: 0, columnIndex: 7 }
        ),
        2
      )
    ).toEqual({ rowStart: 0, rowEnd: 1, columnStart: 5, columnEnd: 7 });
  });

  it("reports selected cells from normalized bounds", () => {
    const selection = createCameraTableSelection(
      "cells",
      { rowIndex: 0, columnIndex: 1 },
      { rowIndex: 1, columnIndex: 2 }
    );

    expect(isCameraTableCellSelected(selection, 2, 0, 1)).toBe(true);
    expect(isCameraTableCellSelected(selection, 2, 1, 2)).toBe(true);
    expect(isCameraTableCellSelected(selection, 2, 0, 3)).toBe(false);
  });
});

describe("camera table serialization", () => {
  it("serializes selected cells as TSV without headers", () => {
    const selection = createCameraTableSelection(
      "cells",
      { rowIndex: 0, columnIndex: 1 },
      { rowIndex: 1, columnIndex: 3 }
    );

    expect(serializeCameraTableSelection(list, selection)).toBe(
      "A\t01\thttp://10.20.100.01\nB\t02\thttp://10.20.100.55/rmt.html"
    );
  });

  it("serializes row and column selections", () => {
    expect(
      serializeCameraTableSelection(
        list,
        createCameraTableSelection("rows", { rowIndex: 0, columnIndex: 0 })
      )
    ).toBe("TRUE\tA\t01\thttp://10.20.100.01\tVENICE 2\t35mm\tWide\t\t");

    expect(
      serializeCameraTableSelection(
        list,
        createCameraTableSelection(
          "columns",
          { rowIndex: 0, columnIndex: 4 },
          { rowIndex: 0, columnIndex: 5 }
        )
      )
    ).toBe("VENICE 2\t35mm\nFR7\t50mm");
  });

  it("serializes the complete draft without app-only Follow Prefix state", () => {
    const output = serializeWholeCameraTable(list);

    expect(output.split("\n")[0]).toBe(
      "Index\tCamera #\tFull URL\tType\tLens\tDisplay Note\tViewport\tZoom"
    );
    expect(output.split("\n")[1]).toBe(
      "A\t01\thttp://10.20.100.01\tVENICE 2\t35mm\tWide\t\t"
    );
    expect(output.split("\n")[2]).toBe(
      "B\t02\thttp://10.20.100.55/rmt.html\tFR7\t50mm\tClose\t1280x720\t1.05"
    );
    expect(output).not.toContain("Follow Prefix");
    expect(CAMERA_TABLE_COLUMNS).toHaveLength(9);
  });
});

describe("shared camera draft helpers", () => {
  it("deep-clones viewport overrides", () => {
    const cloned = cloneCameraList(list);

    expect(cloned).not.toBe(list);
    expect(cloned.cameras[1]).not.toBe(list.cameras[1]);
    expect(cloned.cameras[1].viewportOverride).not.toBe(list.cameras[1].viewportOverride);
  });

  it("keeps sequential row and patch rules consistent", () => {
    const appended = appendSequentialCamera(list, () => "camera-c");
    expect(appended.cameras.at(-1)).toMatchObject({
      id: "camera-c",
      name: "C",
      suffix: "03",
      url: "http://10.20.100.03",
      usesListPrefix: true
    });

    expect(resizeDraftCameraList(list, 1).cameras).toHaveLength(1);
    let generatedId = 0;
    expect(
      resizeDraftCameraList(list, 120, () => `generated-${++generatedId}`).cameras
    ).toHaveLength(99);

    const patched = applyDraftCameraPatch(
      list.cameras[0],
      { suffix: "4" },
      list.defaultPrefix
    );
    expect(patched).toMatchObject({
      name: "D",
      suffix: "04",
      url: "http://10.20.100.04"
    });
  });
});

describe("camera table paste", () => {
  it("pastes positionally and appends sequential rows", () => {
    const shortList = { ...list, cameras: [list.cameras[0]] };
    let id = 0;
    const result = pasteCameraTableText(
      shortList,
      { rowIndex: 0, columnIndex: 1 },
      "Custom\t7\r\nSecond\t8\r\nThird\t9\r\n",
      () => `pasted-${++id}`
    );

    expect(result).not.toBeNull();
    expect(result?.mode).toBe("positional");
    expect(result?.rowsAdded).toBe(2);
    expect(result?.cellsUpdated).toBe(6);
    expect(result?.list.cameras).toEqual([
      expect.objectContaining({
        name: "Custom",
        suffix: "07",
        url: "http://10.20.100.07"
      }),
      expect.objectContaining({
        name: "Second",
        suffix: "08",
        url: "http://10.20.100.08"
      }),
      expect.objectContaining({
        name: "Third",
        suffix: "09",
        url: "http://10.20.100.09"
      })
    ]);
    expect(result?.selection).toEqual(
      createCameraTableSelection(
        "cells",
        { rowIndex: 0, columnIndex: 1 },
        { rowIndex: 2, columnIndex: 2 }
      )
    );
  });

  it("maps reordered headers from the first row and ignores legacy Follow Prefix values", () => {
    const result = pasteCameraTableText(
      list,
      { rowIndex: 1, columnIndex: 8 },
      "Lens\tCamera #\tIndex\tZoom\tViewport\tFollow Prefix\tUnknown\n35mm\t5\tHero\t125%\t1200X800\tno\tignored"
    );

    expect(result?.mode).toBe("headers");
    expect(result?.list.cameras[0]).toMatchObject({
      name: "Hero",
      suffix: "05",
      url: "http://10.20.100.05",
      lens: "35mm",
      viewportOverride: { width: 1200, height: 800 },
      zoomOverride: 1.25,
      usesListPrefix: true
    });
    expect(result?.selection.anchor.rowIndex).toBe(0);
    expect(result?.issues).toEqual([
      expect.objectContaining({
        sourceRow: 1,
        cameraRow: null,
        column: "Unknown",
        value: "Unknown"
      })
    ]);
  });

  it("recognizes header aliases and normalizes explicit URLs", () => {
    const result = pasteCameraTableText(
      list,
      { rowIndex: 1, columnIndex: 0 },
      "Name\tAddress\tNotes\tScale\nRemote\t10.20.100.107/index\tStage Right\t105%"
    );

    expect(result?.list.cameras[0]).toMatchObject({
      name: "Remote",
      url: "http://10.20.100.107/index",
      displayNote: "Stage Right",
      zoomOverride: 1.05,
      usesListPrefix: false
    });
  });

  it("skips invalid special values without rejecting valid cells", () => {
    const result = pasteCameraTableText(
      list,
      { rowIndex: 0, columnIndex: 0 },
      "Viewport\tZoom\tFollow Prefix\tType\n0x720\t400%\tperhaps\tFR7"
    );

    expect(result?.cellsUpdated).toBe(1);
    expect(result?.issues).toHaveLength(2);
    expect(result?.list.cameras[0]).toMatchObject({
      cameraType: "FR7",
      viewportOverride: null,
      zoomOverride: null,
      usesListPrefix: true
    });
  });

  it("ignores empty clipboard text and preserves interior empty cells", () => {
    expect(pasteCameraTableText(list, { rowIndex: 0, columnIndex: 0 }, "")).toBeNull();

    const result = pasteCameraTableText(
      list,
      { rowIndex: 0, columnIndex: 4 },
      "VENICE 2\t\tStage"
    );
    expect(result?.list.cameras[0]).toMatchObject({
      cameraType: "VENICE 2",
      lens: "",
      displayNote: "Stage"
    });
  });

  it("keeps headerless paste anchored to the selected cell", () => {
    const result = pasteCameraTableText(
      list,
      { rowIndex: 1, columnIndex: 4 },
      "BURANO\t85mm"
    );

    expect(result?.list.cameras[0].cameraType).toBe("VENICE 2");
    expect(result?.list.cameras[1]).toMatchObject({
      cameraType: "BURANO",
      lens: "85mm"
    });
    expect(result?.selection.anchor).toEqual({ rowIndex: 1, columnIndex: 4 });
  });

  it("reports positional cells beyond the final data column", () => {
    const result = pasteCameraTableText(
      list,
      { rowIndex: 0, columnIndex: 8 },
      "1.1\textra"
    );

    expect(result?.cellsUpdated).toBe(1);
    expect(result?.issues).toEqual([
      expect.objectContaining({
        sourceRow: 1,
        cameraRow: 1,
        column: "Column 10",
        value: "extra"
      })
    ]);
  });

  it("does not grow past the 99-camera limit", () => {
    let generatedId = 0;
    const fullList = resizeDraftCameraList(
      list,
      99,
      () => `full-${++generatedId}`
    );
    const result = pasteCameraTableText(
      fullList,
      { rowIndex: 98, columnIndex: 1 },
      "Last\nOverflow"
    );

    expect(result?.list.cameras).toHaveLength(99);
    expect(result?.rowsAdded).toBe(0);
    expect(result?.cellsUpdated).toBe(1);
    expect(result?.issues).toEqual([
      expect.objectContaining({
        sourceRow: 2,
        cameraRow: 100,
        column: "Row",
        value: "Overflow"
      })
    ]);
  });
});
