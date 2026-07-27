import { afterEach, describe, expect, it, vi } from "vitest";
import { DitBrowseConnection } from "../../companion-module-lightlab-ditbrowse/src/connection";
import type {
  ControlApiCommand,
  ControlApiResponse,
  ControlApiStatus
} from "../shared/controlApi";
import { startControlApiServer, type ControlApiServer } from "./controlApiServer";

const servers: ControlApiServer[] = [];
const connections: DitBrowseConnection[] = [];

function status(overrides: Partial<ControlApiStatus> = {}): ControlApiStatus {
  return {
    expansionEnabled: true,
    focusMode: false,
    selectedCameraNumber: 1,
    selectedTileId: "tile-41",
    selectedIndex: 1,
    tabs: [
      {
        index: 1,
        tileId: "tile-41",
        cameraId: "camera-41",
        cameraNumber: 1,
        title: "A",
        url: "http://camera-1"
      },
      {
        index: 2,
        tileId: "tile-42",
        cameraId: "camera-42",
        cameraNumber: 2,
        title: "B",
        url: "http://camera-2"
      }
    ],
    ...overrides
  };
}

async function waitFor(check: () => boolean, timeoutMs = 1000): Promise<void> {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error("Timed out waiting for Companion integration state");
    }
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

afterEach(async () => {
  await Promise.all(connections.splice(0).map((connection) => connection.stop()));
  await Promise.all(servers.splice(0).map((server) => server.close()));
});

describe("DIT Browse Companion integration", () => {
  it("runs integer focus, expansion toggle, and live status through the real server", async () => {
    let currentStatus = status();
    const dispatch = vi.fn(async (command: ControlApiCommand): Promise<ControlApiResponse> => {
      if (command.type === "focusCamera" && currentStatus.expansionEnabled) {
        currentStatus = status({
          focusMode: true,
          selectedCameraNumber: command.cameraNumber,
          selectedTileId: `tile-${40 + command.cameraNumber}`,
          selectedIndex: command.cameraNumber
        });
      } else if (command.type === "showGrid") {
        currentStatus = { ...currentStatus, focusMode: false };
      } else if (command.type === "toggleExpansion") {
        currentStatus = {
          ...currentStatus,
          expansionEnabled: !currentStatus.expansionEnabled,
          focusMode: false
        };
      }
      return { ok: true, status: currentStatus };
    });
    const server = await startControlApiServer({ dispatch, port: null });
    servers.push(server);

    const onStatus = vi.fn();
    const connection = new DitBrowseConnection(
      {
        onPhase: vi.fn(),
        onStatus,
        onError: vi.fn(),
        debug: vi.fn()
      },
      { version: "0.1.0", reconnectDelaysMs: [10] }
    );
    connections.push(connection);
    connection.start(server.port);
    await waitFor(() => connection.currentState.status !== null);

    await connection.sendCommand({ type: "focusCamera", cameraNumber: 2 });
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: "focusCamera", cameraNumber: 2 })
    );
    expect(connection.currentState.status).toMatchObject({
      focusMode: true,
      selectedCameraNumber: 2
    });

    await connection.sendCommand({ type: "toggleExpansion" });
    expect(connection.currentState.status).toMatchObject({
      expansionEnabled: false,
      focusMode: false
    });

    server.publishStatus(status({ selectedCameraNumber: 1 }), 12);
    await waitFor(() => connection.currentState.revision === 12);
    expect(onStatus).toHaveBeenLastCalledWith(
      expect.objectContaining({ selectedCameraNumber: 1 }),
      false
    );
  });
});
