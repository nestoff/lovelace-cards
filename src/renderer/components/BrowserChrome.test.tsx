import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { sampleWorkspace } from "../../shared/sampleData";
import { BrowserChrome } from "./BrowserChrome";

const selectedTile =
  sampleWorkspace.tiles.find((tile) => tile.id === sampleWorkspace.selectedTileId) ?? null;
const activeList =
  sampleWorkspace.cameraLists.find((list) => list.id === sampleWorkspace.activeCameraListId) ??
  null;

const baseProps = {
  workspace: sampleWorkspace,
  selectedTile,
  activeList,
  onOpenCameraList: vi.fn(),
  helpSelected: false,
  onOpenHelp: vi.fn(),
  onCloseHelp: vi.fn(),
  onSelectTile: vi.fn(),
  onMoveTileToIndex: vi.fn(),
  onCloseTile: vi.fn(),
  onAddTile: vi.fn(),
  onNavigate: vi.fn(),
  onSaveSelectedUrl: vi.fn(),
  onReturnSelectedCameraToPrefix: vi.fn(),
  onBack: vi.fn(),
  onForward: vi.fn(),
  onReload: vi.fn(),
  onReloadAll: vi.fn(),
  sessionBusy: false,
  onSignOutSelected: vi.fn(),
  onRequestSignOutAll: vi.fn(),
  onColumnsChange: vi.fn(),
  onRelativeGlobalZoomChange: vi.fn(),
  onGlobalViewportChange: vi.fn(),
  onZoomChange: vi.fn(),
  onViewportChange: vi.fn(),
  expansionEnabled: true,
  focusMode: false,
  onFocusModeToggle: vi.fn()
};

describe("BrowserChrome", () => {
  it("opens Help as an active transient tab without the camera toolbar", () => {
    const onOpenHelp = vi.fn();
    const { rerender } = render(
      <BrowserChrome {...baseProps} onOpenHelp={onOpenHelp} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Help" }));
    expect(onOpenHelp).toHaveBeenCalledOnce();

    rerender(<BrowserChrome {...baseProps} helpSelected onOpenHelp={onOpenHelp} />);
    expect(screen.getByLabelText("Tab Help")).toHaveClass("active");
    expect(screen.queryByLabelText("Browser toolbar")).not.toBeInTheDocument();
  });

  it("renders browser tabs before the toolbar with one shared address field", () => {
    render(<BrowserChrome {...baseProps} />);

    const tabs = screen.getByLabelText("Camera tabs");
    const toolbar = screen.getByLabelText("Browser toolbar");

    expect(tabs.compareDocumentPosition(toolbar)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(screen.getAllByLabelText("Address")).toHaveLength(1);
  });

  it("uses descriptive shared tooltips for browser commands", () => {
    render(<BrowserChrome {...baseProps} />);

    const back = screen.getByRole("button", { name: "Back" });
    expect(back).not.toHaveAttribute("title");
    fireEvent.focus(back);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Back");
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Returns the selected camera to its previous page."
    );

    fireEvent.blur(back);
    const cameraList = screen.getByRole("button", { name: "Camera List" });
    expect(cameraList).not.toHaveAttribute("title");
    fireEvent.focus(cameraList);
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Opens the editable camera table and workspace settings."
    );
  });

  it("opens the full camera list workspace directly", () => {
    const onOpenCameraList = vi.fn();
    render(<BrowserChrome {...baseProps} onOpenCameraList={onOpenCameraList} />);

    fireEvent.click(screen.getByRole("button", { name: "Camera List" }));

    expect(onOpenCameraList).toHaveBeenCalledOnce();
    expect(screen.queryByLabelText("Camera workspace tools")).not.toBeInTheDocument();
  });

  it("uses drag reorder without directional tab buttons", () => {
    render(<BrowserChrome {...baseProps} />);

    expect(screen.queryByRole("button", { name: /Move .* left/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Move .* right/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Close A" })).toBeVisible();
  });

  it("opens relative all-tiles zoom controls", () => {
    const onRelativeGlobalZoomChange = vi.fn();
    const onZoomChange = vi.fn();
    render(
      <BrowserChrome
        {...baseProps}
        onRelativeGlobalZoomChange={onRelativeGlobalZoomChange}
        onZoomChange={onZoomChange}
        workspace={{ ...sampleWorkspace, globalZoom: 1.08 }}
      />
    );

    fireEvent.change(screen.getByLabelText("Selected tile zoom"), { target: { value: "0.82" } });

    expect(onZoomChange).toHaveBeenCalledWith(0.82);

    const selectedZoomPercent = screen.getByLabelText("Selected zoom percent");
    expect(selectedZoomPercent).toHaveValue(100);

    fireEvent.change(selectedZoomPercent, { target: { value: "137" } });
    fireEvent.keyDown(selectedZoomPercent, { key: "Enter" });

    expect(onZoomChange).toHaveBeenCalledWith(1.37);

    expect(screen.queryByLabelText("Global zoom controls panel")).not.toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Global zoom controls"));
    expect(screen.getByLabelText("Global zoom controls panel")).toBeVisible();

    fireEvent.change(screen.getByLabelText("All tiles relative zoom"), {
      target: { value: "1.2" }
    });
    expect(onRelativeGlobalZoomChange).toHaveBeenCalledWith(1.2);

    const relativeZoomPercent = screen.getByLabelText("All tiles relative zoom percent");
    expect(relativeZoomPercent).toHaveValue(108);

    fireEvent.change(relativeZoomPercent, { target: { value: "142" } });
    fireEvent.blur(relativeZoomPercent);

    expect(onRelativeGlobalZoomChange).toHaveBeenCalledWith(1.42);
  });

  it("toggles selected-page focus mode from the toolbar", () => {
    const onFocusModeToggle = vi.fn();
    const { rerender } = render(
      <BrowserChrome {...baseProps} onFocusModeToggle={onFocusModeToggle} />
    );

    fireEvent.click(screen.getByLabelText("Focus selected page"));

    expect(onFocusModeToggle).toHaveBeenCalledOnce();

    rerender(
      <BrowserChrome
        {...baseProps}
        focusMode
        onFocusModeToggle={onFocusModeToggle}
      />
    );

    expect(screen.getByLabelText("Show all pages")).toBeVisible();
  });

  it("disables selected-page focus while expansion mode is off", () => {
    render(<BrowserChrome {...baseProps} expansionEnabled={false} />);

    const focusButton = screen.getByLabelText("Focus selected page");
    expect(focusButton).toBeDisabled();

    fireEvent.focus(focusButton);
    expect(screen.getByRole("tooltip")).toHaveTextContent("Expansion locked");
    expect(screen.getByRole("tooltip")).toHaveTextContent(
      "Companion expansion mode is off, so the camera grid stays visible."
    );
  });

  it("resets selected zoom when the percent marker is double-clicked", () => {
    const onZoomChange = vi.fn();
    render(
      <BrowserChrome
        {...baseProps}
        onZoomChange={onZoomChange}
      />
    );

    fireEvent.doubleClick(screen.getByLabelText("Reset selected zoom to 100 percent"));

    expect(onZoomChange).toHaveBeenCalledWith(1);
  });

  it("shows one selected-camera resolution control with formatted resolution and ratio labels", () => {
    const onViewportChange = vi.fn();
    render(
      <BrowserChrome
        {...baseProps}
        onViewportChange={onViewportChange}
      />
    );

    const resolution = screen.getByRole("combobox", {
      name: "Selected camera resolution"
    });
    expect(resolution).toBeVisible();
    expect(resolution).toHaveDisplayValue("1024×768 · 4:3");
    expect(screen.getAllByRole("combobox", { name: /resolution/i })).toHaveLength(1);
    expect(
      screen.getByRole("option", { name: "1024×768 · 4:3" })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("option", { name: "1920×1080 · 16:9" })
    ).toBeInTheDocument();
    expect(screen.queryByLabelText("Default aspect ratio")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("All viewport controls")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Apply resolution to all cameras" })
    ).toBeVisible();

    fireEvent.change(resolution, {
      target: { value: "1280x720" }
    });

    expect(onViewportChange).toHaveBeenCalledWith({ width: 1280, height: 720 });
  });

  it("applies the selected camera resolution to every camera", () => {
    const onGlobalViewportChange = vi.fn();
    const selectedViewport = { width: 1280, height: 720 };
    render(
      <BrowserChrome
        {...baseProps}
        selectedTile={selectedTile ? { ...selectedTile, viewport: selectedViewport } : null}
        onGlobalViewportChange={onGlobalViewportChange}
      />
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Apply resolution to all cameras" })
    );

    expect(onGlobalViewportChange).toHaveBeenCalledOnce();
    expect(onGlobalViewportChange).toHaveBeenCalledWith(selectedViewport);
  });

  it("removes the redundant selected-camera title strip", () => {
    const { container } = render(<BrowserChrome {...baseProps} />);

    expect(container.querySelector(".selected-tile-status")).not.toBeInTheDocument();
  });

  it("disables selected-camera resolution controls when no tile is selected", () => {
    render(
      <BrowserChrome
        {...baseProps}
        workspace={{ ...sampleWorkspace, selectedTileId: null }}
        selectedTile={null}
      />
    );

    expect(
      screen.getByRole("combobox", { name: "Selected camera resolution" })
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Apply resolution to all cameras" })
    ).toBeDisabled();
  });

  it("drags tabs to reorder them", () => {
    const onMoveTileToIndex = vi.fn();
    render(<BrowserChrome {...baseProps} onMoveTileToIndex={onMoveTileToIndex} />);

    const firstTab = screen.getByLabelText("Tab A");
    const thirdTab = screen.getByLabelText("Tab C");
    const dataTransfer = {
      effectAllowed: "move",
      setData: vi.fn(),
      getData: vi.fn(() => "tile-43")
    };

    fireEvent.dragStart(thirdTab, { dataTransfer });
    fireEvent.drop(firstTab, { dataTransfer });

    expect(onMoveTileToIndex).toHaveBeenCalledWith("tile-43", 0);
  });

  it("shows close controls on tabs", () => {
    const onCloseTile = vi.fn();
    render(<BrowserChrome {...baseProps} onCloseTile={onCloseTile} />);

    fireEvent.click(screen.getByLabelText("Close A"));

    expect(onCloseTile).toHaveBeenCalledWith("tile-41");
  });

  it("offers to return a manually overridden selected camera to prefix and suffix style", () => {
    const onReturnSelectedCameraToPrefix = vi.fn();
    const manualWorkspace = {
      ...sampleWorkspace,
      cameraLists: sampleWorkspace.cameraLists.map((list) =>
        list.id === "list-sample"
          ? {
              ...list,
              cameras: list.cameras.map((camera) =>
                camera.id === "camera-41"
                  ? {
                      ...camera,
                      url: "http://camera-control.local",
                      usesListPrefix: false
                    }
                  : camera
              )
            }
          : list
      ),
      tiles: sampleWorkspace.tiles.map((tile) =>
        tile.id === "tile-41" ? { ...tile, url: "http://camera-control.local" } : tile
      )
    };

    render(
      <BrowserChrome
        {...baseProps}
        workspace={manualWorkspace}
        selectedTile={manualWorkspace.tiles[0]}
        activeList={manualWorkspace.cameraLists[0]}
        onReturnSelectedCameraToPrefix={onReturnSelectedCameraToPrefix}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Go back to prefix and suffix style" }));

    expect(onReturnSelectedCameraToPrefix).toHaveBeenCalledOnce();
  });

  it("hides the prefix restore button while the selected camera is already prefix-based", () => {
    render(<BrowserChrome {...baseProps} />);

    expect(
      screen.queryByRole("button", { name: "Go back to prefix and suffix style" })
    ).not.toBeInTheDocument();
  });

  it("saves the selected live tile URL to the camera list on request", () => {
    const onSaveSelectedUrl = vi.fn();
    const liveWorkspace = {
      ...sampleWorkspace,
      tiles: sampleWorkspace.tiles.map((tile) =>
        tile.id === "tile-41" ? { ...tile, url: "http://10.20.100.107/index.html" } : tile
      )
    };

    render(
      <BrowserChrome
        {...baseProps}
        workspace={liveWorkspace}
        selectedTile={liveWorkspace.tiles[0]}
        onSaveSelectedUrl={onSaveSelectedUrl}
      />
    );

    fireEvent.click(screen.getByRole("button", { name: "Save current URL to camera list" }));

    expect(onSaveSelectedUrl).toHaveBeenCalledOnce();
  });

  it("disables saving the selected URL when it already matches the camera list", () => {
    render(<BrowserChrome {...baseProps} />);

    expect(screen.getByRole("button", { name: "Save current URL to camera list" })).toBeDisabled();
  });
});
