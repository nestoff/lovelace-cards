import { describe, expect, it, vi } from "vitest";
import type { TileState } from "../shared/types";
import {
  resetCameraList,
  resetSelectedCamera,
  type SessionResetDependencies
} from "./sessionReset";

function tile(id: string, url: string): TileState {
  return {
    id,
    cameraId: id.replace("tile", "camera"),
    url,
    title: id,
    partition: "persist:list",
    viewport: { width: 1024, height: 768 },
    zoom: 1
  };
}

const selectedTile = tile("tile-41", "http://10.20.100.108/rmt.html");

function createDependencies(
  overrides: Partial<SessionResetDependencies> = {}
): SessionResetDependencies {
  return {
    clearRuntime: vi.fn(async () => true),
    resetCameraData: vi.fn(async () => undefined),
    resetListData: vi.fn(async () => undefined),
    loadBase: vi.fn(async () => true),
    markManualAuth: vi.fn(),
    clearManualAuth: vi.fn(),
    isCurrent: vi.fn(() => true),
    wait: vi.fn(async () => undefined),
    ...overrides
  };
}

describe("resetSelectedCamera", () => {
  it("clears runtime and persistent state before loading one base URL", async () => {
    const calls: string[] = [];
    const result = await resetSelectedCamera(
      {
        tile: selectedTile,
        operationKey: "job:list",
        onSessionCleared: () => calls.push("forget")
      },
      createDependencies({
        clearRuntime: async () => {
          calls.push("runtime");
          return true;
        },
        resetCameraData: async () => {
          calls.push("electron");
        },
        loadBase: async () => {
          calls.push("load");
          return true;
        },
        markManualAuth: (ids) => calls.push(`mark:${ids.join(",")}`),
        clearManualAuth: () => calls.push("unmark")
      })
    );

    expect(calls).toEqual(["mark:tile-41", "runtime", "electron", "forget", "load"]);
    expect(result).toMatchObject({ tone: "success", reloaded: 1, skipped: 0 });
  });

  it("does not navigate after cleanup failure and removes the auth marker", async () => {
    const loadBase = vi.fn(async () => true);
    const clearManualAuth = vi.fn();
    const onSessionCleared = vi.fn();
    const dependencies = createDependencies({
      resetCameraData: async () => {
        throw new Error("clear failed");
      },
      clearManualAuth,
      loadBase
    });

    await expect(
      resetSelectedCamera(
        { tile: selectedTile, operationKey: "job:list", onSessionCleared },
        dependencies
      )
    ).rejects.toThrow("clear failed");
    expect(onSessionCleared).not.toHaveBeenCalled();
    expect(loadBase).not.toHaveBeenCalled();
    expect(clearManualAuth).toHaveBeenCalledWith(["tile-41"]);
  });

  it("skips invalid browser URLs without touching the session", async () => {
    const dependencies = createDependencies();
    const onSessionCleared = vi.fn();

    const result = await resetSelectedCamera(
      {
        tile: tile("tile-blank", "about:blank"),
        operationKey: "job:list",
        onSessionCleared
      },
      dependencies
    );

    expect(result).toMatchObject({ tone: "partial", reloaded: 0, skipped: 1 });
    expect(dependencies.resetCameraData).not.toHaveBeenCalled();
    expect(onSessionCleared).not.toHaveBeenCalled();
  });

  it("forgets the credential after cleanup even when the base page does not reload", async () => {
    const calls: string[] = [];

    const result = await resetSelectedCamera(
      {
        tile: selectedTile,
        operationKey: "job:list",
        onSessionCleared: () => calls.push("forget")
      },
      createDependencies({
        resetCameraData: async () => {
          calls.push("electron");
        },
        loadBase: async () => {
          calls.push("load");
          return false;
        }
      })
    );

    expect(calls).toEqual(["electron", "forget", "load"]);
    expect(result).toMatchObject({ tone: "partial", reloaded: 0, failed: ["tile-41"] });
  });
});

describe("resetCameraList", () => {
  it("reloads valid list tiles in row order and reports skipped URLs", async () => {
    const loaded: string[] = [];
    const dependencies = createDependencies({
      loadBase: async (id) => {
        loaded.push(id);
        return true;
      }
    });

    const result = await resetCameraList(
      {
        tiles: [
          tile("tile-a", "http://10.20.100.101/rmt.html"),
          tile("tile-blank", "about:blank"),
          tile("tile-b", "http://10.20.100.102/index.html")
        ],
        partition: "persist:list",
        operationKey: "job:list",
        onSessionCleared: vi.fn()
      },
      dependencies
    );

    expect(loaded).toEqual(["tile-a", "tile-b"]);
    expect(dependencies.wait).toHaveBeenNthCalledWith(1, 0);
    expect(dependencies.wait).toHaveBeenNthCalledWith(2, 150);
    expect(result).toMatchObject({ tone: "partial", reloaded: 2, skipped: 1 });
  });

  it("does not start later reloads after the workspace becomes stale", async () => {
    const loadBase = vi.fn(async () => true);
    const clearManualAuth = vi.fn();
    const isCurrent = vi.fn().mockReturnValueOnce(true).mockReturnValue(false);

    const result = await resetCameraList(
      {
        tiles: [
          tile("tile-a", "http://10.20.100.101/rmt.html"),
          tile("tile-b", "http://10.20.100.102/index.html")
        ],
        partition: "persist:list",
        operationKey: "job:list",
        onSessionCleared: vi.fn()
      },
      createDependencies({ loadBase, clearManualAuth, isCurrent })
    );

    expect(loadBase).not.toHaveBeenCalled();
    expect(clearManualAuth).toHaveBeenCalledWith(["tile-a", "tile-b"]);
    expect(result).toMatchObject({ tone: "partial", reloaded: 0, skipped: 2 });
  });

  it("reports runtime and navigation failures without blocking healthy cameras", async () => {
    const clearManualAuth = vi.fn();
    const loadBase = vi.fn(async (tileId: string) => tileId !== "tile-c");
    const dependencies = createDependencies({
      clearRuntime: vi.fn(async (tileId: string) => tileId !== "tile-b"),
      clearManualAuth,
      loadBase
    });

    const result = await resetCameraList(
      {
        tiles: [
          tile("tile-a", "http://10.20.100.101/"),
          tile("tile-b", "http://10.20.100.102/"),
          tile("tile-c", "http://10.20.100.103/")
        ],
        partition: "persist:list",
        operationKey: "job:list",
        onSessionCleared: vi.fn()
      },
      dependencies
    );

    expect(loadBase).toHaveBeenCalledWith("tile-a", "http://10.20.100.101/");
    expect(loadBase).not.toHaveBeenCalledWith("tile-b", expect.anything());
    expect(result).toMatchObject({ tone: "partial", reloaded: 1, skipped: 1 });
    expect(result.failed).toEqual(["tile-b", "tile-c"]);
    expect(clearManualAuth).toHaveBeenCalledWith(["tile-b"]);
    expect(clearManualAuth).toHaveBeenCalledWith(["tile-c"]);
  });

  it("starts later cameras without waiting for an earlier page to finish loading", async () => {
    let finishFirstLoad: ((loaded: boolean) => void) | undefined;
    const firstLoad = new Promise<boolean>((resolve) => {
      finishFirstLoad = resolve;
    });
    const loadBase = vi.fn((tileId: string) =>
      tileId === "tile-a" ? firstLoad : Promise.resolve(true)
    );

    const reset = resetCameraList(
      {
        tiles: [
          tile("tile-a", "http://10.20.100.101/"),
          tile("tile-b", "http://10.20.100.102/")
        ],
        partition: "persist:list",
        operationKey: "job:list",
        onSessionCleared: vi.fn()
      },
      createDependencies({ loadBase })
    );

    await vi.waitFor(() => {
      expect(loadBase).toHaveBeenCalledWith("tile-b", "http://10.20.100.102/");
    });
    finishFirstLoad?.(true);
    await expect(reset).resolves.toMatchObject({ tone: "success", reloaded: 2 });
  });

  it("forgets the active-list credentials after partition cleanup and before reload", async () => {
    const calls: string[] = [];

    const result = await resetCameraList(
      {
        tiles: [
          tile("tile-a", "http://10.20.100.101/rmt.html"),
          tile("tile-b", "http://10.20.100.102/index.html")
        ],
        partition: "persist:list",
        operationKey: "job:list",
        onSessionCleared: () => calls.push("forget")
      },
      createDependencies({
        clearRuntime: async (tileId) => {
          calls.push(`runtime:${tileId}`);
          return true;
        },
        resetListData: async () => {
          calls.push("electron");
        },
        loadBase: async (tileId) => {
          calls.push(`load:${tileId}`);
          return true;
        },
        markManualAuth: (ids) => calls.push(`mark:${ids.join(",")}`)
      })
    );

    expect(calls).toEqual([
      "mark:tile-a,tile-b",
      "runtime:tile-a",
      "runtime:tile-b",
      "electron",
      "forget",
      "load:tile-a",
      "load:tile-b"
    ]);
    expect(result).toMatchObject({ tone: "success", reloaded: 2 });
  });

  it("does not forget list credentials or reload after partition cleanup fails", async () => {
    const onSessionCleared = vi.fn();
    const loadBase = vi.fn(async () => true);

    await expect(
      resetCameraList(
        {
          tiles: [tile("tile-a", "http://10.20.100.101/rmt.html")],
          partition: "persist:list",
          operationKey: "job:list",
          onSessionCleared
        },
        createDependencies({
          resetListData: async () => {
            throw new Error("partition clear failed");
          },
          loadBase
        })
      )
    ).rejects.toThrow("partition clear failed");

    expect(onSessionCleared).not.toHaveBeenCalled();
    expect(loadBase).not.toHaveBeenCalled();
  });

  it("keeps list credentials forgotten when a camera fails to reload", async () => {
    const calls: string[] = [];

    const result = await resetCameraList(
      {
        tiles: [tile("tile-a", "http://10.20.100.101/rmt.html")],
        partition: "persist:list",
        operationKey: "job:list",
        onSessionCleared: () => calls.push("forget")
      },
      createDependencies({
        resetListData: async () => {
          calls.push("electron");
        },
        loadBase: async () => {
          calls.push("load");
          return false;
        }
      })
    );

    expect(calls).toEqual(["electron", "forget", "load"]);
    expect(result).toMatchObject({ tone: "partial", reloaded: 0, failed: ["tile-a"] });
  });
});
