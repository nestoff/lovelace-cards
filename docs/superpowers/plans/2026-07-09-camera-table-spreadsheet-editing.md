# Camera Table Spreadsheet Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Camera List table behave like a spreadsheet for selection, keyboard navigation, direct copy/paste, automatic row growth, and whole-table export.

**Architecture:** Add a DOM-free `cameraTableClipboard.ts` module that owns the nine-column model, draft mutation rules, selection bounds, TSV serialization, header detection, value parsing, and paste application. Keep DOM focus, native clipboard events, accessible selection controls, notices, and styling in `CameraListEditor.tsx`, with unit tests for the pure engine and component behavior plus one browser workflow test.

**Tech Stack:** React 19, TypeScript 5.8, Vitest, Testing Library, Playwright, Electron 42, existing Lucide React and DITBrowse UI primitives.

## Global Constraints

- Keep the application macOS-only and add no runtime dependency.
- Clipboard data columns remain exactly: Follow Prefix, Index, Camera #, Full URL, Type, Lens, Display Note, Viewport, Zoom.
- Move and Delete remain action columns and are never copied or pasted.
- Selection state is local to the editor and is never persisted.
- Paste, row growth, and whole-table copy operate on the current draft; only Save Changes updates the active camera list and grid.
- Preserve the existing maximum camera count of 99.
- `Cmd+C` copies only the selected range without headers; **Copy Table** copies all nine headers and every current draft row.
- Remove the CSV textarea and Import Valid Rows controls, but leave `src/shared/csv.ts` intact.
- Enter/Shift+Enter and Tab/Shift+Tab preserve the existing movement rules and select all text after moving.
- Use the existing URL, camera-number, default-index, viewport, and zoom rules rather than introducing parallel normalization.

---

### Task 1: Extract The Camera Table Model And Selection Serializer

**Files:**
- Create: `src/renderer/cameraTableClipboard.ts`
- Create: `src/renderer/cameraTableClipboard.test.ts`
- Modify later: `src/renderer/components/CameraListEditor.tsx`

**Interfaces:**
- Produces: `CAMERA_TABLE_COLUMNS`, `CAMERA_TABLE_COLUMN_COUNT`, `CameraTableCell`, `CameraTableSelection`, `CameraTableSelectionBounds`.
- Produces: `createCameraTableSelection(mode, anchor, active?)`, `cameraTableSelectionBounds(selection, rowCount)`, `isCameraTableCellSelected(selection, rowCount, rowIndex, columnIndex)`.
- Produces: `serializeCameraTableSelection(list, selection)` and `serializeWholeCameraTable(list)`.
- Produces shared draft helpers: `cloneCameraList`, `appendSequentialCamera`, `resizeDraftCameraList`, and `applyDraftCameraPatch`.

- [ ] **Step 1: Write failing selection and serialization tests**

Create `src/renderer/cameraTableClipboard.test.ts` with a two-camera fixture and these cases:

```ts
import { describe, expect, it } from "vitest";
import type { CameraList } from "../shared/types";
import {
  CAMERA_TABLE_COLUMNS,
  appendSequentialCamera,
  applyDraftCameraPatch,
  cameraTableSelectionBounds,
  createCameraTableSelection,
  isCameraTableCellSelected,
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
    ).toBe(
      "TRUE\tA\t01\thttp://10.20.100.01\tVENICE 2\t35mm\tWide\t\t"
    );
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

  it("serializes the complete draft with standard headers", () => {
    const output = serializeWholeCameraTable(list);
    expect(output.split("\n")[0]).toBe(
      "Follow Prefix\tIndex\tCamera #\tFull URL\tType\tLens\tDisplay Note\tViewport\tZoom"
    );
    expect(output.split("\n")[1]).toBe(
      "TRUE\tA\t01\thttp://10.20.100.01\tVENICE 2\t35mm\tWide\t\t"
    );
    expect(output.split("\n")[2]).toBe(
      "FALSE\tB\t02\thttp://10.20.100.55/rmt.html\tFR7\t50mm\tClose\t1280x720\t1.05"
    );
    expect(CAMERA_TABLE_COLUMNS).toHaveLength(9);
  });
});

describe("shared camera draft helpers", () => {
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

    const patched = applyDraftCameraPatch(list.cameras[0], { suffix: "4" }, list.defaultPrefix);
    expect(patched).toMatchObject({ name: "D", suffix: "04", url: "http://10.20.100.04" });
  });
});
```

- [ ] **Step 2: Run the new test to verify it fails**

Run:

```bash
npm test -- src/renderer/cameraTableClipboard.test.ts
```

Expected: FAIL because `./cameraTableClipboard` does not exist.

- [ ] **Step 3: Implement the column model, selection bounds, serialization, and draft helpers**

Create `src/renderer/cameraTableClipboard.ts` with these public contracts and a switch-based value serializer:

```ts
import {
  defaultIndexForSuffix,
  isDefaultIndexForSuffix,
  nextCameraDefaults,
  normalizeCameraNumberSuffix
} from "../shared/cameraIndex";
import type { CameraEntry, CameraList } from "../shared/types";
import { normalizeCameraPrefix, normalizeCameraUrl } from "../shared/url";
import type { CameraEntryPatch } from "./state/workspaceReducer";

export const CAMERA_TABLE_COLUMNS = [
  { key: "usesListPrefix", label: "Follow Prefix" },
  { key: "name", label: "Index" },
  { key: "suffix", label: "Camera #" },
  { key: "url", label: "Full URL" },
  { key: "cameraType", label: "Type" },
  { key: "lens", label: "Lens" },
  { key: "displayNote", label: "Display Note" },
  { key: "viewportOverride", label: "Viewport" },
  { key: "zoomOverride", label: "Zoom" }
] as const;

export const CAMERA_TABLE_COLUMN_COUNT = CAMERA_TABLE_COLUMNS.length;
export type CameraTableColumnKey = (typeof CAMERA_TABLE_COLUMNS)[number]["key"];
export type CameraTableSelectionMode = "cells" | "rows" | "columns";

export interface CameraTableCell {
  rowIndex: number;
  columnIndex: number;
}

export interface CameraTableSelection {
  mode: CameraTableSelectionMode;
  anchor: CameraTableCell;
  active: CameraTableCell;
}

export interface CameraTableSelectionBounds {
  rowStart: number;
  rowEnd: number;
  columnStart: number;
  columnEnd: number;
}

export function createCameraTableSelection(
  mode: CameraTableSelectionMode,
  anchor: CameraTableCell,
  active: CameraTableCell = anchor
): CameraTableSelection {
  return { mode, anchor, active };
}

export function cameraTableSelectionBounds(
  selection: CameraTableSelection,
  rowCount: number
): CameraTableSelectionBounds | null {
  if (rowCount <= 0) return null;
  const rowStart = selection.mode === "columns" ? 0 : Math.min(selection.anchor.rowIndex, selection.active.rowIndex);
  const rowEnd = selection.mode === "columns" ? rowCount - 1 : Math.max(selection.anchor.rowIndex, selection.active.rowIndex);
  const columnStart = selection.mode === "rows" ? 0 : Math.min(selection.anchor.columnIndex, selection.active.columnIndex);
  const columnEnd = selection.mode === "rows" ? CAMERA_TABLE_COLUMN_COUNT - 1 : Math.max(selection.anchor.columnIndex, selection.active.columnIndex);
  return {
    rowStart: Math.max(0, Math.min(rowCount - 1, rowStart)),
    rowEnd: Math.max(0, Math.min(rowCount - 1, rowEnd)),
    columnStart: Math.max(0, Math.min(CAMERA_TABLE_COLUMN_COUNT - 1, columnStart)),
    columnEnd: Math.max(0, Math.min(CAMERA_TABLE_COLUMN_COUNT - 1, columnEnd))
  };
}

export function isCameraTableCellSelected(
  selection: CameraTableSelection | null,
  rowCount: number,
  rowIndex: number,
  columnIndex: number
): boolean {
  if (!selection) return false;
  const bounds = cameraTableSelectionBounds(selection, rowCount);
  return !!bounds && rowIndex >= bounds.rowStart && rowIndex <= bounds.rowEnd && columnIndex >= bounds.columnStart && columnIndex <= bounds.columnEnd;
}
```

Implement `cameraTableCellValue(camera, columnIndex)` with `TRUE/FALSE`, blank defaults, `WIDTHxHEIGHT`, and raw decimal zoom values. Implement selection serialization by looping over normalized bounds and joining columns with `\t` and rows with `\n`. Implement whole-table serialization as `headers + rows` using the same value function. Move the existing cloning, camera creation, sequential append, capped resize, and patch logic from `CameraListEditor.tsx` into this file; allow `appendSequentialCamera` and `resizeDraftCameraList` to accept an optional ID factory for deterministic tests.

- [ ] **Step 4: Run the pure module test and typecheck**

Run:

```bash
npm test -- src/renderer/cameraTableClipboard.test.ts
npm run typecheck
```

Expected: all new tests PASS and TypeScript reports no errors.

- [ ] **Step 5: Commit the pure model**

```bash
git add src/renderer/cameraTableClipboard.ts src/renderer/cameraTableClipboard.test.ts
git commit -m "feat: add camera table clipboard model"
```

---

### Task 2: Add Header-Aware TSV Paste And Draft Row Growth

**Files:**
- Modify: `src/renderer/cameraTableClipboard.ts`
- Modify: `src/renderer/cameraTableClipboard.test.ts`

**Interfaces:**
- Consumes: the column metadata, selection types, `appendSequentialCamera`, and `applyDraftCameraPatch` from Task 1.
- Produces: `CameraTablePasteIssue`, `CameraTablePasteResult`, and `pasteCameraTableText(list, activeCell, text, createId?)`.

- [ ] **Step 1: Add failing positional, header, and validation paste tests**

Append these cases to `src/renderer/cameraTableClipboard.test.ts`:

```ts
import { pasteCameraTableText } from "./cameraTableClipboard";

describe("camera table paste", () => {
  it("pastes positionally and appends sequential rows", () => {
    let id = 0;
    const result = pasteCameraTableText(
      list,
      { rowIndex: 1, columnIndex: 1 },
      "Custom\t7\r\nSecond\t8\r\nThird\t9\r\n",
      () => `pasted-${++id}`
    );

    expect(result).not.toBeNull();
    expect(result?.mode).toBe("positional");
    expect(result?.rowsAdded).toBe(2);
    expect(result?.cellsUpdated).toBe(6);
    expect(result?.list.cameras.slice(1)).toEqual([
      expect.objectContaining({ name: "Custom", suffix: "07", url: "http://10.20.100.07" }),
      expect.objectContaining({ name: "Second", suffix: "08", url: "http://10.20.100.08" }),
      expect.objectContaining({ name: "Third", suffix: "09", url: "http://10.20.100.09" })
    ]);
    expect(result?.selection).toEqual(
      createCameraTableSelection(
        "cells",
        { rowIndex: 1, columnIndex: 1 },
        { rowIndex: 3, columnIndex: 2 }
      )
    );
  });

  it("maps reordered headers and applies explicit values in deterministic order", () => {
    const result = pasteCameraTableText(
      list,
      { rowIndex: 0, columnIndex: 8 },
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
      usesListPrefix: false
    });
    expect(result?.issues).toEqual([
      expect.objectContaining({ sourceRow: 1, column: "Unknown", value: "Unknown" })
    ]);
  });

  it("recognizes header aliases and normalizes explicit URLs", () => {
    const result = pasteCameraTableText(
      list,
      { rowIndex: 1, columnIndex: 0 },
      "Name\tAddress\tNotes\tScale\nRemote\t10.20.100.107/index\tStage Right\t105%"
    );

    expect(result?.list.cameras[1]).toMatchObject({
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
    expect(result?.issues).toHaveLength(3);
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
});
```

- [ ] **Step 2: Run the paste tests to verify they fail**

Run:

```bash
npm test -- src/renderer/cameraTableClipboard.test.ts
```

Expected: FAIL because `pasteCameraTableText` is not exported.

- [ ] **Step 3: Implement TSV parsing, header aliases, special-value parsing, and paste application**

Add these public result types:

```ts
export interface CameraTablePasteIssue {
  sourceRow: number;
  cameraRow: number | null;
  column: string;
  value: string;
  message: string;
}

export interface CameraTablePasteResult {
  list: CameraList;
  selection: CameraTableSelection;
  mode: "positional" | "headers";
  rowsAdded: number;
  cellsUpdated: number;
  issues: CameraTablePasteIssue[];
}
```

Implement aliases using a normalized key that lowercases and removes all non-alphanumeric characters:

```ts
const HEADER_ALIASES: Record<CameraTableColumnKey, readonly string[]> = {
  usesListPrefix: ["follow prefix", "follow_prefix", "uses list prefix"],
  name: ["index", "name"],
  suffix: ["camera #", "camera number", "number", "suffix"],
  url: ["full url", "url", "address"],
  cameraType: ["type", "camera type", "camera_type"],
  lens: ["lens"],
  displayNote: ["display note", "display_note", "note", "notes"],
  viewportOverride: ["viewport", "view", "resolution"],
  zoomOverride: ["zoom", "scale"]
};

const APPLY_PRIORITY: readonly CameraTableColumnKey[] = [
  "suffix",
  "name",
  "url",
  "cameraType",
  "lens",
  "displayNote",
  "viewportOverride",
  "zoomOverride",
  "usesListPrefix"
];
```

Normalize CRLF and CR to LF, remove one final empty line, split rows on `\n`, and split cells on `\t`. Enter header mode only when the first row contains at least two recognized headers. In positional mode, map from the active column to the right and report cells beyond column 8. In header mode, ignore the active column, map recognized headers to their destination columns, and report each unknown header once.

Parse special values exactly as follows:

```ts
function parseFollowPrefix(value: string): boolean | null | undefined {
  const normalized = value.trim().toLowerCase();
  if (!normalized) return true;
  if (["true", "yes", "1", "on"].includes(normalized)) return true;
  if (["false", "no", "0", "off"].includes(normalized)) return false;
  return undefined;
}

function parseViewport(value: string): CameraEntry["viewportOverride"] | undefined {
  const normalized = value.trim();
  if (!normalized || normalized.toLowerCase() === "default") return null;
  const match = normalized.match(/^(\d+)\s*[xX]\s*(\d+)$/);
  if (!match) return undefined;
  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? { width, height } : undefined;
}

function parseZoom(value: string): number | null | undefined {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "default") return null;
  const parsed = normalized.endsWith("%")
    ? Number(normalized.slice(0, -1)) / 100
    : Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0.25 && parsed <= 3 ? parsed : undefined;
}
```

Grow rows sequentially before applying values, stopping at 99 cameras and reporting rows that cannot fit. For each destination row, gather assignments and apply them in `APPLY_PRIORITY` order through `applyDraftCameraPatch`; this guarantees explicit Index and Follow Prefix values win. Return a bounding cell selection covering all valid destination rows and mapped columns.

- [ ] **Step 4: Run the paste engine tests and typecheck**

```bash
npm test -- src/renderer/cameraTableClipboard.test.ts
npm run typecheck
```

Expected: all clipboard-module tests PASS and TypeScript reports no errors.

- [ ] **Step 5: Commit the paste engine**

```bash
git add src/renderer/cameraTableClipboard.ts src/renderer/cameraTableClipboard.test.ts
git commit -m "feat: paste spreadsheets into camera drafts"
```

---

### Task 3: Wire Spreadsheet Selection, Copy, Paste, And Navigation Into React

**Files:**
- Modify: `src/renderer/components/CameraListEditor.tsx:1-757`
- Modify: `src/renderer/components/CameraListEditor.test.tsx:1-410`

**Interfaces:**
- Consumes: all Task 1 and Task 2 exports.
- Consumes: the existing `Button`, `IconButton`, `Tooltip`, `CameraEntry`, `CameraList`, and workspace settings interfaces.
- Produces: native table copy/paste handlers, row/column/cell selection controls, **Copy Table**, full-text keyboard navigation, and inline clipboard feedback.

- [ ] **Step 1: Replace the CSV component test with failing spreadsheet interaction tests**

In `CameraListEditor.test.tsx`, remove the CSV-import test and add tests covering:

```ts
it("selects all text after Enter and Tab navigation", () => {
  const selectSpy = vi.spyOn(HTMLInputElement.prototype, "select");
  renderEditor();

  const firstType = screen.getByLabelText("A type");
  const secondType = screen.getByLabelText("B type");
  fireEvent.change(secondType, { target: { value: "FR7" } });
  fireEvent.keyDown(firstType, { key: "Enter" });
  expect(secondType).toHaveFocus();
  expect(secondType).toHaveProperty("selectionStart", 0);
  expect(secondType).toHaveProperty("selectionEnd", 3);
  expect(selectSpy).toHaveBeenCalled();

  selectSpy.mockClear();
  fireEvent.keyDown(screen.getByLabelText("A index"), { key: "Tab" });
  const cameraNumber = screen.getByLabelText("A camera number");
  expect(cameraNumber).toHaveFocus();
  expect(cameraNumber).toHaveProperty("selectionStart", 0);
  expect(cameraNumber).toHaveProperty("selectionEnd", 2);
  expect(selectSpy).toHaveBeenCalled();
  selectSpy.mockRestore();
});

it("selects cell ranges, rows, and columns", () => {
  renderEditor();
  const aIndex = screen.getByLabelText("A index");
  const bNumber = screen.getByLabelText("B camera number");
  fireEvent.click(aIndex);
  fireEvent.click(bNumber, { shiftKey: true });

  expect(aIndex.closest("td")).toHaveAttribute("aria-selected", "true");
  expect(bNumber.closest("td")).toHaveAttribute("aria-selected", "true");
  expect(screen.getByLabelText("A type").closest("td")).toHaveAttribute("aria-selected", "false");

  fireEvent.click(screen.getByRole("button", { name: "Select row 1; drag to move A" }));
  fireEvent.click(screen.getByRole("button", { name: "Select row 3; drag to move C" }), {
    shiftKey: true
  });
  expect(screen.getByLabelText("B lens").closest("td")).toHaveAttribute("aria-selected", "true");
  expect(screen.getByLabelText("A zoom").closest("td")).toHaveAttribute("aria-selected", "true");

  fireEvent.click(screen.getByRole("button", { name: "Select Type column" }));
  fireEvent.click(screen.getByRole("button", { name: "Select Display Note column" }), {
    shiftKey: true
  });
  expect(screen.getByLabelText("A type").closest("td")).toHaveAttribute("aria-selected", "true");
  expect(screen.getByLabelText("A lens").closest("td")).toHaveAttribute("aria-selected", "true");
  expect(screen.getByLabelText("L type").closest("td")).toHaveAttribute("aria-selected", "true");
});

it("moves backward with Shift+Enter and Shift+Tab", () => {
  renderEditor();
  const secondLens = screen.getByLabelText("B lens");
  fireEvent.keyDown(secondLens, { key: "Enter", shiftKey: true });
  expect(screen.getByLabelText("A lens")).toHaveFocus();

  const bFollowPrefix = screen.getByLabelText("B follow prefix");
  fireEvent.keyDown(bFollowPrefix, { key: "Tab", shiftKey: true });
  expect(screen.getByLabelText("A zoom")).toHaveFocus();
});

it("copies the selected range as TSV", () => {
  renderEditor();
  fireEvent.click(screen.getByLabelText("A index"));
  fireEvent.click(screen.getByLabelText("B camera number"), { shiftKey: true });
  const setData = vi.fn();
  fireEvent.copy(screen.getByLabelText("B camera number"), {
    clipboardData: { setData, getData: vi.fn() }
  });
  expect(setData).toHaveBeenCalledWith("text/plain", "A\t01\nB\t02");
});

it("pastes spreadsheet headers and rows into the draft before save", () => {
  const { onSaveList } = renderEditor();
  const lastIndex = screen.getByLabelText("L index");
  fireEvent.click(lastIndex);
  fireEvent.paste(lastIndex, {
    clipboardData: {
      getData: () =>
        "Camera #\tIndex\tType\tLens\n12\tL\tVENICE 2\t35mm\n13\tM\tFR7\t50mm\n14\tN\tBURANO\t85mm"
    }
  });

  expect(onSaveList).not.toHaveBeenCalled();
  expect(screen.getByLabelText("M camera number")).toHaveValue("13");
  expect(screen.getByLabelText("N type")).toHaveValue("BURANO");
  fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
  expect(onSaveList.mock.calls[0][0].cameras).toHaveLength(14);
});

it("discards pasted draft rows without saving them", () => {
  const { onSaveList, onClose } = renderEditor();
  const lastIndex = screen.getByLabelText("L index");
  fireEvent.click(lastIndex);
  fireEvent.paste(lastIndex, {
    clipboardData: {
      getData: () => "Camera #\tIndex\n12\tL\n13\tM"
    }
  });

  fireEvent.click(screen.getByRole("button", { name: "Discard" }));
  fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
  expect(onSaveList).not.toHaveBeenCalled();
  expect(onClose).toHaveBeenCalledOnce();
});

it("keeps a pasted custom viewport visible in the viewport control", () => {
  renderEditor();
  const aViewport = screen.getByLabelText("A viewport");
  fireEvent.click(aViewport);
  fireEvent.paste(aViewport, {
    clipboardData: { getData: () => "Viewport\n640x480" }
  });
  expect(aViewport).toHaveValue("640x480");
  expect(screen.getByRole("option", { name: "640x480" })).toBeInTheDocument();
});

it("copies the complete draft with headers from Copy Table", async () => {
  const writeText = vi.fn(async () => undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText }
  });
  const { onSaveList } = renderEditor();
  fireEvent.click(screen.getByLabelText("A index"));
  fireEvent.change(screen.getByLabelText("A type"), { target: { value: "VENICE 2" } });
  fireEvent.click(screen.getByRole("button", { name: "Copy Table" }));

  await vi.waitFor(() => expect(writeText).toHaveBeenCalledOnce());
  expect(writeText.mock.calls[0][0]).toMatch(
    /^Follow Prefix\tIndex\tCamera #\tFull URL\tType\tLens\tDisplay Note\tViewport\tZoom\nTRUE\tA\t01\t/
  );
  expect(writeText.mock.calls[0][0]).toContain("\tVENICE 2\t");
  expect(screen.getByRole("status")).toHaveTextContent("Copied 12 camera rows with headers");
  expect(screen.getByLabelText("A index").closest("td")).toHaveAttribute("aria-selected", "true");
  expect(onSaveList).not.toHaveBeenCalled();
});

it("removes the former CSV importer", () => {
  renderEditor();
  expect(screen.queryByLabelText("CSV import")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Import Valid Rows" })).not.toBeInTheDocument();
});

it("reports Copy Table clipboard failures without changing the draft", async () => {
  const writeText = vi.fn(async () => {
    throw new Error("denied");
  });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText }
  });
  const { onSaveList } = renderEditor();
  fireEvent.click(screen.getByRole("button", { name: "Copy Table" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(
    "Copy failed. Select a range and press Command+C instead."
  );
  expect(onSaveList).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the component tests to verify they fail**

```bash
npm test -- src/renderer/components/CameraListEditor.test.tsx
```

Expected: the new spreadsheet tests FAIL because selection, paste, and **Copy Table** are not wired.

- [ ] **Step 3: Replace local draft helpers and CSV state with clipboard-module imports and state**

Update imports to use React clipboard/mouse types, Lucide `Copy`, and the pure module. Remove `useMemo`, `Upload`, `parseCameraCsv`, `CameraCsvRow`, and the local clone/create/append/resize/patch helpers.

Add editor state with these exact shapes:

```ts
interface CameraClipboardNotice {
  tone: "success" | "partial" | "error";
  message: string;
  details: string[];
}

const [selection, setSelection] = useState<CameraTableSelection | null>(null);
const [clipboardNotice, setClipboardNotice] = useState<CameraClipboardNotice | null>(null);
```

Reset selection and clipboard notice when `activeList` changes. Keep `lastFollowIndex` for the existing shift-toggle behavior of Follow Prefix checkboxes.

- [ ] **Step 4: Add selection, full-text focus, copy, paste, and whole-table handlers**

Implement these handlers in `CameraListEditor.tsx`:

```ts
function selectCell(rowIndex: number, columnIndex: number, extend: boolean): void {
  setSelection((current) =>
    extend && current?.mode === "cells"
      ? createCameraTableSelection("cells", current.anchor, { rowIndex, columnIndex })
      : createCameraTableSelection("cells", { rowIndex, columnIndex })
  );
}

function selectRow(rowIndex: number, extend: boolean): void {
  setSelection((current) =>
    extend && current?.mode === "rows"
      ? createCameraTableSelection("rows", current.anchor, { rowIndex, columnIndex: 0 })
      : createCameraTableSelection("rows", { rowIndex, columnIndex: 0 })
  );
}

function selectColumn(columnIndex: number, extend: boolean): void {
  setSelection((current) =>
    extend && current?.mode === "columns"
      ? createCameraTableSelection("columns", current.anchor, { rowIndex: 0, columnIndex })
      : createCameraTableSelection("columns", { rowIndex: 0, columnIndex })
  );
}

function handleCameraTableCopy(event: ReactClipboardEvent<HTMLTableElement>): void {
  if (!draftList || !selection) return;
  event.preventDefault();
  event.clipboardData.setData("text/plain", serializeCameraTableSelection(draftList, selection));
}

function handleCameraTablePaste(event: ReactClipboardEvent<HTMLTableElement>): void {
  if (!draftList || !selection) return;
  const result = pasteCameraTableText(draftList, selection.active, event.clipboardData.getData("text/plain"));
  if (!result) return;
  event.preventDefault();
  setDraftList(result.list);
  setSelection(result.selection);
  setClipboardNotice({
    tone: result.issues.length ? "partial" : "success",
    message: `Pasted ${result.cellsUpdated} cells${result.rowsAdded ? ` and added ${result.rowsAdded} camera rows` : ""}${result.issues.length ? `; skipped ${result.issues.length}` : ""}.`,
    details: result.issues.map((issue) =>
      `Row ${issue.cameraRow ?? issue.sourceRow}, ${issue.column}: ${JSON.stringify(issue.value)} - ${issue.message}`
    )
  });
}

async function copyWholeCameraTable(): Promise<void> {
  if (!draftList) return;
  try {
    if (!navigator.clipboard?.writeText) throw new Error("Clipboard write unavailable");
    await navigator.clipboard.writeText(serializeWholeCameraTable(draftList));
    setClipboardNotice({
      tone: "success",
      message: `Copied ${draftList.cameras.length} camera rows with headers.`,
      details: []
    });
  } catch {
    setClipboardNotice({
      tone: "error",
      message: "Copy failed. Select a range and press Command+C instead.",
      details: []
    });
  }
}
```

Update `focusCameraCell` so it calls `focus()`, then calls `select()` for text and number inputs except checkboxes, and finally sets a single-cell selection. Keep selects and checkboxes focus-only.

- [ ] **Step 5: Render spreadsheet controls and remove the CSV interface**

Add a tooltip-backed toolbar command:

```tsx
<Button
  icon={<Copy size={14} strokeWidth={2.2} />}
  variant="subtle"
  size="compact"
  tooltip={{
    title: "Copy camera table",
    description: "Copies column headers and every draft camera row for Numbers, Excel, or Google Sheets."
  }}
  onClick={() => void copyWholeCameraTable()}
>
  Copy Table
</Button>
```

Give each data `<th>` a plain header button named `Select [label] column`; Shift-click extends a column selection. Change the drag handle name to `Select row ${rowIndex + 1}; drag to move ${camera.name}`, retain row dragging, and use its click event for row selection. Move the data attributes to the focusable control and put `aria-selected`, selection classes, and a Shift-aware click handler on each data `<td>`.

Attach `onCopy={handleCameraTableCopy}` and `onPaste={handleCameraTablePaste}` to the table. Add a visually hidden caption describing Shift-click, Command+C, and Command+V. Render the compact notice and issue list after the toolbar with `role="status"` for success/partial and `role="alert"` for failure.

For a pasted custom viewport not present in `VIEWPORT_PRESETS`, render a temporary option using its `WIDTHxHEIGHT` value before the preset options so the pasted value remains visible and editable.

Delete the CSV note, textarea, summary, error list, and Import Valid Rows button at the bottom of the editor.

- [ ] **Step 6: Run component tests and all unit tests**

```bash
npm test -- src/renderer/components/CameraListEditor.test.tsx
npm test
npm run typecheck
```

Expected: CameraListEditor tests PASS, the complete Vitest suite passes, and TypeScript reports no errors.

- [ ] **Step 7: Commit the React workflow**

```bash
git add src/renderer/components/CameraListEditor.tsx src/renderer/components/CameraListEditor.test.tsx
git commit -m "feat: edit camera lists like a spreadsheet"
```

---

### Task 4: Style Selection And Verify The Browser Workflow

**Files:**
- Modify: `src/renderer/styles.css:1191-1450`
- Modify: `tests/e2e/workspace.spec.ts:150-180`

**Interfaces:**
- Consumes: selection classes, column buttons, row-handle pressed state, clipboard notice, and hidden caption from Task 3.
- Produces: restrained spreadsheet selection visuals and an end-to-end clipboard workflow at supported desktop widths.

- [ ] **Step 1: Extend the browser test with a failing spreadsheet workflow**

Replace the existing navigation-only camera-list test with this broader test:

```ts
test("camera list supports spreadsheet navigation, copy, paste, and row growth", async ({ page, context }) => {
  await page.goto("/");
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(page.url()).origin
  });
  await page.getByRole("button", { name: "Camera List", exact: true }).click();

  await page.getByLabel("B type").fill("FR7");
  await page.getByLabel("A type").focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("B type")).toBeFocused();
  expect(await page.getByLabel("B type").evaluate((input: HTMLInputElement) => ({
    start: input.selectionStart,
    end: input.selectionEnd,
    length: input.value.length
  }))).toEqual({ start: 0, end: 3, length: 3 });

  await page.getByLabel("A index").click();
  await page.getByLabel("B camera number").click({ modifiers: ["Shift"] });
  expect(
    await page.getByLabel("A index").locator("xpath=ancestor::td").evaluate(
      (cell) => getComputedStyle(cell).backgroundColor
    )
  ).not.toBe("rgba(0, 0, 0, 0)");
  await page.keyboard.press("Meta+C");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toBe("A\t01\nB\t02");

  await page.getByLabel("L index").click();
  await page.evaluate(() => navigator.clipboard.writeText(
    "Camera #\tIndex\tType\tLens\n12\tL\tVENICE 2\t35mm\n13\tM\tFR7\t50mm\n14\tN\tBURANO\t85mm"
  ));
  await page.keyboard.press("Meta+V");

  await expect(page.getByLabel("M type")).toHaveValue("FR7");
  await expect(page.getByLabel("N lens")).toHaveValue("85mm");
  await expect(page.getByRole("status")).toContainText("added 2 camera rows");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByLabel("Tab N")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    (await page.viewportSize())?.width
  );
});
```

The non-empty `B type` value proves full text selection in Chromium. The remaining assertions verify that navigation, native clipboard events, paste growth, save, selection styling, and layout work together.

- [ ] **Step 2: Run the focused browser test to verify it fails**

```bash
npx playwright test tests/e2e/workspace.spec.ts --grep "spreadsheet navigation"
```

Expected: FAIL before the new selection classes and completed browser wiring are present.

- [ ] **Step 3: Add table selection, header, notice, and hidden-caption styles**

Add CSS using existing tokens:

```css
.camera-table-caption {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}

.camera-column-select {
  width: 100%;
  border: 0;
  background: transparent;
  color: inherit;
  padding: 4px 0;
  font: inherit;
  text-align: left;
  text-transform: inherit;
  cursor: default;
}

.camera-column-select:hover,
.camera-column-select[aria-pressed="true"] {
  color: var(--text-strong);
}

.camera-table td.camera-cell-selected {
  background: rgba(125, 157, 238, 0.11);
}

.camera-table td.camera-cell-edge-top { border-top: 1px solid var(--focus); }
.camera-table td.camera-cell-edge-right { border-right: 1px solid var(--focus); }
.camera-table td.camera-cell-edge-bottom { border-bottom-color: var(--focus); }
.camera-table td.camera-cell-edge-left { border-left: 1px solid var(--focus); }

.camera-table td.camera-cell-active {
  box-shadow: inset 0 0 0 2px var(--focus);
}

.camera-clipboard-notice {
  display: grid;
  gap: 4px;
  color: var(--muted);
  font-size: 12px;
}

.camera-clipboard-notice[data-tone="error"] { color: var(--danger); }
.camera-clipboard-notice[data-tone="partial"] { color: var(--warning); }

.camera-clipboard-issues {
  margin: 0;
  padding-left: 18px;
  color: inherit;
}
```

Ensure selected cell backgrounds remain behind transparent inputs/selects, focus rings remain visible, the sticky header stays above scrolling cells, and the toolbar wraps at narrow widths without causing document-level horizontal overflow. Remove obsolete `.panel-note`, editor textarea, `.import-summary`, and `.import-errors` rules only when `rg` confirms no other renderer uses them.

- [ ] **Step 4: Run browser, unit, and type checks**

```bash
npm test
npm run typecheck
npx playwright test tests/e2e/workspace.spec.ts
```

Expected: all Vitest tests pass; TypeScript reports no errors; all workspace browser tests pass at their configured desktop viewport.

- [ ] **Step 5: Commit the verified selection UI**

```bash
git add src/renderer/styles.css tests/e2e/workspace.spec.ts
git commit -m "style: finish spreadsheet camera selection"
```

---

### Task 5: Run Full Electron Verification And Produce The macOS Build

**Files:**
- Verify: all changed source and test files
- Produce: `release/DITBrowse-darwin-arm64/DITBrowse.app`
- Produce: signed/notarized ZIP and DMG in `release/DITBrowse-darwin-arm64/`

**Interfaces:**
- Consumes: the complete spreadsheet editor from Tasks 1-4.
- Produces: a verified signed macOS application and publishable branch commits.

- [ ] **Step 1: Run the complete automated suite**

```bash
npm test
npm run test:e2e
npm run test:electron
npm run build
```

Expected: every command exits 0; Electron opens the production renderer rather than raw bundled JavaScript; existing session-reset coverage remains green.

- [ ] **Step 2: Inspect the final diff and repository state**

```bash
git diff --check
git status --short
git log --oneline -6
```

Expected: no whitespace errors, only intentional source/docs changes, and `.DS_Store` remains untracked and unstaged.

- [ ] **Step 3: Build, sign, and notarize the macOS distribution**

```bash
APPLE_NOTARIZE_KEYCHAIN_PROFILE="DITBrowse-notary" npm run package:mac:signed
```

Expected: the signing script validates the Developer ID signature, notarization succeeds, and Gatekeeper assessment passes for the generated app/DMG.

- [ ] **Step 4: Install and launch the verified app**

Quit any running DITBrowse process, replace `/Applications/DITBrowse.app` with the signed build using `ditto`, and launch it:

```bash
pkill -x DITBrowse || true
if [ -d /Applications/DITBrowse.app ]; then
  mv /Applications/DITBrowse.app "/Applications/DITBrowse.backup-$(date +%Y%m%d-%H%M%S).app"
fi
ditto release/DITBrowse-darwin-arm64/DITBrowse.app /Applications/DITBrowse.app
open /Applications/DITBrowse.app
```

Expected: DITBrowse launches from `/Applications`, opens the saved workspace, and **Copy Table** plus direct spreadsheet paste work in the packaged renderer.

- [ ] **Step 5: Commit any verification-only adjustments and push the feature branch**

```bash
git status --short
git push origin codex/browser-shell-redesign
```

Expected: the feature branch on GitHub contains the design, plan, implementation, tests, and signed-build verification commits. Do not add `.DS_Store` or generated `release/` output to git.
