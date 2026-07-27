import type {
  ClipboardEvent as ReactClipboardEvent,
  KeyboardEvent,
  MouseEvent as ReactMouseEvent,
  ReactElement
} from "react";
import { useEffect, useRef, useState } from "react";
import { Copy, GripVertical, Plus, Save, Trash2, X } from "lucide-react";
import type { CameraEntry, CameraList } from "../../shared/types";
import { VIEWPORT_PRESETS } from "../../shared/viewport";
import {
  CAMERA_TABLE_COLUMNS,
  CAMERA_TABLE_COLUMN_COUNT,
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
} from "../cameraTableClipboard";
import type { CameraTableSelection } from "../cameraTableClipboard";
import type { CameraEntryPatch } from "../state/workspaceReducer";
import { Button } from "./ui/Button";
import { Dialog } from "./ui/Dialog";
import { IconButton } from "./ui/IconButton";
import { WorkspaceSettings } from "./WorkspaceSettings";
import type { WorkspaceSettingsProps } from "./WorkspaceSettings";

const CAMERA_CELL_SELECTOR = "[data-camera-list-cell='true']";

function isEnterNavigationKey(event: KeyboardEvent): boolean {
  return (
    event.key === "Enter" ||
    event.key === "NumpadEnter" ||
    event.key === "Return" ||
    event.code === "Enter" ||
    event.code === "NumpadEnter"
  );
}

function moveItem<T>(items: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) {
    return items;
  }

  const next = [...items];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

function cameraViewportValue(camera: CameraEntry): string {
  return camera.viewportOverride
    ? `${camera.viewportOverride.width}x${camera.viewportOverride.height}`
    : "";
}

interface CameraClipboardNotice {
  tone: "success" | "partial" | "error";
  message: string;
  details: string[];
}

interface CameraListEditorProps {
  activeList: CameraList | null;
  workspaceSettings: Omit<WorkspaceSettingsProps, "activeList">;
  onSaveList: (list: CameraList) => void;
  onClose: () => void;
}

export function CameraListEditor({
  activeList,
  workspaceSettings,
  onSaveList,
  onClose
}: CameraListEditorProps): ReactElement {
  const [draftList, setDraftList] = useState<CameraList | null>(
    activeList ? cloneCameraList(activeList) : null
  );
  const [selection, setSelection] = useState<CameraTableSelection | null>(null);
  const [clipboardNotice, setClipboardNotice] = useState<CameraClipboardNotice | null>(null);
  const [lastFollowIndex, setLastFollowIndex] = useState<number | null>(null);
  const [draggedCameraId, setDraggedCameraId] = useState<string | null>(null);
  const [confirmDiscardOpen, setConfirmDiscardOpen] = useState(false);
  const [pendingCameraListId, setPendingCameraListId] = useState<string | null>(null);
  const allFollowCheckboxRef = useRef<HTMLInputElement | null>(null);
  const allRowsFollowPrefix =
    draftList?.cameras.every((camera) => camera.usesListPrefix !== false) ?? false;
  const someRowsFollowPrefix =
    draftList?.cameras.some((camera) => camera.usesListPrefix !== false) ?? false;
  const dirty =
    !!activeList &&
    !!draftList &&
    JSON.stringify(activeList) !== JSON.stringify(draftList);

  useEffect(() => {
    setDraftList(activeList ? cloneCameraList(activeList) : null);
    setSelection(null);
    setClipboardNotice(null);
    setLastFollowIndex(null);
    setPendingCameraListId(null);
  }, [activeList]);

  useEffect(() => {
    if (allFollowCheckboxRef.current) {
      allFollowCheckboxRef.current.indeterminate =
        someRowsFollowPrefix && !allRowsFollowPrefix;
    }
  }, [allRowsFollowPrefix, someRowsFollowPrefix]);

  function updateDraftListPrefix(defaultPrefix: string): void {
    setDraftList((list) => (list ? { ...list, defaultPrefix } : list));
  }

  function updateDraftCamera(cameraId: string, patch: CameraEntryPatch): void {
    setDraftList((list) =>
      list
        ? {
            ...list,
            cameras: list.cameras.map((camera) =>
              camera.id === cameraId
                ? applyDraftCameraPatch(camera, patch, list.defaultPrefix)
                : camera
            )
          }
        : list
    );
  }

  function updateViewport(camera: CameraEntry, width: number, height: number): void {
    updateDraftCamera(camera.id, {
      viewportOverride: width > 0 && height > 0 ? { width, height } : null
    });
  }

  function updateFollowPrefixRange(index: number, usesListPrefix: boolean, shiftKey: boolean): void {
    if (!draftList) {
      return;
    }

    const rangeStart =
      shiftKey && lastFollowIndex !== null ? Math.min(lastFollowIndex, index) : index;
    const rangeEnd =
      shiftKey && lastFollowIndex !== null ? Math.max(lastFollowIndex, index) : index;
    const cameraIds = draftList.cameras
      .slice(rangeStart, rangeEnd + 1)
      .map((camera) => camera.id);

    setDraftList((list) =>
      list
        ? {
            ...list,
            cameras: list.cameras.map((camera) =>
              cameraIds.includes(camera.id)
                ? applyDraftCameraPatch(camera, { usesListPrefix }, list.defaultPrefix)
                : camera
            )
          }
        : list
    );
    setLastFollowIndex(index);
  }

  function updateAllFollowPrefix(usesListPrefix: boolean): void {
    setDraftList((list) =>
      list
        ? {
            ...list,
            cameras: list.cameras.map((camera) =>
              applyDraftCameraPatch(camera, { usesListPrefix }, list.defaultPrefix)
            )
          }
        : list
    );
    setLastFollowIndex(null);
  }

  function addCamera(): void {
    setDraftList((list) => {
      if (!list) {
        return list;
      }

      return appendSequentialCamera(list);
    });
  }

  function updateCameraCount(value: string): void {
    const nextCount = Number(value);
    if (!Number.isInteger(nextCount)) {
      return;
    }

    setDraftList((list) => (list ? resizeDraftCameraList(list, nextCount) : list));
    setLastFollowIndex(null);
  }

  function deleteCamera(cameraId: string): void {
    setDraftList((list) =>
      list
        ? {
            ...list,
            cameras: list.cameras.filter((camera) => camera.id !== cameraId)
          }
        : list
    );
  }

  function moveCamera(cameraId: string, toIndex: number): void {
    setDraftList((list) => {
      if (!list) {
        return list;
      }

      const fromIndex = list.cameras.findIndex((camera) => camera.id === cameraId);
      return {
        ...list,
        cameras: moveItem(list.cameras, fromIndex, toIndex)
      };
    });
  }

  function saveChanges(): void {
    if (!draftList) {
      return;
    }

    onSaveList(draftList);
    onClose();
  }

  function discardChanges(): void {
    if (dirty) {
      setConfirmDiscardOpen(true);
      return;
    }

    onClose();
  }

  function requestCameraListSwitch(cameraListId: string): void {
    if (!cameraListId || cameraListId === workspaceSettings.activeCameraListId) {
      return;
    }

    if (!dirty) {
      workspaceSettings.onSelectCameraList(cameraListId);
      return;
    }

    setPendingCameraListId(cameraListId);
  }

  function completeCameraListSwitch(mode: "save" | "discard"): void {
    if (!pendingCameraListId) {
      return;
    }

    const cameraListId = pendingCameraListId;
    if (mode === "save" && draftList) {
      onSaveList(draftList);
    }

    setPendingCameraListId(null);
    workspaceSettings.onSelectCameraList(cameraListId);
  }

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
        ? createCameraTableSelection("rows", current.anchor, {
            rowIndex,
            columnIndex: 0
          })
        : createCameraTableSelection("rows", { rowIndex, columnIndex: 0 })
    );
  }

  function selectColumn(columnIndex: number, extend: boolean): void {
    setSelection((current) =>
      extend && current?.mode === "columns"
        ? createCameraTableSelection("columns", current.anchor, {
            rowIndex: 0,
            columnIndex
          })
        : createCameraTableSelection("columns", { rowIndex: 0, columnIndex })
    );
  }

  function focusCameraCell(
    tableBody: HTMLTableSectionElement,
    rowIndex: number,
    columnIndex: number
  ): boolean {
    const target = tableBody.querySelector<HTMLInputElement | HTMLSelectElement>(
      `${CAMERA_CELL_SELECTOR}[data-camera-list-row='${rowIndex}'][data-camera-list-column='${columnIndex}']`
    );
    if (!target) {
      return false;
    }

    target.focus();
    if (target instanceof HTMLInputElement && target.type !== "checkbox") {
      target.select();
    }
    setSelection(createCameraTableSelection("cells", { rowIndex, columnIndex }));
    return true;
  }

  function handleCameraTableKeyDown(event: KeyboardEvent<HTMLTableSectionElement>): void {
    const isEnterKey = isEnterNavigationKey(event);
    if (!draftList || (!isEnterKey && event.key !== "Tab")) {
      return;
    }

    if (event.metaKey || event.ctrlKey || event.altKey) {
      return;
    }

    const cell = (event.target as HTMLElement | null)?.closest<HTMLElement>(CAMERA_CELL_SELECTOR);
    if (!cell || !event.currentTarget.contains(cell)) {
      return;
    }

    if (isEnterKey && event.target instanceof HTMLButtonElement) {
      return;
    }

    const rowIndex = Number(cell.dataset.cameraListRow);
    const columnIndex = Number(cell.dataset.cameraListColumn);
    if (!Number.isInteger(rowIndex) || !Number.isInteger(columnIndex)) {
      return;
    }

    if (isEnterKey) {
      const targetRowIndex = rowIndex + (event.shiftKey ? -1 : 1);
      if (targetRowIndex < 0 || targetRowIndex >= draftList.cameras.length) {
        event.preventDefault();
        return;
      }

      event.preventDefault();
      focusCameraCell(event.currentTarget, targetRowIndex, columnIndex);
      return;
    }

    const nextColumnIndex = columnIndex + (event.shiftKey ? -1 : 1);
    const targetColumnIndex =
      nextColumnIndex < 0
        ? CAMERA_TABLE_COLUMN_COUNT - 1
        : nextColumnIndex >= CAMERA_TABLE_COLUMN_COUNT
          ? 0
          : nextColumnIndex;
    const targetRowIndex =
      nextColumnIndex < 0
        ? rowIndex - 1
        : nextColumnIndex >= CAMERA_TABLE_COLUMN_COUNT
          ? rowIndex + 1
          : rowIndex;

    if (targetRowIndex < 0 || targetRowIndex >= draftList.cameras.length) {
      return;
    }

    event.preventDefault();
    focusCameraCell(event.currentTarget, targetRowIndex, targetColumnIndex);
  }

  function handleCameraTableCopy(event: ReactClipboardEvent<HTMLTableElement>): void {
    if (!draftList || !selection) {
      return;
    }

    const text = serializeCameraTableSelection(draftList, selection);
    if (!text) {
      return;
    }

    event.preventDefault();
    event.clipboardData.setData("text/plain", text);
  }

  function handleCameraTablePaste(event: ReactClipboardEvent<HTMLTableElement>): void {
    if (!draftList || !selection) {
      return;
    }

    const result = pasteCameraTableText(
      draftList,
      selection.active,
      event.clipboardData.getData("text/plain")
    );
    if (!result) {
      return;
    }

    event.preventDefault();
    setDraftList(result.list);
    setSelection(result.selection);
    setLastFollowIndex(null);
    setClipboardNotice({
      tone: result.issues.length > 0 ? "partial" : "success",
      message: `Pasted ${result.cellsUpdated} cells${
        result.rowsAdded > 0 ? ` and added ${result.rowsAdded} camera rows` : ""
      }${result.issues.length > 0 ? `; skipped ${result.issues.length}` : ""}.`,
      details: result.issues.map(
        (issue) =>
          `Row ${issue.cameraRow ?? issue.sourceRow}, ${issue.column}: ${JSON.stringify(
            issue.value
          )} - ${issue.message}`
      )
    });
  }

  async function copyWholeCameraTable(): Promise<void> {
    if (!draftList) {
      return;
    }

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error("Clipboard write unavailable");
      }
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

  function cameraControlProps(rowIndex: number, columnIndex: number) {
    return {
      "data-camera-list-cell": "true",
      "data-camera-list-row": String(rowIndex),
      "data-camera-list-column": String(columnIndex)
    };
  }

  function cameraCellProps(rowIndex: number, columnIndex: number) {
    const rowCount = draftList?.cameras.length ?? 0;
    const bounds = selection
      ? cameraTableSelectionBounds(selection, rowCount)
      : null;
    const selected = isCameraTableCellSelected(
      selection,
      rowCount,
      rowIndex,
      columnIndex
    );
    const active =
      selected &&
      selection?.active.rowIndex === rowIndex &&
      selection.active.columnIndex === columnIndex;
    const classes = [
      selected ? "camera-cell-selected" : "",
      active ? "camera-cell-active" : "",
      selected && bounds?.rowStart === rowIndex ? "camera-cell-edge-top" : "",
      selected && bounds?.rowEnd === rowIndex ? "camera-cell-edge-bottom" : "",
      selected && bounds?.columnStart === columnIndex ? "camera-cell-edge-left" : "",
      selected && bounds?.columnEnd === columnIndex ? "camera-cell-edge-right" : ""
    ]
      .filter(Boolean)
      .join(" ");

    return {
      className: classes || undefined,
      "aria-selected": selected,
      onClick: (event: ReactMouseEvent<HTMLTableCellElement>) => {
        selectCell(rowIndex, columnIndex, event.shiftKey);
        if (event.target === event.currentTarget) {
          event.currentTarget
            .querySelector<HTMLInputElement | HTMLSelectElement>(CAMERA_CELL_SELECTOR)
            ?.focus();
        }
      }
    };
  }

  function rowIsSelected(rowIndex: number): boolean {
    return (
      selection?.mode === "rows" &&
      isCameraTableCellSelected(
        selection,
        draftList?.cameras.length ?? 0,
        rowIndex,
        0
      )
    );
  }

  function columnIsSelected(columnIndex: number): boolean {
    return (
      selection?.mode === "columns" &&
      isCameraTableCellSelected(
        selection,
        draftList?.cameras.length ?? 0,
        0,
        columnIndex
      )
    );
  }

  return (
    <div className="panel-backdrop">
      <section className="editor-panel" aria-label="Camera list editor">
        <header className="panel-header">
          <h2>{draftList?.name ?? "Camera List"}</h2>
          <div className="panel-header-actions">
            <Button
              icon={<X size={14} strokeWidth={2.2} />}
              variant="ghost"
              size="compact"
              onClick={discardChanges}
            >
              Discard
            </Button>
            <Button
              icon={<Save size={14} strokeWidth={2.2} />}
              variant="primary"
              size="compact"
              disabled={!dirty}
              onClick={saveChanges}
            >
              Save Changes
            </Button>
          </div>
        </header>
        {draftList && (
          <section className="camera-list-table-section" aria-label="Editable camera table">
            <div className="editor-prefix-row">
              <label className="editor-field">
                List Prefix
                <input
                  value={draftList.defaultPrefix}
                  onChange={(event) => updateDraftListPrefix(event.target.value)}
                />
              </label>
            </div>
            <div className="editor-list-toolbar" aria-label="Camera list controls">
              <Button
                icon={<Plus size={14} strokeWidth={2.2} />}
                variant="subtle"
                size="compact"
                onClick={addCamera}
              >
                Add Camera Row
              </Button>
              <label className="editor-count-field">
                <input
                  aria-label="Camera count"
                  type="number"
                  min="0"
                  max="99"
                  step="1"
                  value={draftList.cameras.length}
                  onChange={(event) => updateCameraCount(event.target.value)}
                />
                Cameras
              </label>
              <Button
                icon={<Copy size={14} strokeWidth={2.2} />}
                variant="subtle"
                size="compact"
                tooltip={{
                  title: "Copy camera table",
                  description:
                    "Copies editable camera details with headers for Numbers, Excel, or Google Sheets. Follow Prefix stays in DITBrowse."
                }}
                onClick={() => void copyWholeCameraTable()}
              >
                Copy Table
              </Button>
            </div>
            {clipboardNotice && (
              <div
                className="camera-clipboard-notice"
                data-tone={clipboardNotice.tone}
                role={clipboardNotice.tone === "error" ? "alert" : "status"}
                aria-live={clipboardNotice.tone === "error" ? "assertive" : "polite"}
              >
                <span>{clipboardNotice.message}</span>
                {clipboardNotice.details.length > 0 && (
                  <ul className="camera-clipboard-issues">
                    {clipboardNotice.details.map((detail) => (
                      <li key={detail}>{detail}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}
            <div className="camera-table-wrap">
              <table
                className="camera-table"
                onCopy={handleCameraTableCopy}
                onPaste={handleCameraTablePaste}
              >
                <caption className="camera-table-caption">
                  Click a cell, row handle, or column heading to select it. Shift-click extends a
                  selection. Press Command+C to copy and Command+V to paste.
                </caption>
                <thead>
                  <tr>
                    <th>Move</th>
                    <th>Delete</th>
                    {CAMERA_TABLE_COLUMNS.map((column, columnIndex) => (
                      <th key={column.key}>
                        <div className="camera-column-heading">
                          <button
                            type="button"
                            className="camera-column-select"
                            aria-label={`Select ${column.label} column`}
                            aria-pressed={columnIsSelected(columnIndex)}
                            onClick={(event) =>
                              selectColumn(columnIndex, event.shiftKey)
                            }
                          >
                            {column.label}
                          </button>
                          {columnIndex === 0 && (
                            <input
                              ref={allFollowCheckboxRef}
                              type="checkbox"
                              checked={allRowsFollowPrefix}
                              aria-label="All follow prefix"
                              onChange={(event) =>
                                updateAllFollowPrefix(event.target.checked)
                              }
                            />
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody onKeyDown={handleCameraTableKeyDown}>
                  {draftList.cameras.map((camera, rowIndex) => (
                    <tr
                      key={camera.id}
                      draggable
                      onDragStart={(event) => {
                        setDraggedCameraId(camera.id);
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", camera.id);
                      }}
                      onDragOver={(event) => event.preventDefault()}
                      onDrop={(event) => {
                        event.preventDefault();
                        const sourceCameraId =
                          draggedCameraId || event.dataTransfer.getData("text/plain");
                        if (sourceCameraId && sourceCameraId !== camera.id) {
                          moveCamera(sourceCameraId, rowIndex);
                        }
                        setDraggedCameraId(null);
                      }}
                      onDragEnd={() => setDraggedCameraId(null)}
                    >
                      <td className="camera-row-action-cell">
                        <IconButton
                          className="camera-row-drag"
                          label={`Select row ${rowIndex + 1}; drag to move ${camera.name}`}
                          aria-pressed={rowIsSelected(rowIndex)}
                          tooltip={{
                            title: "Select or move camera",
                            description:
                              "Click to select this row, or drag it to change its tab and grid position."
                          }}
                          icon={<GripVertical size={14} strokeWidth={2.2} />}
                          onClick={(event) => selectRow(rowIndex, event.shiftKey)}
                        />
                      </td>
                      <td className="camera-row-action-cell">
                        <IconButton
                          className="camera-row-delete"
                          label={`Delete ${camera.name}`}
                          tooltip={{
                            title: "Delete camera",
                            description: "Removes this camera row when the list changes are saved."
                          }}
                          icon={<Trash2 size={14} strokeWidth={2.2} />}
                          onClick={() => deleteCamera(camera.id)}
                        />
                      </td>
                      <td {...cameraCellProps(rowIndex, 0)}>
                        <input
                          {...cameraControlProps(rowIndex, 0)}
                          type="checkbox"
                          checked={camera.usesListPrefix !== false}
                          onClick={(event) =>
                            updateFollowPrefixRange(
                              draftList.cameras.findIndex(
                                (candidate) => candidate.id === camera.id
                              ),
                              event.currentTarget.checked,
                              event.shiftKey
                            )
                          }
                          onChange={() => undefined}
                          aria-label={`${camera.name} follow prefix`}
                        />
                      </td>
                      <td {...cameraCellProps(rowIndex, 1)}>
                        <input
                          {...cameraControlProps(rowIndex, 1)}
                          value={camera.name}
                          onChange={(event) =>
                            updateDraftCamera(camera.id, { name: event.target.value })
                          }
                          aria-label={`${camera.name} index`}
                        />
                      </td>
                      <td {...cameraCellProps(rowIndex, 2)}>
                        <input
                          {...cameraControlProps(rowIndex, 2)}
                          value={camera.suffix}
                          onChange={(event) =>
                            updateDraftCamera(camera.id, { suffix: event.target.value })
                          }
                          aria-label={`${camera.name} camera number`}
                        />
                      </td>
                      <td {...cameraCellProps(rowIndex, 3)}>
                        <input
                          {...cameraControlProps(rowIndex, 3)}
                          value={camera.url}
                          onChange={(event) =>
                            updateDraftCamera(camera.id, { url: event.target.value })
                          }
                          aria-label={`${camera.name} URL`}
                        />
                      </td>
                      <td {...cameraCellProps(rowIndex, 4)}>
                        <input
                          {...cameraControlProps(rowIndex, 4)}
                          value={camera.cameraType}
                          onChange={(event) =>
                            updateDraftCamera(camera.id, { cameraType: event.target.value })
                          }
                          aria-label={`${camera.name} type`}
                        />
                      </td>
                      <td {...cameraCellProps(rowIndex, 5)}>
                        <input
                          {...cameraControlProps(rowIndex, 5)}
                          value={camera.lens}
                          onChange={(event) =>
                            updateDraftCamera(camera.id, { lens: event.target.value })
                          }
                          aria-label={`${camera.name} lens`}
                        />
                      </td>
                      <td {...cameraCellProps(rowIndex, 6)}>
                        <input
                          {...cameraControlProps(rowIndex, 6)}
                          value={camera.displayNote}
                          onChange={(event) =>
                            updateDraftCamera(camera.id, { displayNote: event.target.value })
                          }
                          aria-label={`${camera.name} display note`}
                        />
                      </td>
                      <td {...cameraCellProps(rowIndex, 7)}>
                        <select
                          {...cameraControlProps(rowIndex, 7)}
                          value={cameraViewportValue(camera)}
                          onChange={(event) => {
                            if (!event.target.value) {
                              updateDraftCamera(camera.id, { viewportOverride: null });
                              return;
                            }
                            const [width, height] = event.target.value.split("x").map(Number);
                            updateViewport(camera, width, height);
                          }}
                          aria-label={`${camera.name} viewport`}
                        >
                          <option value="">Default</option>
                          {cameraViewportValue(camera) &&
                            !VIEWPORT_PRESETS.some(
                              (preset) => preset.value === cameraViewportValue(camera)
                            ) && (
                              <option value={cameraViewportValue(camera)}>
                                {cameraViewportValue(camera)}
                              </option>
                            )}
                          {VIEWPORT_PRESETS.map((preset) => (
                            <option key={preset.value} value={preset.value}>
                              {preset.label}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td {...cameraCellProps(rowIndex, 8)}>
                        <input
                          {...cameraControlProps(rowIndex, 8)}
                          type="number"
                          min="0.25"
                          max="3"
                          step="0.05"
                          value={camera.zoomOverride ?? ""}
                          placeholder="Default"
                          onChange={(event) =>
                            updateDraftCamera(camera.id, {
                              zoomOverride: event.target.value ? Number(event.target.value) : null
                            })
                          }
                          aria-label={`${camera.name} zoom`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        <WorkspaceSettings
          {...workspaceSettings}
          activeList={activeList}
          onSelectCameraList={requestCameraListSwitch}
        />
        {pendingCameraListId && (
          <Dialog
            title="Save camera-list changes?"
            description="Choose whether to save or discard the current table changes before opening another camera list."
            onClose={() => setPendingCameraListId(null)}
            actions={
              <>
                <Button variant="ghost" onClick={() => setPendingCameraListId(null)}>
                  Cancel
                </Button>
                <Button variant="danger" onClick={() => completeCameraListSwitch("discard")}>
                  Discard and Switch
                </Button>
                <Button variant="primary" onClick={() => completeCameraListSwitch("save")}>
                  Save and Switch
                </Button>
              </>
            }
          />
        )}
        {confirmDiscardOpen && (
          <Dialog
            title="Discard camera-list changes?"
            description="Your unsaved camera rows, addresses, metadata, viewport, and zoom changes will be lost."
            onClose={() => setConfirmDiscardOpen(false)}
            actions={
              <>
                <Button variant="ghost" onClick={() => setConfirmDiscardOpen(false)}>
                  Keep editing
                </Button>
                <Button variant="danger" onClick={onClose}>
                  Discard changes
                </Button>
              </>
            }
          />
        )}
      </section>
    </div>
  );
}
