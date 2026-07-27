import type { ComponentProps } from "react";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { sampleWorkspace } from "../../shared/sampleData";
import type { CameraList } from "../../shared/types";
import { CameraListEditor } from "./CameraListEditor";

type CameraListEditorProps = ComponentProps<typeof CameraListEditor>;

function createWorkspaceSettings(
  overrides: Partial<CameraListEditorProps["workspaceSettings"]> = {}
): CameraListEditorProps["workspaceSettings"] {
  return {
    jobs: sampleWorkspace.jobs,
    cameraLists: sampleWorkspace.cameraLists,
    activeCameraListId: sampleWorkspace.activeCameraListId,
    onSelectCameraList: vi.fn(),
    onCreateJob: vi.fn(),
    onUpdateJobName: vi.fn(),
    onDeleteJob: vi.fn(),
    credentialPresets: [],
    passwordRecords: [],
    onAddCredentialPreset: vi.fn(),
    onDeleteCredentialPreset: vi.fn(),
    onDeletePasswordRecord: vi.fn(),
    onResetSelectedScale: vi.fn(),
    onResetGridOrder: vi.fn(),
    pingIntervalSeconds: 5,
    onSetPingIntervalSeconds: vi.fn(),
    controlApiInfo: {
      host: "127.0.0.1",
      port: 54321,
      baseUrl: "http://127.0.0.1:54321",
      configuredPort: 54321,
      bindHost: "127.0.0.1",
      lanAccess: false
    },
    onSetControlApiPort: vi.fn(async () => undefined),
    onSetControlApiBindHost: vi.fn(async () => undefined),
    swp08Info: {
      enabled: false,
      host: "127.0.0.1",
      port: 8910,
      matrix: 0,
      levels: 1,
      sources: 64,
      destinations: 1,
      focusDestination: 1,
      listening: false,
      clientCount: 0
    },
    onSetSwp08Config: vi.fn(async () => undefined),
    companionModuleStatus: {
      state: "current",
      pathSource: "companion",
      bundledVersion: "0.1.0",
      installedVersion: "0.1.0",
      targetPath: "/tmp/Devmodules/lightlab-ditbrowse",
      message: "DIT Browse Companion module 0.1.0 is installed.",
      canInstall: false
    },
    companionModuleBusy: false,
    companionModuleError: "",
    onRefreshCompanionModuleStatus: vi.fn(async () => undefined),
    onInstallCompanionModule: vi.fn(async () => undefined),
    onChooseAndInstallCompanionModule: vi.fn(async () => false),
    ...overrides
  };
}

function renderEditor(overrides: Partial<CameraListEditorProps> = {}) {
  const onSaveList = vi.fn<(list: CameraList) => void>();
  const onClose = vi.fn();
  const workspaceSettings = createWorkspaceSettings();
  const props: CameraListEditorProps = {
    activeList: sampleWorkspace.cameraLists[0],
    workspaceSettings,
    onSaveList,
    onClose,
    ...overrides
  };

  render(<CameraListEditor {...props} />);
  return { ...props, onSaveList, onClose };
}

describe("CameraListEditor", () => {
  it("shows camera metadata fields without manual username and password columns", () => {
    renderEditor();

    const columnHeaders = screen.getAllByRole("columnheader").map((header) => header.textContent);
    expect(columnHeaders).toEqual([
      "Move",
      "Delete",
      expect.stringContaining("Follow Prefix"),
      "Index",
      "Camera #",
      "Full URL",
      "Type",
      "Lens",
      "Display Note",
      "Viewport",
      "Zoom"
    ]);
    expect(screen.getByRole("columnheader", { name: /Follow Prefix/ })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Type" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Lens" })).toBeInTheDocument();
    expect(screen.getByRole("columnheader", { name: "Display Note" })).toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Username" })).not.toBeInTheDocument();
    expect(screen.queryByRole("columnheader", { name: "Password" })).not.toBeInTheDocument();
  });

  it("keeps row controls above the camera table", () => {
    renderEditor();

    const addCameraButton = screen.getByRole("button", { name: "Add Camera Row" });
    const cameraTable = screen.getByRole("table");

    expect(addCameraButton.closest(".editor-list-toolbar")).toBeInTheDocument();
    expect(
      addCameraButton.compareDocumentPosition(cameraTable) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("places workspace settings after the editable camera table", () => {
    renderEditor();

    const table = screen.getByRole("table");
    const settings = screen.getByLabelText("Camera workspace settings");

    expect(
      table.compareDocumentPosition(settings) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
  });

  it("keeps session actions out of camera-list settings", () => {
    renderEditor();

    expect(screen.queryByRole("button", { name: /Sign Out/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reload Every Camera/i })).not.toBeInTheDocument();
  });

  it("keeps list edits local until Save Changes is clicked", () => {
    const { onSaveList } = renderEditor();

    fireEvent.change(screen.getByLabelText("List Prefix"), {
      target: { value: "http://10.10.20." }
    });
    fireEvent.change(screen.getByLabelText("A camera number"), {
      target: { value: "4" }
    });

    expect(onSaveList).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(onSaveList).toHaveBeenCalledTimes(1);
    expect(onSaveList).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPrefix: "http://10.10.20.",
        cameras: expect.arrayContaining([
          expect.objectContaining({
            id: "camera-41",
            name: "D",
            suffix: "04"
          })
        ])
      })
    );
  });

  it("confirms before discarding unsaved camera-list changes", () => {
    const { onClose } = renderEditor();

    fireEvent.change(screen.getByLabelText("List Prefix"), {
      target: { value: "http://10.20.30." }
    });
    fireEvent.click(screen.getByRole("button", { name: "Discard" }));

    expect(
      screen.getByRole("dialog", { name: "Discard camera-list changes?" })
    ).toBeVisible();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("requires a decision before switching away from a dirty list", () => {
    const onSelectCameraList = vi.fn();
    const secondaryList: CameraList = {
      ...sampleWorkspace.cameraLists[0],
      id: "list-secondary",
      name: "Secondary Cameras"
    };
    renderEditor({
      workspaceSettings: createWorkspaceSettings({
        cameraLists: [...sampleWorkspace.cameraLists, secondaryList],
        onSelectCameraList
      })
    });

    fireEvent.change(screen.getByLabelText("List Prefix"), {
      target: { value: "http://10.20.30." }
    });
    fireEvent.change(screen.getByLabelText("Job and camera list"), {
      target: { value: "list-secondary" }
    });

    expect(screen.getByRole("dialog", { name: "Save camera-list changes?" })).toBeVisible();
    expect(onSelectCameraList).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onSelectCameraList).not.toHaveBeenCalled();
  });

  it("saves or discards a dirty draft before switching lists", () => {
    const onSaveList = vi.fn<(list: CameraList) => void>();
    const onSelectCameraList = vi.fn();
    const secondaryList: CameraList = {
      ...sampleWorkspace.cameraLists[0],
      id: "list-secondary",
      name: "Secondary Cameras"
    };
    const workspaceSettings = createWorkspaceSettings({
      cameraLists: [...sampleWorkspace.cameraLists, secondaryList],
      onSelectCameraList
    });
    const { unmount } = render(
      <CameraListEditor
        activeList={sampleWorkspace.cameraLists[0]}
        workspaceSettings={workspaceSettings}
        onSaveList={onSaveList}
        onClose={vi.fn()}
      />
    );

    fireEvent.change(screen.getByLabelText("List Prefix"), {
      target: { value: "http://10.20.30." }
    });
    fireEvent.change(screen.getByLabelText("Job and camera list"), {
      target: { value: "list-secondary" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Save and Switch" }));

    expect(onSaveList).toHaveBeenCalledWith(
      expect.objectContaining({ defaultPrefix: "http://10.20.30." })
    );
    expect(onSelectCameraList).toHaveBeenCalledWith("list-secondary");

    unmount();
    onSaveList.mockClear();
    onSelectCameraList.mockClear();

    render(
      <CameraListEditor
        activeList={sampleWorkspace.cameraLists[0]}
        workspaceSettings={workspaceSettings}
        onSaveList={onSaveList}
        onClose={vi.fn()}
      />
    );
    fireEvent.change(screen.getByLabelText("List Prefix"), {
      target: { value: "http://10.20.40." }
    });
    fireEvent.change(screen.getByLabelText("Job and camera list"), {
      target: { value: "list-secondary" }
    });
    fireEvent.click(screen.getByRole("button", { name: "Discard and Switch" }));

    expect(onSaveList).not.toHaveBeenCalled();
    expect(onSelectCameraList).toHaveBeenCalledWith("list-secondary");
  });

  it("updates one follow-prefix row when a row checkbox is clicked", () => {
    const { onSaveList } = renderEditor();

    fireEvent.click(screen.getByLabelText("A follow prefix"));
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(onSaveList).toHaveBeenCalledWith(
      expect.objectContaining({
        cameras: expect.arrayContaining([
          expect.objectContaining({ id: "camera-41", usesListPrefix: false })
        ])
      })
    );
  });

  it("updates a follow-prefix range when shift-clicking row checkboxes", () => {
    const { onSaveList } = renderEditor();

    fireEvent.click(screen.getByLabelText("A follow prefix"));
    fireEvent.click(screen.getByLabelText("C follow prefix"), { shiftKey: true });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    const saved = onSaveList.mock.calls[0][0];
    expect(saved.cameras.slice(0, 3).map((camera) => camera.usesListPrefix)).toEqual([
      false,
      false,
      false
    ]);
  });

  it("updates all follow-prefix rows from the header checkbox", () => {
    const { onSaveList } = renderEditor();

    fireEvent.click(screen.getByLabelText("All follow prefix"));
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    const saved = onSaveList.mock.calls[0][0];
    expect(saved.cameras.every((camera) => camera.usesListPrefix === false)).toBe(true);
  });

  it("deletes a camera row from the draft list editor", () => {
    const { onSaveList } = renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Delete A" }));

    expect(screen.queryByLabelText("A index")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(onSaveList.mock.calls[0][0].cameras.map((camera) => camera.id)).not.toContain(
      "camera-41"
    );
  });

  it("adds a sequential camera row in the draft list", () => {
    const { onSaveList } = renderEditor();

    fireEvent.click(screen.getByRole("button", { name: "Add Camera Row" }));

    expect(screen.getByLabelText("M index")).toHaveValue("M");
    expect(screen.getByLabelText("M camera number")).toHaveValue("13");

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(onSaveList.mock.calls[0][0].cameras.at(-1)).toMatchObject({
      name: "M",
      suffix: "13",
      url: "http://192.168.1.13"
    });
  });

  it("shows an editable camera count that resizes the draft list", () => {
    const { onSaveList } = renderEditor();
    const cameraCount = screen.getByLabelText("Camera count");

    expect(cameraCount).toHaveValue(12);

    fireEvent.change(cameraCount, { target: { value: "15" } });

    expect(screen.getByLabelText("O index")).toHaveValue("O");
    expect(screen.getByLabelText("O camera number")).toHaveValue("15");

    fireEvent.change(cameraCount, { target: { value: "10" } });

    expect(screen.queryByLabelText("K index")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(onSaveList.mock.calls[0][0].cameras).toHaveLength(10);
    expect(onSaveList.mock.calls[0][0].cameras.at(-1)).toMatchObject({
      name: "J",
      suffix: "10"
    });
  });

  it("selects cell ranges, rows, and columns", () => {
    renderEditor();

    const aIndex = screen.getByLabelText("A index");
    const bNumber = screen.getByLabelText("B camera number");
    fireEvent.click(aIndex);
    fireEvent.click(bNumber, { shiftKey: true });

    expect(aIndex.closest("td")).toHaveAttribute("aria-selected", "true");
    expect(bNumber.closest("td")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("A type").closest("td")).toHaveAttribute(
      "aria-selected",
      "false"
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Select row 1; drag to move A" })
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Select row 3; drag to move C" }),
      { shiftKey: true }
    );
    expect(screen.getByLabelText("B lens").closest("td")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByLabelText("A zoom").closest("td")).toHaveAttribute(
      "aria-selected",
      "true"
    );

    fireEvent.click(screen.getByRole("button", { name: "Select Type column" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Select Display Note column" }),
      { shiftKey: true }
    );
    expect(screen.getByLabelText("A type").closest("td")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByLabelText("A lens").closest("td")).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByLabelText("L display note").closest("td")).toHaveAttribute(
      "aria-selected",
      "true"
    );
  });

  it("copies the selected range as TSV", () => {
    renderEditor();
    const aIndex = screen.getByLabelText("A index");
    const bNumber = screen.getByLabelText("B camera number");
    fireEvent.click(aIndex);
    fireEvent.click(bNumber, { shiftKey: true });
    const setData = vi.fn();

    fireEvent.copy(bNumber, {
      clipboardData: { setData, getData: vi.fn() }
    });

    expect(setData).toHaveBeenCalledWith("text/plain", "A\t01\nB\t02");
  });

  it("skips spreadsheet headers, starts at the first row, and preserves Follow Prefix", () => {
    const { onSaveList } = renderEditor();
    const lastIndex = screen.getByLabelText("L index");
    fireEvent.click(lastIndex);

    fireEvent.paste(lastIndex, {
      clipboardData: {
        getData: () =>
          "Index\tCamera #\tType\tLens\tFollow Prefix\nA\t01\tBURANO\t85mm\tFALSE\nB\t02\tFR7\t50mm\tFALSE"
      }
    });

    expect(onSaveList).not.toHaveBeenCalled();
    expect(screen.getByLabelText("A type")).toHaveValue("BURANO");
    expect(screen.getByLabelText("A lens")).toHaveValue("85mm");
    expect(screen.getByLabelText("A follow prefix")).toBeChecked();
    expect(screen.getByLabelText("B type")).toHaveValue("FR7");
    expect(screen.getByRole("status")).toHaveTextContent("Pasted 8 cells");
    expect(screen.getByRole("status")).not.toHaveTextContent("added");

    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));

    expect(onSaveList.mock.calls[0][0].cameras).toHaveLength(12);
    expect(onSaveList.mock.calls[0][0].cameras[0]).toMatchObject({
      cameraType: "BURANO",
      lens: "85mm",
      usesListPrefix: true
    });
  });

  it("discards pasted draft rows without saving them", () => {
    const { onSaveList, onClose } = renderEditor();
    const lastIndex = screen.getByLabelText("L index");
    fireEvent.click(lastIndex);
    fireEvent.paste(lastIndex, {
      clipboardData: {
        getData: () => "L\t12\nM\t13"
      }
    });

    expect(screen.getByLabelText("M camera number")).toHaveValue("13");

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
      clipboardData: { getData: () => "640x480" }
    });

    expect(aViewport).toHaveValue("640x480");
    expect(screen.getByRole("option", { name: "640x480" })).toBeInTheDocument();
  });

  it("copies the complete draft with headers from Copy Table", async () => {
    const writeText = vi.fn(async (_text: string) => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    const { onSaveList } = renderEditor();
    const aIndex = screen.getByLabelText("A index");
    fireEvent.click(aIndex);
    fireEvent.change(screen.getByLabelText("A type"), {
      target: { value: "VENICE 2" }
    });

    fireEvent.click(screen.getByRole("button", { name: "Copy Table" }));

    await waitFor(() => expect(writeText).toHaveBeenCalledOnce());
    expect(writeText.mock.calls[0][0]).toMatch(
      /^Index\tCamera #\tFull URL\tType\tLens\tDisplay Note\tViewport\tZoom\nA\t01\t/
    );
    expect(writeText.mock.calls[0][0]).not.toContain("Follow Prefix");
    expect(writeText.mock.calls[0][0]).toContain("\tVENICE 2\t");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Copied 12 camera rows with headers"
    );
    expect(aIndex.closest("td")).toHaveAttribute("aria-selected", "true");
    expect(onSaveList).not.toHaveBeenCalled();
  });

  it("reports Copy Table clipboard failures without changing the draft", async () => {
    const writeText = vi.fn(async (_text: string) => {
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

  it("removes the former CSV importer", () => {
    renderEditor();

    expect(screen.queryByLabelText("CSV import")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Import Valid Rows" })
    ).not.toBeInTheDocument();
  });

  it("moves focus down to the same column when pressing Enter in the list table", () => {
    renderEditor();

    const firstType = screen.getByLabelText("A type");
    const secondType = screen.getByLabelText("B type");
    fireEvent.change(secondType, { target: { value: "FR7" } });
    firstType.focus();

    act(() => {
      fireEvent.keyDown(firstType, { key: "Enter" });
    });

    expect(secondType).toHaveFocus();
    expect(secondType).toHaveProperty("selectionStart", 0);
    expect(secondType).toHaveProperty("selectionEnd", 3);
  });

  it("moves focus down when the keyboard reports keypad Enter or Return", () => {
    renderEditor();

    const firstLens = screen.getByLabelText("A lens");
    const secondLens = screen.getByLabelText("B lens");
    firstLens.focus();

    act(() => {
      fireEvent.keyDown(firstLens, { key: "NumpadEnter", code: "NumpadEnter" });
    });

    expect(secondLens).toHaveFocus();

    const secondDisplayNote = screen.getByLabelText("B display note");
    const thirdDisplayNote = screen.getByLabelText("C display note");
    secondDisplayNote.focus();

    act(() => {
      fireEvent.keyDown(secondDisplayNote, { key: "Return", code: "Enter" });
    });

    expect(thirdDisplayNote).toHaveFocus();
  });

  it("moves focus to the next column when pressing Tab in the list table", () => {
    renderEditor();

    const index = screen.getByLabelText("A index");
    const cameraNumber = screen.getByLabelText("A camera number");
    index.focus();

    act(() => {
      fireEvent.keyDown(index, { key: "Tab" });
    });

    expect(cameraNumber).toHaveFocus();
    expect(cameraNumber).toHaveProperty("selectionStart", 0);
    expect(cameraNumber).toHaveProperty("selectionEnd", 2);
  });

  it("moves backward with Shift+Enter and Shift+Tab", () => {
    renderEditor();

    const secondLens = screen.getByLabelText("B lens");
    secondLens.focus();
    fireEvent.keyDown(secondLens, { key: "Enter", shiftKey: true });
    expect(screen.getByLabelText("A lens")).toHaveFocus();

    const bFollowPrefix = screen.getByLabelText("B follow prefix");
    bFollowPrefix.focus();
    fireEvent.keyDown(bFollowPrefix, { key: "Tab", shiftKey: true });
    expect(screen.getByLabelText("A zoom")).toHaveFocus();
  });

  it("keeps the focused cell inside its camera row for row highlight styling", () => {
    renderEditor();

    const firstType = screen.getByLabelText("A type");
    firstType.focus();

    expect(firstType.closest("tr")).toContainElement(firstType);
    expect(firstType).toHaveFocus();
  });
});
