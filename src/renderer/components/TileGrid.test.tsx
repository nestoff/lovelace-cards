import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { sampleWorkspace } from "../../shared/sampleData";
import { TileGrid } from "./TileGrid";

class ResizeObserverStub {
  observe = vi.fn();
  disconnect = vi.fn();
}

vi.stubGlobal("ResizeObserver", ResizeObserverStub);

const baseProps = {
  tiles: sampleWorkspace.tiles.slice(0, 4),
  cameraNumbersById: new Map([["camera-41", 9]]),
  pingStatusesByHost: new Map([
    [
      "192.168.1.1",
      {
        state: "online" as const,
        host: "192.168.1.1",
        reachable: true,
        latencyMs: 2.5,
        checkedAt: 100
      }
    ],
    [
      "192.168.1.2",
      {
        state: "offline" as const,
        host: "192.168.1.2",
        reachable: false,
        latencyMs: null,
        checkedAt: 100,
        offlineSince: 100
      }
    ]
  ]),
  globalZoom: 1,
  pingIntervalSeconds: 5,
  columns: 2,
  selectedTileId: "tile-42",
  onSelectTile: vi.fn(),
  onUrlCommitted: vi.fn(),
  onCredentialCaptured: vi.fn(),
  credentialsByTileId: new Map(),
  webviewPreloadPath: null
};

describe("TileGrid", () => {
  it("matches camera numbers by camera id instead of tile position", () => {
    const reorderedTiles = [baseProps.tiles[1], baseProps.tiles[0]];
    const { getByText } = render(
      <TileGrid
        {...baseProps}
        tiles={reorderedTiles}
        cameraNumbersById={new Map([
          ["camera-41", 9],
          ["camera-42", 3]
        ])}
      />
    );

    expect(getByText("CAM 9")).toBeVisible();
    expect(getByText("CAM 3")).toBeVisible();
  });

  it("keeps every webview mounted while focusing the selected page", () => {
    const { container } = render(<TileGrid {...baseProps} focusMode />);

    expect(container.querySelectorAll("webview")).toHaveLength(4);
    expect(container.querySelector(".tile-grid")).toHaveClass("focus-mode");
    expect(container.querySelector('[data-tile-id="tile-42"]')?.closest(".tile-slot")).toHaveClass(
      "focused"
    );
    expect(container.querySelector('[data-tile-id="tile-41"]')?.closest(".tile-slot")).not.toHaveClass(
      "focused"
    );
  });

  it("matches ping status by base host after tiles are reordered", () => {
    const reorderedTiles = [baseProps.tiles[1], baseProps.tiles[0]];
    const { getByLabelText } = render(<TileGrid {...baseProps} tiles={reorderedTiles} />);

    expect(getByLabelText("Ping 192.168.1.2: offline")).toBeVisible();
    expect(getByLabelText("Ping 192.168.1.1: 2.5 milliseconds")).toBeVisible();
  });
});
