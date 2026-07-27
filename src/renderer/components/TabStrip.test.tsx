import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { sampleWorkspace } from "../../shared/sampleData";
import { TabStrip } from "./TabStrip";

const baseProps = {
  tiles: sampleWorkspace.tiles.slice(0, 2),
  selectedTileId: sampleWorkspace.tiles[0].id,
  onSelectTile: vi.fn(),
  onAddTile: vi.fn(),
  onCloseTile: vi.fn(),
  onMoveTileToIndex: vi.fn()
};

describe("TabStrip", () => {
  it("selects and closes a transient auxiliary tab independently", () => {
    const onSelect = vi.fn();
    const onClose = vi.fn();
    render(
      <TabStrip
        {...baseProps}
        auxiliaryTab={{
          id: "help",
          title: "Help",
          active: true,
          onSelect,
          onClose
        }}
      />
    );

    expect(screen.getByLabelText("Tab Help")).toHaveClass("active");
    expect(screen.getByLabelText("Tab A")).not.toHaveClass("active");

    fireEvent.click(screen.getByRole("button", { name: "Select Help" }));
    expect(onSelect).toHaveBeenCalledOnce();
    expect(baseProps.onSelectTile).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Close Help" }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(baseProps.onCloseTile).not.toHaveBeenCalled();
  });
});
