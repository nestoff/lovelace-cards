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
export type CameraIdFactory = () => string;

const CAMERA_TABLE_SPREADSHEET_COLUMN_INDEXES = CAMERA_TABLE_COLUMNS.flatMap(
  (column, columnIndex) => (column.key === "usesListPrefix" ? [] : [columnIndex])
);

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
  if (rowCount <= 0) {
    return null;
  }

  const rowStart =
    selection.mode === "columns"
      ? 0
      : Math.min(selection.anchor.rowIndex, selection.active.rowIndex);
  const rowEnd =
    selection.mode === "columns"
      ? rowCount - 1
      : Math.max(selection.anchor.rowIndex, selection.active.rowIndex);
  const columnStart =
    selection.mode === "rows"
      ? 0
      : Math.min(selection.anchor.columnIndex, selection.active.columnIndex);
  const columnEnd =
    selection.mode === "rows"
      ? CAMERA_TABLE_COLUMN_COUNT - 1
      : Math.max(selection.anchor.columnIndex, selection.active.columnIndex);

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
  if (!selection) {
    return false;
  }

  const bounds = cameraTableSelectionBounds(selection, rowCount);
  return (
    !!bounds &&
    rowIndex >= bounds.rowStart &&
    rowIndex <= bounds.rowEnd &&
    columnIndex >= bounds.columnStart &&
    columnIndex <= bounds.columnEnd
  );
}

export function cloneCameraList(list: CameraList): CameraList {
  return {
    ...list,
    cameras: list.cameras.map((camera) => ({
      ...camera,
      viewportOverride: camera.viewportOverride ? { ...camera.viewportOverride } : null
    }))
  };
}

function draftCameraId(): string {
  return `camera-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
}

function createDraftCamera(
  prefix: string,
  index: string,
  suffix: string,
  createId: CameraIdFactory
): CameraEntry {
  const normalizedPrefix = normalizeCameraPrefix(prefix);
  return {
    id: createId(),
    name: index,
    url: `${normalizedPrefix}${suffix}`,
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

export function appendSequentialCamera(
  list: CameraList,
  createId: CameraIdFactory = draftCameraId
): CameraList {
  const { index, suffix } = nextCameraDefaults(list.cameras);
  return {
    ...list,
    cameras: [
      ...list.cameras,
      createDraftCamera(list.defaultPrefix, index, suffix, createId)
    ]
  };
}

export function resizeDraftCameraList(
  list: CameraList,
  count: number,
  createId: CameraIdFactory = draftCameraId
): CameraList {
  const safeCount = Number.isFinite(count)
    ? Math.max(0, Math.min(99, Math.trunc(count)))
    : list.cameras.length;
  if (safeCount === list.cameras.length) {
    return list;
  }

  if (safeCount < list.cameras.length) {
    return {
      ...list,
      cameras: list.cameras.slice(0, safeCount)
    };
  }

  let next = list;
  while (next.cameras.length < safeCount) {
    next = appendSequentialCamera(next, createId);
  }
  return next;
}

function cameraUsesDraftPrefix(camera: CameraEntry): boolean {
  return camera.usesListPrefix !== false;
}

export function applyDraftCameraPatch(
  camera: CameraEntry,
  patch: CameraEntryPatch,
  listPrefix: string
): CameraEntry {
  const normalizedPrefix = normalizeCameraPrefix(listPrefix);
  const normalizedPatch = {
    ...patch,
    ...(patch.suffix !== undefined
      ? { suffix: normalizeCameraNumberSuffix(patch.suffix) }
      : {}),
    ...(patch.url !== undefined ? { url: normalizeCameraUrl(patch.url) } : {})
  };
  const shouldUpdateDefaultIndex =
    "suffix" in normalizedPatch && isDefaultIndexForSuffix(camera.name, camera.suffix);
  let next: CameraEntry = { ...camera, ...normalizedPatch };

  if (shouldUpdateDefaultIndex) {
    next = { ...next, name: defaultIndexForSuffix(next.suffix) || next.name };
  }

  if ("usesListPrefix" in normalizedPatch) {
    next =
      normalizedPatch.usesListPrefix === false
        ? { ...next, usesListPrefix: false }
        : { ...next, usesListPrefix: true, url: `${normalizedPrefix}${next.suffix}` };
  } else if ("suffix" in normalizedPatch && cameraUsesDraftPrefix(camera)) {
    next = { ...next, usesListPrefix: true, url: `${normalizedPrefix}${next.suffix}` };
  } else if ("url" in normalizedPatch) {
    const isDerivedUrl =
      next.url === "" ||
      next.url === normalizedPrefix ||
      next.url === `${normalizedPrefix}${next.suffix}`;
    next = isDerivedUrl
      ? { ...next, usesListPrefix: true, url: `${normalizedPrefix}${next.suffix}` }
      : { ...next, usesListPrefix: false };
  }

  if (
    "zoomOverride" in normalizedPatch &&
    normalizedPatch.zoomOverride !== null &&
    normalizedPatch.zoomOverride !== undefined
  ) {
    next = { ...next, zoomOverride: Number(normalizedPatch.zoomOverride) };
  }

  return next;
}

function cameraTableCellValue(camera: CameraEntry, columnIndex: number): string {
  const column = CAMERA_TABLE_COLUMNS[columnIndex];
  if (!column) {
    return "";
  }

  switch (column.key) {
    case "usesListPrefix":
      return camera.usesListPrefix === false ? "FALSE" : "TRUE";
    case "name":
      return camera.name;
    case "suffix":
      return camera.suffix;
    case "url":
      return camera.url;
    case "cameraType":
      return camera.cameraType;
    case "lens":
      return camera.lens;
    case "displayNote":
      return camera.displayNote;
    case "viewportOverride":
      return camera.viewportOverride
        ? `${camera.viewportOverride.width}x${camera.viewportOverride.height}`
        : "";
    case "zoomOverride":
      return camera.zoomOverride === null ? "" : String(camera.zoomOverride);
  }
}

function serializeRows(
  list: CameraList,
  bounds: CameraTableSelectionBounds
): string {
  const rows: string[] = [];
  for (let rowIndex = bounds.rowStart; rowIndex <= bounds.rowEnd; rowIndex += 1) {
    const camera = list.cameras[rowIndex];
    if (!camera) {
      continue;
    }

    const values: string[] = [];
    for (
      let columnIndex = bounds.columnStart;
      columnIndex <= bounds.columnEnd;
      columnIndex += 1
    ) {
      values.push(cameraTableCellValue(camera, columnIndex));
    }
    rows.push(values.join("\t"));
  }
  return rows.join("\n");
}

export function serializeCameraTableSelection(
  list: CameraList,
  selection: CameraTableSelection
): string {
  const bounds = cameraTableSelectionBounds(selection, list.cameras.length);
  return bounds ? serializeRows(list, bounds) : "";
}

export function serializeWholeCameraTable(list: CameraList): string {
  const headers = CAMERA_TABLE_SPREADSHEET_COLUMN_INDEXES.map(
    (columnIndex) => CAMERA_TABLE_COLUMNS[columnIndex].label
  ).join("\t");
  if (list.cameras.length === 0) {
    return headers;
  }

  const rows = list.cameras
    .map((camera) =>
      CAMERA_TABLE_SPREADSHEET_COLUMN_INDEXES.map((columnIndex) =>
        cameraTableCellValue(camera, columnIndex)
      ).join("\t")
    )
    .join("\n");
  return `${headers}\n${rows}`;
}

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

const HEADER_COLUMN_INDEX = new Map<string, number>();
for (const [columnIndex, column] of CAMERA_TABLE_COLUMNS.entries()) {
  const aliases = [column.label, column.key, ...HEADER_ALIASES[column.key]];
  for (const alias of aliases) {
    HEADER_COLUMN_INDEX.set(normalizeHeader(alias), columnIndex);
  }
}

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

interface PasteAssignment {
  columnIndex: number;
  sourceColumnIndex: number;
  value: string;
}

type ParsedPatch =
  | { ok: true; patch: CameraEntryPatch }
  | { ok: false; message: string };

function normalizeHeader(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function parseClipboardRows(text: string): string[][] {
  if (!text) {
    return [];
  }

  const normalized = text.replace(/\r\n?/g, "\n");
  const lines = normalized.split("\n");
  if (lines.at(-1) === "") {
    lines.pop();
  }
  return lines.map((line) => line.split("\t"));
}

function parseFollowPrefix(value: string): boolean | undefined {
  const normalized = value.trim().toLowerCase();
  if (!normalized) {
    return true;
  }
  if (["true", "yes", "1", "on"].includes(normalized)) {
    return true;
  }
  if (["false", "no", "0", "off"].includes(normalized)) {
    return false;
  }
  return undefined;
}

function parseViewport(value: string): CameraEntry["viewportOverride"] | undefined {
  const normalized = value.trim();
  if (!normalized || normalized.toLowerCase() === "default") {
    return null;
  }

  const match = normalized.match(/^(\d+)\s*[xX]\s*(\d+)$/);
  if (!match) {
    return undefined;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  return width > 0 && height > 0 ? { width, height } : undefined;
}

function parseZoom(value: string): number | null | undefined {
  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "default") {
    return null;
  }

  const parsed = normalized.endsWith("%")
    ? Number(normalized.slice(0, -1)) / 100
    : Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0.25 && parsed <= 3
    ? parsed
    : undefined;
}

function parseAssignmentPatch(
  key: CameraTableColumnKey,
  value: string
): ParsedPatch {
  switch (key) {
    case "usesListPrefix": {
      const usesListPrefix = parseFollowPrefix(value);
      return usesListPrefix === undefined
        ? {
            ok: false,
            message: "Expected true, false, yes, no, 1, 0, on, or off."
          }
        : { ok: true, patch: { usesListPrefix } };
    }
    case "name":
      return { ok: true, patch: { name: value } };
    case "suffix":
      return { ok: true, patch: { suffix: value } };
    case "url":
      return { ok: true, patch: { url: value } };
    case "cameraType":
      return { ok: true, patch: { cameraType: value } };
    case "lens":
      return { ok: true, patch: { lens: value } };
    case "displayNote":
      return { ok: true, patch: { displayNote: value } };
    case "viewportOverride": {
      const viewportOverride = parseViewport(value);
      return viewportOverride === undefined
        ? { ok: false, message: "Expected WIDTHxHEIGHT or Default." }
        : { ok: true, patch: { viewportOverride } };
    }
    case "zoomOverride": {
      const zoomOverride = parseZoom(value);
      return zoomOverride === undefined
        ? {
            ok: false,
            message: "Expected 25%-300% or a scale from 0.25 to 3."
          }
        : { ok: true, patch: { zoomOverride } };
    }
  }
}

function assignmentsForPositionalRow(
  row: string[],
  startColumnIndex: number,
  sourceRow: number,
  cameraRow: number,
  issues: CameraTablePasteIssue[]
): PasteAssignment[] {
  return row.flatMap((value, sourceColumnIndex) => {
    const columnIndex = startColumnIndex + sourceColumnIndex;
    if (columnIndex >= CAMERA_TABLE_COLUMN_COUNT) {
      issues.push({
        sourceRow,
        cameraRow,
        column: `Column ${columnIndex + 1}`,
        value,
        message: "No camera table column exists at this position."
      });
      return [];
    }
    return [{ columnIndex, sourceColumnIndex, value }];
  });
}

function assignmentsForHeaderRow(
  row: string[],
  headerColumns: Array<number | null>
): PasteAssignment[] {
  return headerColumns.flatMap((columnIndex, sourceColumnIndex) => {
    if (
      columnIndex === null ||
      sourceColumnIndex >= row.length ||
      CAMERA_TABLE_COLUMNS[columnIndex].key === "usesListPrefix"
    ) {
      return [];
    }
    return [{ columnIndex, sourceColumnIndex, value: row[sourceColumnIndex] }];
  });
}

function sortAssignments(assignments: PasteAssignment[]): PasteAssignment[] {
  return [...assignments].sort((a, b) => {
    const aKey = CAMERA_TABLE_COLUMNS[a.columnIndex].key;
    const bKey = CAMERA_TABLE_COLUMNS[b.columnIndex].key;
    return APPLY_PRIORITY.indexOf(aKey) - APPLY_PRIORITY.indexOf(bKey);
  });
}

export function pasteCameraTableText(
  list: CameraList,
  activeCell: CameraTableCell,
  text: string,
  createId: CameraIdFactory = draftCameraId
): CameraTablePasteResult | null {
  const rows = parseClipboardRows(text);
  if (rows.length === 0) {
    return null;
  }

  const firstRowColumnIndexes = rows[0].map((header) => {
    const columnIndex = HEADER_COLUMN_INDEX.get(normalizeHeader(header));
    return columnIndex === undefined ? null : columnIndex;
  });
  const recognizedHeaderCount = firstRowColumnIndexes.filter(
    (columnIndex): columnIndex is number => columnIndex !== null
  ).length;
  const mode = recognizedHeaderCount >= 2 ? "headers" : "positional";
  const headerColumns = mode === "headers" ? firstRowColumnIndexes : [];
  const dataRows = mode === "headers" ? rows.slice(1) : rows;
  const destinationStartRow = mode === "headers" ? 0 : activeCell.rowIndex;
  const issues: CameraTablePasteIssue[] = [];

  if (mode === "headers") {
    rows[0].forEach((header, sourceColumnIndex) => {
      if (headerColumns[sourceColumnIndex] !== null) {
        return;
      }
      issues.push({
        sourceRow: 1,
        cameraRow: null,
        column: header || `Column ${sourceColumnIndex + 1}`,
        value: header,
        message: "Unknown spreadsheet header."
      });
    });
  }

  let nextList = cloneCameraList(list);
  const requiredRowCount = Math.min(99, destinationStartRow + dataRows.length);
  while (nextList.cameras.length < requiredRowCount) {
    nextList = appendSequentialCamera(nextList, createId);
  }
  const rowsAdded = nextList.cameras.length - list.cameras.length;
  let cellsUpdated = 0;

  const mappedColumns =
    mode === "headers"
      ? headerColumns.filter(
          (columnIndex): columnIndex is number =>
            columnIndex !== null &&
            CAMERA_TABLE_COLUMNS[columnIndex].key !== "usesListPrefix"
        )
      : dataRows.flatMap((row) =>
          row.map((_, sourceColumnIndex) => activeCell.columnIndex + sourceColumnIndex)
        ).filter((columnIndex) => columnIndex < CAMERA_TABLE_COLUMN_COUNT);
  const selectionColumnStart =
    mappedColumns.length > 0 ? Math.min(...mappedColumns) : activeCell.columnIndex;
  const selectionColumnEnd =
    mappedColumns.length > 0 ? Math.max(...mappedColumns) : activeCell.columnIndex;
  let finalDestinationRow = destinationStartRow;

  dataRows.forEach((row, dataRowIndex) => {
    const destinationRow = destinationStartRow + dataRowIndex;
    const sourceRow = dataRowIndex + (mode === "headers" ? 2 : 1);
    if (destinationRow >= 99 || !nextList.cameras[destinationRow]) {
      issues.push({
        sourceRow,
        cameraRow: destinationRow + 1,
        column: "Row",
        value: row.join("\t"),
        message: "Camera list is limited to 99 rows."
      });
      return;
    }

    finalDestinationRow = destinationRow;
    const assignments =
      mode === "headers"
        ? assignmentsForHeaderRow(row, headerColumns)
        : assignmentsForPositionalRow(
            row,
            activeCell.columnIndex,
            sourceRow,
            destinationRow + 1,
            issues
          );
    let camera = nextList.cameras[destinationRow];

    for (const assignment of sortAssignments(assignments)) {
      const column = CAMERA_TABLE_COLUMNS[assignment.columnIndex];
      const parsed = parseAssignmentPatch(column.key, assignment.value);
      if (!parsed.ok) {
        issues.push({
          sourceRow,
          cameraRow: destinationRow + 1,
          column: column.label,
          value: assignment.value,
          message: parsed.message
        });
        continue;
      }

      camera = applyDraftCameraPatch(camera, parsed.patch, nextList.defaultPrefix);
      cellsUpdated += 1;
    }
    nextList.cameras[destinationRow] = camera;
  });

  return {
    list: nextList,
    selection: createCameraTableSelection(
      "cells",
      { rowIndex: destinationStartRow, columnIndex: selectionColumnStart },
      { rowIndex: finalDestinationRow, columnIndex: selectionColumnEnd }
    ),
    mode,
    rowsAdded,
    cellsUpdated,
    issues
  };
}
