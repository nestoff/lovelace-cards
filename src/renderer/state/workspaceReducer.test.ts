import { describe, expect, it, vi } from "vitest";
import { sampleWorkspace } from "../../shared/sampleData";
import { workspaceReducer } from "./workspaceReducer";

vi.stubGlobal("crypto", {
  randomUUID: () => "new-tile"
});

describe("workspaceReducer", () => {
  it("starts camera tiles at the 1024x768 default viewport", () => {
    expect(sampleWorkspace.defaultViewport).toEqual({ width: 1024, height: 768 });
    expect(sampleWorkspace.tiles[0].viewport).toEqual({ width: 1024, height: 768 });
  });

  it("migrates the old 1280x720 saved default viewport to 1024x768", () => {
    const legacyWorkspace = {
      ...sampleWorkspace,
      defaultViewport: { width: 1280, height: 720 },
      tiles: sampleWorkspace.tiles.map((tile) => ({
        ...tile,
        viewport: { width: 1280, height: 720 }
      }))
    };

    const state = workspaceReducer(sampleWorkspace, {
      type: "hydrateWorkspace",
      workspace: legacyWorkspace
    });

    expect(state.defaultViewport).toEqual({ width: 1024, height: 768 });
    expect(state.tiles[0].viewport).toEqual({ width: 1024, height: 768 });
  });

  it("hydrates a full saved workspace", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "hydrateWorkspace",
      workspace: { ...sampleWorkspace, gridColumns: 5, selectedTileId: "tile-42" }
    });

    expect(state.gridColumns).toBe(5);
    expect(state.selectedTileId).toBe("tile-42");
  });

  it("defaults legacy workspaces to a five-second ping interval", () => {
    const { pingIntervalSeconds: _pingIntervalSeconds, ...legacyWorkspace } =
      sampleWorkspace;

    const state = workspaceReducer(sampleWorkspace, {
      type: "hydrateWorkspace",
      workspace: legacyWorkspace as typeof sampleWorkspace
    });

    expect(state.pingIntervalSeconds).toBe(5);
  });

  it("repairs stale prefix-based URLs when hydrating a saved workspace", () => {
    const { usesListPrefix: _usesListPrefix, ...legacyCamera } = {
      ...sampleWorkspace.cameraLists[0].cameras[0],
      suffix: "4",
      url: "http://192.168.1.41"
    };
    const savedWorkspace = {
      ...sampleWorkspace,
      cameraLists: sampleWorkspace.cameraLists.map((list) =>
        list.id === "list-sample"
          ? {
              ...list,
              defaultPrefix: "http://10.10.20.",
              cameras: [legacyCamera, ...list.cameras.slice(1)]
            }
          : list
      ),
      tiles: sampleWorkspace.tiles.map((tile) =>
        tile.cameraId === "camera-41" ? { ...tile, url: "http://192.168.1.41" } : tile
      )
    };

    const state = workspaceReducer(sampleWorkspace, {
      type: "hydrateWorkspace",
      workspace: savedWorkspace
    });

    expect(state.cameraLists[0].cameras[0]).toMatchObject({
      suffix: "4",
      url: "http://10.10.20.4"
    });
    expect(state.tiles[0]).toMatchObject({
      cameraId: "camera-41",
      url: "http://10.10.20.4"
    });
  });

  it("normalizes bare LAN prefixes and camera URLs when hydrating a saved workspace", () => {
    const savedWorkspace = {
      ...sampleWorkspace,
      cameraLists: sampleWorkspace.cameraLists.map((list) =>
        list.id === "list-sample"
          ? {
              ...list,
              defaultPrefix: "10.20.100.",
              cameras: list.cameras.map((camera, index) =>
                index === 0
                  ? { ...camera, suffix: "2", url: "10.20.100.2", usesListPrefix: true }
                  : camera
              )
            }
          : list
      ),
      tiles: sampleWorkspace.tiles.map((tile) =>
        tile.cameraId === "camera-41" ? { ...tile, url: "10.20.100.2" } : tile
      )
    };

    const state = workspaceReducer(sampleWorkspace, {
      type: "hydrateWorkspace",
      workspace: savedWorkspace
    });

    expect(state.cameraLists[0].defaultPrefix).toBe("http://10.20.100.");
    expect(state.cameraLists[0].cameras[0]).toMatchObject({
      suffix: "2",
      url: "http://10.20.100.2"
    });
    expect(state.tiles[0]).toMatchObject({
      cameraId: "camera-41",
      url: "http://10.20.100.2"
    });
  });

  it("normalizes manual bare LAN camera URLs when hydrating a saved workspace", () => {
    const savedWorkspace = {
      ...sampleWorkspace,
      cameraLists: sampleWorkspace.cameraLists.map((list) =>
        list.id === "list-sample"
          ? {
              ...list,
              cameras: list.cameras.map((camera, index) =>
                index === 0
                  ? { ...camera, url: "10.20.100.99", usesListPrefix: false }
                  : camera
              )
            }
          : list
      ),
      tiles: sampleWorkspace.tiles.map((tile) =>
        tile.cameraId === "camera-41" ? { ...tile, url: "10.20.100.99" } : tile
      )
    };

    const state = workspaceReducer(sampleWorkspace, {
      type: "hydrateWorkspace",
      workspace: savedWorkspace
    });

    expect(state.cameraLists[0].cameras[0]).toMatchObject({
      url: "http://10.20.100.99",
      usesListPrefix: false
    });
    expect(state.tiles[0]).toMatchObject({
      cameraId: "camera-41",
      url: "http://10.20.100.99"
    });
  });

  it("selects a tile", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "selectTile",
      tileId: "tile-42"
    });
    expect(state.selectedTileId).toBe("tile-42");
  });

  it("updates grid columns", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "setGridColumns",
      columns: 5
    });
    expect(state.gridColumns).toBe(5);
  });

  it("updates and normalizes the saved ping interval", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "setPingIntervalSeconds",
      seconds: 12
    });
    const clamped = workspaceReducer(state, {
      type: "setPingIntervalSeconds",
      seconds: 600
    });

    expect(state.pingIntervalSeconds).toBe(12);
    expect(clamped.pingIntervalSeconds).toBe(300);
  });

  it("navigates an unlinked selected tile without changing the camera list", () => {
    const unlinkedWorkspace = {
      ...sampleWorkspace,
      selectedTileId: "tile-unlinked",
      tiles: [
        ...sampleWorkspace.tiles,
        {
          id: "tile-unlinked",
          cameraId: null,
          url: "about:blank",
          title: "about:blank",
          partition: "persist:ditbrowse-job-sample-list-sample",
          viewport: { width: 1280, height: 720 },
          zoom: 1
        }
      ]
    };

    const state = workspaceReducer(unlinkedWorkspace, {
      type: "navigateSelectedTile",
      url: "http://192.168.1.80"
    });

    expect(state.tiles.find((tile) => tile.id === "tile-unlinked")).toMatchObject({
      url: "http://192.168.1.80",
      title: "http://192.168.1.80"
    });
    expect(state.cameraLists[0].cameras[0]).toMatchObject({
      url: "http://192.168.1.01",
      usesListPrefix: true
    });
  });

  it("saves a typed address as a manual URL for the selected prefix-based camera", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "navigateSelectedTile",
      url: "http://192.168.1.80"
    });

    expect(state.cameraLists[0].cameras[0]).toMatchObject({
      suffix: "01",
      url: "http://192.168.1.80",
      usesListPrefix: false
    });
    expect(state.tiles.find((tile) => tile.id === sampleWorkspace.selectedTileId)).toMatchObject({
      cameraId: "camera-41",
      title: "A",
      url: "http://192.168.1.80"
    });
  });

  it("saves a user-typed full path exactly for the selected camera", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "navigateSelectedTile",
      url: "http://10.20.100.107/index.html"
    });

    expect(state.cameraLists[0].cameras[0]).toMatchObject({
      suffix: "01",
      url: "http://10.20.100.107/index.html",
      usesListPrefix: false
    });
    expect(state.tiles.find((tile) => tile.id === sampleWorkspace.selectedTileId)).toMatchObject({
      cameraId: "camera-41",
      title: "A",
      url: "http://10.20.100.107/index.html"
    });
  });

  it("returns the selected manual camera to prefix and suffix URL style", () => {
    const manual = workspaceReducer(sampleWorkspace, {
      type: "navigateSelectedTile",
      url: "http://camera-control.local"
    });

    const state = workspaceReducer(manual, {
      type: "returnSelectedCameraToPrefix"
    });

    expect(state.cameraLists[0].cameras[0]).toMatchObject({
      suffix: "01",
      url: "http://192.168.1.01",
      usesListPrefix: true
    });
    expect(state.tiles.find((tile) => tile.id === sampleWorkspace.selectedTileId)).toMatchObject({
      cameraId: "camera-41",
      title: "A",
      url: "http://192.168.1.01"
    });
  });

  it("opens a new tile", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "openNewTile",
      url: "http://192.168.1.99"
    });
    expect(state.tiles.at(-1)?.url).toBe("http://192.168.1.99");
    expect(state.selectedTileId).toBe(state.tiles.at(-1)?.id);
  });

  it("replaces the active list and creates tiles from imported rows", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "replaceActiveListFromCsv",
      rows: [
        {
          rowNumber: 2,
          name: "Imported A",
          url: "",
          suffix: "90",
          cameraType: "ALEXA 35",
          lens: "50mm",
          displayNote: "Studio",
          notes: "imported"
        }
      ]
    });

    expect(state.cameraLists[0].cameras[0].url).toBe("http://192.168.1.90");
    expect(state.cameraLists[0].cameras[0]).toMatchObject({
      cameraType: "ALEXA 35",
      lens: "50mm",
      displayNote: "Studio"
    });
    expect(state.tiles).toHaveLength(1);
    expect(state.tiles[0].title).toBe("Imported A • ALEXA 35 • 50mm • Studio");
    expect(state.passwordRecords).toEqual([]);
  });

  it("updates selected tile zoom", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "setSelectedTileZoom",
      zoom: 1.13
    });
    expect(state.tiles.find((tile) => tile.id === state.selectedTileId)?.zoom).toBe(1.13);
    expect(state.cameraLists[0].cameras[0].zoomOverride).toBe(1.13);
  });

  it("updates the global zoom for every tile and resets per-camera zoom overrides", () => {
    const customTile = workspaceReducer(sampleWorkspace, {
      type: "setSelectedTileZoom",
      zoom: 1.42
    });

    const state = workspaceReducer(customTile, {
      type: "setGlobalZoom",
      zoom: 0.82
    });

    expect(state.defaultZoom).toBe(0.82);
    expect(state.tiles.every((tile) => tile.zoom === 0.82)).toBe(true);
    expect(
      state.cameraLists.every((list) =>
        list.cameras.every((camera) => camera.zoomOverride === null)
      )
    ).toBe(true);
  });

  it("stores all-tiles zoom as a multiplier without changing individual tile zooms", () => {
    const customTile = workspaceReducer(sampleWorkspace, {
      type: "setSelectedTileZoom",
      zoom: 1.05
    });

    const state = workspaceReducer(sampleWorkspace, {
      type: "setGlobalZoomRelative",
      factor: 1.25
    });

    expect(state.defaultZoom).toBe(1);
    expect(state.globalZoom).toBe(1.25);
    expect(customTile.tiles.find((tile) => tile.id === "tile-41")?.zoom).toBe(1.05);
    expect(
      workspaceReducer(customTile, {
        type: "setGlobalZoomRelative",
        factor: 1.25
      }).tiles.find((tile) => tile.id === "tile-41")?.zoom
    ).toBe(1.05);
    expect(state.tiles.every((tile) => tile.zoom === 1)).toBe(true);
    expect(
      state.cameraLists.every((list) =>
        list.cameras.every((camera) => camera.zoomOverride === null)
      )
    ).toBe(true);
  });

  it("updates selected tile viewport", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "setSelectedTileViewport",
      width: 1920,
      height: 1080
    });
    expect(state.tiles.find((tile) => tile.id === state.selectedTileId)?.viewport).toEqual({
      width: 1920,
      height: 1080
    });
  });

  it("updates the default viewport for default-sized camera tiles without changing camera overrides", () => {
    const withCameraOverride = {
      ...sampleWorkspace,
      cameraLists: sampleWorkspace.cameraLists.map((list) =>
        list.id === "list-sample"
          ? {
              ...list,
              cameras: list.cameras.map((camera) =>
                camera.id === "camera-42"
                  ? { ...camera, viewportOverride: { width: 1920, height: 1080 } }
                  : camera
              )
            }
          : list
      ),
      tiles: sampleWorkspace.tiles.map((tile) =>
        tile.cameraId === "camera-42"
          ? { ...tile, viewport: { width: 1920, height: 1080 } }
          : tile
      )
    };

    const state = workspaceReducer(withCameraOverride, {
      type: "setDefaultViewport",
      width: 1280,
      height: 720
    });

    expect(state.defaultViewport).toEqual({ width: 1280, height: 720 });
    expect(state.tiles.find((tile) => tile.cameraId === "camera-41")?.viewport).toEqual({
      width: 1280,
      height: 720
    });
    expect(state.tiles.find((tile) => tile.cameraId === "camera-42")?.viewport).toEqual({
      width: 1920,
      height: 1080
    });
  });

  it("updates the global viewport for every tile and resets per-camera viewport overrides", () => {
    const withCameraOverride = {
      ...sampleWorkspace,
      cameraLists: sampleWorkspace.cameraLists.map((list) =>
        list.id === "list-sample"
          ? {
              ...list,
              cameras: list.cameras.map((camera) =>
                camera.id === "camera-42"
                  ? { ...camera, viewportOverride: { width: 1920, height: 1080 } }
                  : camera
              )
            }
          : list
      ),
      tiles: sampleWorkspace.tiles.map((tile) =>
        tile.cameraId === "camera-42"
          ? { ...tile, viewport: { width: 1920, height: 1080 } }
          : tile
      )
    };

    const state = workspaceReducer(withCameraOverride, {
      type: "setGlobalViewport",
      width: 1280,
      height: 720
    });

    expect(state.defaultViewport).toEqual({ width: 1280, height: 720 });
    expect(state.tiles.every((tile) => tile.viewport.width === 1280)).toBe(true);
    expect(state.tiles.every((tile) => tile.viewport.height === 720)).toBe(true);
    expect(
      state.cameraLists.every((list) =>
        list.cameras.every((camera) => camera.viewportOverride === null)
      )
    ).toBe(true);
  });

  it("creates a new job with an empty camera list", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "createJobWithList",
      jobName: "New Job",
      listName: "Camera List",
      defaultPrefix: "http://10.0.0."
    });

    expect(state.jobs.at(-1)?.name).toBe("New Job");
    expect(state.cameraLists.at(-1)).toMatchObject({
      name: "Camera List",
      defaultPrefix: "http://10.0.0.",
      cameras: []
    });
    expect(state.tiles).toEqual([]);
    expect(state.selectedTileId).toBeNull();
    expect(state.activeJobId).toBe(state.jobs.at(-1)?.id);
    expect(state.activeCameraListId).toBe(state.cameraLists.at(-1)?.id);
  });

  it("renames the active job", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "updateActiveJobName",
      jobName: "Commercial A"
    });

    expect(state.jobs.find((job) => job.id === sampleWorkspace.activeJobId)?.name).toBe(
      "Commercial A"
    );
  });

  it("deletes the active job and opens the next job list", () => {
    const workspaceWithSecondJob = workspaceReducer(sampleWorkspace, {
      type: "createJobWithList",
      jobName: "Second Job",
      listName: "Second List",
      defaultPrefix: "http://10.0.0."
    });
    const state = workspaceReducer(workspaceWithSecondJob, {
      type: "deleteJob",
      jobId: workspaceWithSecondJob.activeJobId ?? ""
    });

    expect(state.jobs.map((job) => job.name)).toEqual(["Sample Job"]);
    expect(state.activeJobId).toBe("job-sample");
    expect(state.activeCameraListId).toBe("list-sample");
    expect(state.tiles[0]).toMatchObject({
      cameraId: "camera-41",
      url: "http://192.168.1.01"
    });
  });

  it("keeps a blank job available after deleting the only job", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "deleteJob",
      jobId: "job-sample"
    });

    expect(state.jobs).toHaveLength(1);
    expect(state.cameraLists).toHaveLength(1);
    expect(state.jobs[0].name).toBe("New Job");
    expect(state.cameraLists[0].cameras).toEqual([]);
    expect(state.tiles).toEqual([]);
    expect(state.selectedTileId).toBeNull();
  });

  it("selects an existing camera list and loads its cameras into tiles", () => {
    const unloaded = {
      ...sampleWorkspace,
      tiles: [],
      selectedTileId: null,
      activeCameraListId: null
    };
    const state = workspaceReducer(unloaded, {
      type: "selectCameraList",
      cameraListId: "list-sample"
    });

    expect(state.tiles).toHaveLength(12);
    expect(state.tiles[0]).toMatchObject({
      cameraId: "camera-41",
      url: "http://192.168.1.01",
      partition: "persist:ditbrowse-job-sample-list-sample"
    });
  });

  it("updates derived camera, tile, and password URLs when the active list prefix changes", () => {
    const withPassword = {
      ...sampleWorkspace,
      passwordRecords: [
        {
          id: "password-camera-41",
          jobId: "job-sample",
          cameraListId: "list-sample",
          cameraId: "camera-41",
          url: "http://192.168.1.01",
          username: "admin",
          password: "secret"
        }
      ]
    };

    const state = workspaceReducer(withPassword, {
      type: "updateActiveListPrefix",
      defaultPrefix: "http://10.10.20."
    });

    expect(state.cameraLists[0].defaultPrefix).toBe("http://10.10.20.");
    expect(state.cameraLists[0].cameras[0]).toMatchObject({
      suffix: "01",
      url: "http://10.10.20.01"
    });
    expect(state.tiles[0]).toMatchObject({
      cameraId: "camera-41",
      url: "http://10.10.20.01"
    });
    expect(state.passwordRecords[0]).toMatchObject({
      cameraListId: "list-sample",
      url: "http://10.10.20.01"
    });
  });

  it("normalizes a bare LAN prefix before saving it to the active list", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "updateActiveListPrefix",
      defaultPrefix: "10.20.100."
    });

    expect(state.cameraLists[0].defaultPrefix).toBe("http://10.20.100.");
    expect(state.cameraLists[0].cameras[0]).toMatchObject({
      suffix: "01",
      url: "http://10.20.100.01"
    });
    expect(state.tiles[0]).toMatchObject({
      cameraId: "camera-41",
      url: "http://10.20.100.01"
    });
  });

  it("keeps explicit camera URLs when the active list prefix changes", () => {
    const explicit = workspaceReducer(sampleWorkspace, {
      type: "updateCameraEntry",
      cameraId: "camera-41",
      patch: {
        url: "http://camera-control.local"
      }
    });

    const state = workspaceReducer(explicit, {
      type: "updateActiveListPrefix",
      defaultPrefix: "http://10.10.20."
    });

    expect(state.cameraLists[0].cameras[0]).toMatchObject({
      suffix: "01",
      url: "http://camera-control.local"
    });
    expect(state.tiles[0]).toMatchObject({
      cameraId: "camera-41",
      url: "http://camera-control.local"
    });
  });

  it("keeps manually edited IP URLs when the active list prefix changes", () => {
    const explicit = workspaceReducer(sampleWorkspace, {
      type: "updateCameraEntry",
      cameraId: "camera-41",
      patch: {
        url: "http://192.168.1.99"
      }
    });

    const state = workspaceReducer(explicit, {
      type: "updateActiveListPrefix",
      defaultPrefix: "http://10.10.20."
    });

    expect(state.cameraLists[0].cameras[0]).toMatchObject({
      suffix: "01",
      url: "http://192.168.1.99",
      usesListPrefix: false
    });
    expect(state.tiles[0]).toMatchObject({
      cameraId: "camera-41",
      url: "http://192.168.1.99"
    });
  });

  it("keeps non-following camera URLs when the active list prefix changes", () => {
    const notFollowing = workspaceReducer(sampleWorkspace, {
      type: "updateCameraEntry",
      cameraId: "camera-41",
      patch: {
        usesListPrefix: false
      }
    });

    const state = workspaceReducer(notFollowing, {
      type: "updateActiveListPrefix",
      defaultPrefix: "http://10.10.20."
    });

    expect(state.cameraLists[0].cameras[0]).toMatchObject({
      suffix: "01",
      url: "http://192.168.1.01",
      usesListPrefix: false
    });
    expect(state.tiles[0]).toMatchObject({
      cameraId: "camera-41",
      url: "http://192.168.1.01"
    });
  });

  it("recomputes a camera URL when follow prefix is re-enabled", () => {
    const notFollowing = workspaceReducer(sampleWorkspace, {
      type: "updateCameraEntry",
      cameraId: "camera-41",
      patch: {
        usesListPrefix: false
      }
    });
    const renamed = workspaceReducer(notFollowing, {
      type: "updateCameraEntry",
      cameraId: "camera-41",
      patch: {
        suffix: "4"
      }
    });

    const state = workspaceReducer(renamed, {
      type: "updateCameraEntry",
      cameraId: "camera-41",
      patch: {
        usesListPrefix: true
      }
    });

    expect(state.cameraLists[0].cameras[0]).toMatchObject({
      suffix: "04",
      url: "http://192.168.1.04",
      usesListPrefix: true
    });
    expect(state.tiles[0]).toMatchObject({
      cameraId: "camera-41",
      url: "http://192.168.1.04"
    });
  });

  it("repairs stale derived LAN URLs after a previous prefix edit did not update cameras", () => {
    const staleState = {
      ...sampleWorkspace,
      cameraLists: sampleWorkspace.cameraLists.map((list) =>
        list.id === "list-sample" ? { ...list, defaultPrefix: "http://10.10.20." } : list
      )
    };

    const state = workspaceReducer(staleState, {
      type: "updateActiveListPrefix",
      defaultPrefix: "http://172.20.30."
    });

    expect(state.cameraLists[0].cameras[0]).toMatchObject({
      suffix: "01",
      url: "http://172.20.30.01"
    });
    expect(state.tiles[0]).toMatchObject({
      cameraId: "camera-41",
      url: "http://172.20.30.01"
    });
  });

  it("updates a prefix-based camera URL when the camera number changes", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "updateCameraEntry",
      cameraId: "camera-41",
      patch: {
        suffix: "4"
      }
    });

    expect(state.cameraLists[0].cameras[0]).toMatchObject({
      suffix: "04",
      url: "http://192.168.1.04"
    });
    expect(state.tiles[0]).toMatchObject({
      cameraId: "camera-41",
      url: "http://192.168.1.04"
    });
  });

  it("updates a stale prefix-based URL after the camera number changed earlier", () => {
    const staleNumberState = workspaceReducer(sampleWorkspace, {
      type: "updateCameraEntry",
      cameraId: "camera-41",
      patch: {
        suffix: "4"
      }
    });

    const state = workspaceReducer(staleNumberState, {
      type: "updateActiveListPrefix",
      defaultPrefix: "http://10.10.20."
    });

    expect(state.cameraLists[0].cameras[0]).toMatchObject({
      suffix: "04",
      url: "http://10.10.20.04"
    });
    expect(state.tiles[0]).toMatchObject({
      cameraId: "camera-41",
      url: "http://10.10.20.04"
    });
  });

  it("updates an active camera row and its tile", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "updateCameraEntry",
      cameraId: "camera-41",
      patch: {
        name: "A Cam",
        url: "http://10.0.0.41",
        viewportOverride: { width: 1920, height: 1080 },
        zoomOverride: 1.25
      }
    });

    expect(state.cameraLists[0].cameras[0]).toMatchObject({
      name: "A Cam",
      url: "http://10.0.0.41",
      viewportOverride: { width: 1920, height: 1080 },
      zoomOverride: 1.25
    });
    expect(state.tiles[0]).toMatchObject({
      title: "A Cam",
      url: "http://10.0.0.41",
      viewport: { width: 1920, height: 1080 },
      zoom: 1.25
    });
  });

  it("normalizes manually entered bare LAN camera URLs", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "updateCameraEntry",
      cameraId: "camera-41",
      patch: {
        url: "10.20.100.99"
      }
    });

    expect(state.cameraLists[0].cameras[0]).toMatchObject({
      url: "http://10.20.100.99",
      usesListPrefix: false
    });
    expect(state.tiles[0]).toMatchObject({
      cameraId: "camera-41",
      url: "http://10.20.100.99"
    });
  });

  it("shows a server-corrected HTTPS URL live without changing the saved camera base", () => {
    const navigated = workspaceReducer(sampleWorkspace, {
      type: "navigateSelectedTile",
      url: "10.20.100.2"
    });

    const state = workspaceReducer(navigated, {
      type: "commitTileNavigationUrl",
      tileId: "tile-41",
      url: "https://10.20.100.2/login"
    });

    expect(state.cameraLists[0].cameras[0]).toMatchObject({
      suffix: "01",
      url: "http://10.20.100.2",
      usesListPrefix: false
    });
    expect(state.tiles[0]).toMatchObject({
      cameraId: "camera-41",
      title: "A",
      url: "https://10.20.100.2"
    });
  });

  it("shows prefix-following server HTTPS correction live without changing the saved camera URL", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "commitTileNavigationUrl",
      tileId: "tile-41",
      url: "https://192.168.1.01/login"
    });

    expect(state.cameraLists[0].cameras[0]).toMatchObject({
      suffix: "01",
      url: "http://192.168.1.01",
      usesListPrefix: true
    });
    expect(state.tiles[0]).toMatchObject({
      cameraId: "camera-41",
      url: "https://192.168.1.01"
    });
  });

  it("shows camera GUI redirect paths live without changing the saved camera URL", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "commitTileNavigationUrl",
      tileId: "tile-41",
      url: "http://192.168.1.01/rmt.html"
    });

    expect(state.cameraLists[0].cameras[0]).toMatchObject({
      suffix: "01",
      url: "http://192.168.1.01",
      usesListPrefix: true
    });
    expect(state.tiles[0]).toMatchObject({
      cameraId: "camera-41",
      url: "http://192.168.1.01/rmt.html"
    });
  });

  it("shows camera index landing pages live without changing the saved camera URL", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "commitTileNavigationUrl",
      tileId: "tile-41",
      url: "http://10.20.100.107/index.html"
    });

    expect(state.cameraLists[0].cameras[0]).toMatchObject({
      suffix: "01",
      url: "http://192.168.1.01",
      usesListPrefix: true
    });
    expect(state.tiles[0]).toMatchObject({
      cameraId: "camera-41",
      url: "http://10.20.100.107/index.html"
    });
  });

  it("reloads from the saved root after a camera GUI redirect when the prefix changes", () => {
    const veniceState = workspaceReducer(sampleWorkspace, {
      type: "commitTileNavigationUrl",
      tileId: "tile-41",
      url: "http://192.168.1.01/rmt.html"
    });

    const state = workspaceReducer(veniceState, {
      type: "updateActiveListPrefix",
      defaultPrefix: "http://10.20.100."
    });

    expect(state.cameraLists[0].cameras[0]).toMatchObject({
      suffix: "01",
      url: "http://10.20.100.01",
      usesListPrefix: true
    });
    expect(state.tiles[0]).toMatchObject({
      cameraId: "camera-41",
      url: "http://10.20.100.01"
    });
  });

  it("shows transient camera helper paths as root live without changing the saved camera URL", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "commitTileNavigationUrl",
      tileId: "tile-41",
      url: "http://192.168.1.01/text"
    });

    expect(state.cameraLists[0].cameras[0]).toMatchObject({
      suffix: "01",
      url: "http://192.168.1.01",
      usesListPrefix: true
    });
    expect(state.tiles[0]).toMatchObject({
      cameraId: "camera-41",
      url: "http://192.168.1.01"
    });
  });

  it("does not carry transient camera helper paths when a prefix-following camera changes IP range", () => {
    const transientPathState = workspaceReducer(
      {
        ...sampleWorkspace,
        cameraLists: [
          {
            ...sampleWorkspace.cameraLists[0],
            cameras: [
              {
                ...sampleWorkspace.cameraLists[0].cameras[0],
                url: "http://192.168.1.01/text",
                usesListPrefix: true
              },
              ...sampleWorkspace.cameraLists[0].cameras.slice(1)
            ]
          }
        ],
        tiles: [
          {
            ...sampleWorkspace.tiles[0],
            url: "http://192.168.1.01/text"
          },
          ...sampleWorkspace.tiles.slice(1)
        ]
      },
      {
        type: "updateActiveListPrefix",
        defaultPrefix: "http://10.20.100."
      }
    );

    expect(transientPathState.cameraLists[0].cameras[0]).toMatchObject({
      suffix: "01",
      url: "http://10.20.100.01",
      usesListPrefix: true
    });
    expect(transientPathState.tiles[0]).toMatchObject({
      cameraId: "camera-41",
      url: "http://10.20.100.01"
    });
  });

  it("saves a server-corrected URL on an unlinked tile without changing the camera list", () => {
    const unlinkedWorkspace = {
      ...sampleWorkspace,
      selectedTileId: "tile-unlinked",
      tiles: [
        ...sampleWorkspace.tiles,
        {
          id: "tile-unlinked",
          cameraId: null,
          url: "http://10.20.100.2",
          title: "http://10.20.100.2",
          partition: "persist:ditbrowse-job-sample-list-sample",
          viewport: { width: 1280, height: 720 },
          zoom: 1
        }
      ]
    };

    const state = workspaceReducer(unlinkedWorkspace, {
      type: "commitTileNavigationUrl",
      tileId: "tile-unlinked",
      url: "https://10.20.100.2/login"
    });

    expect(state.tiles.at(-1)).toMatchObject({
      cameraId: null,
      title: "https://10.20.100.2",
      url: "https://10.20.100.2"
    });
    expect(state.cameraLists[0].cameras[0]).toMatchObject({
      url: "http://192.168.1.01",
      usesListPrefix: true
    });
  });

  it("updates camera metadata and uses it for tile labels", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "updateCameraEntry",
      cameraId: "camera-41",
      patch: {
        suffix: "4",
        cameraType: "ALEXA 35",
        lens: "50mm",
        displayNote: "Handheld"
      }
    });

    expect(state.cameraLists[0].cameras[0]).toMatchObject({
      suffix: "04",
      cameraType: "ALEXA 35",
      lens: "50mm",
      displayNote: "Handheld"
    });
    expect(state.tiles[0]).toMatchObject({
      cameraId: "camera-41",
      title: "D • ALEXA 35 • 50mm • Handheld"
    });
  });

  it("saves captured webview credentials scoped to the active job, list, and camera", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "saveCapturedCredential",
      tileId: "tile-41",
      url: "http://192.168.1.41/login.html",
      username: "admin",
      password: "secret"
    });

    expect(state.passwordRecords).toEqual([
      {
        id: "password-new-tile",
        jobId: "job-sample",
        cameraListId: "list-sample",
        cameraId: "camera-41",
        url: "http://192.168.1.41",
        username: "admin",
        password: "secret"
      }
    ]);
  });

  it("saves and deletes global credential presets", () => {
    const withPreset = workspaceReducer(sampleWorkspace, {
      type: "addCredentialPreset",
      username: " admin ",
      password: "ABCD1234",
      cameraType: " VENICE 2 "
    });

    expect(withPreset.credentialPresets).toEqual([
      {
        id: "credential-preset-new-tile",
        username: "admin",
        password: "ABCD1234",
        cameraType: "VENICE 2"
      }
    ]);

    const duplicate = workspaceReducer(withPreset, {
      type: "addCredentialPreset",
      username: "admin",
      password: "ABCD1234",
      cameraType: "VENICE 2"
    });

    expect(duplicate.credentialPresets).toHaveLength(1);

    const deleted = workspaceReducer(duplicate, {
      type: "deleteCredentialPreset",
      presetId: "credential-preset-new-tile"
    });

    expect(deleted.credentialPresets).toEqual([]);
  });

  it("replaces duplicate saved credentials for the same camera when a new password is saved", () => {
    const withDuplicates = {
      ...sampleWorkspace,
      passwordRecords: [
        {
          id: "password-old-camera",
          jobId: "job-sample",
          cameraListId: "list-sample",
          cameraId: "camera-41",
          url: "http://192.168.1.41",
          username: "admin",
          password: "old"
        },
        {
          id: "password-old-origin",
          jobId: "job-sample",
          cameraListId: "list-sample",
          cameraId: null,
          url: "http://192.168.1.41",
          username: "admin",
          password: "older"
        }
      ]
    };

    const state = workspaceReducer(withDuplicates, {
      type: "saveCapturedCredential",
      tileId: "tile-41",
      url: "http://192.168.1.41/login.html",
      username: "admin",
      password: "new"
    });

    expect(state.passwordRecords).toEqual([
      {
        id: "password-old-origin",
        jobId: "job-sample",
        cameraListId: "list-sample",
        cameraId: "camera-41",
        url: "http://192.168.1.41",
        username: "admin",
        password: "new"
      }
    ]);
  });

  it("deletes a saved password record by id", () => {
    const withPassword = {
      ...sampleWorkspace,
      passwordRecords: [
        {
          id: "password-camera-41",
          jobId: "job-sample",
          cameraListId: "list-sample",
          cameraId: "camera-41",
          url: "http://192.168.1.41",
          username: "admin",
          password: "secret"
        }
      ]
    };

    const state = workspaceReducer(withPassword, {
      type: "deletePasswordRecord",
      passwordRecordId: "password-camera-41"
    });

    expect(state.passwordRecords).toEqual([]);
  });

  it("forgets a captured camera credential scope after the active workspace changes", () => {
    const state = workspaceReducer(
      {
        ...sampleWorkspace,
        activeJobId: "job-current",
        activeCameraListId: "list-current",
        passwordRecords: [
          {
            id: "captured-linked",
            jobId: "job-original",
            cameraListId: "list-original",
            cameraId: "camera-41",
            url: "http://10.20.100.109",
            username: "admin",
            password: "linked"
          },
          {
            id: "captured-legacy",
            jobId: "job-original",
            cameraListId: "list-original",
            cameraId: null,
            url: "http://10.20.100.109/login.html",
            username: "admin",
            password: "legacy"
          },
          {
            id: "shared-origin-other-camera",
            jobId: "job-original",
            cameraListId: "list-original",
            cameraId: "camera-42",
            url: "http://10.20.100.109",
            username: "admin",
            password: "other-camera"
          },
          {
            id: "current-scope",
            jobId: "job-current",
            cameraListId: "list-current",
            cameraId: "camera-41",
            url: "http://10.20.100.109",
            username: "admin",
            password: "current"
          }
        ]
      },
      {
        type: "forgetCameraCredential",
        jobId: "job-original",
        cameraListId: "list-original",
        cameraId: "camera-41",
        url: "http://10.20.100.109/rmt.html"
      }
    );

    expect(state.passwordRecords.map((record) => record.id)).toEqual([
      "shared-origin-other-camera",
      "current-scope"
    ]);
  });

  it("forgets a captured camera-list credential scope after the active workspace changes", () => {
    const state = workspaceReducer(
      {
        ...sampleWorkspace,
        activeJobId: "job-current",
        activeCameraListId: "list-current",
        passwordRecords: [
          {
            id: "original-linked",
            jobId: "job-original",
            cameraListId: "list-original",
            cameraId: "camera-41",
            url: "http://10.20.100.109",
            username: "admin",
            password: "linked"
          },
          {
            id: "original-legacy",
            jobId: "job-original",
            cameraListId: "list-original",
            cameraId: null,
            url: "http://10.20.100.110",
            username: "admin",
            password: "legacy"
          },
          {
            id: "current-scope",
            jobId: "job-current",
            cameraListId: "list-current",
            cameraId: "camera-41",
            url: "http://10.20.100.109",
            username: "admin",
            password: "current"
          }
        ]
      },
      {
        type: "forgetCameraListCredentials",
        jobId: "job-original",
        cameraListId: "list-original"
      }
    );

    expect(state.passwordRecords.map((record) => record.id)).toEqual(["current-scope"]);
  });

  it("discards stale saved credentials for a camera after auth retry failure", () => {
    const withPassword = {
      ...sampleWorkspace,
      passwordRecords: [
        {
          id: "password-stale",
          jobId: "job-sample",
          cameraListId: "list-sample",
          cameraId: "camera-41",
          url: "http://192.168.1.41",
          username: "admin",
          password: "old"
        }
      ]
    };

    const state = workspaceReducer(withPassword, {
      type: "discardTileCredential",
      tileId: "tile-41"
    });

    expect(state.passwordRecords).toEqual([]);
  });

  it("adds a camera row to the active list and grid", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "addCameraEntry"
    });

    expect(state.cameraLists[0].cameras.at(-1)).toMatchObject({
      id: "camera-new-tile",
      name: "M",
      url: "http://192.168.1.13",
      suffix: "13"
    });
    expect(state.tiles.at(-1)).toMatchObject({
      cameraId: "camera-new-tile",
      title: "M",
      url: "http://192.168.1.13"
    });
  });

  it("adds camera ZA after camera Z", () => {
    const cameras = Array.from({ length: 26 }, (_, index) => {
      const number = String(index + 1).padStart(2, "0");
      const name = String.fromCharCode(65 + index);
      return {
        ...sampleWorkspace.cameraLists[0].cameras[0],
        id: `camera-${number}`,
        name,
        suffix: number,
        url: `http://192.168.1.${number}`
      };
    });
    const fullAlphabet = {
      ...sampleWorkspace,
      cameraLists: sampleWorkspace.cameraLists.map((list) =>
        list.id === "list-sample" ? { ...list, cameras } : list
      )
    };

    const state = workspaceReducer(fullAlphabet, { type: "addCameraEntry" });

    expect(state.cameraLists[0].cameras.at(-1)).toMatchObject({
      name: "ZA",
      suffix: "27",
      url: "http://192.168.1.27"
    });
  });

  it("deletes a camera row from the active list, grid, and saved passwords", () => {
    const withPassword = {
      ...sampleWorkspace,
      selectedTileId: "tile-42",
      passwordRecords: [
        {
          id: "password-42",
          jobId: "job-sample",
          cameraListId: "list-sample",
          cameraId: "camera-42",
          url: "http://192.168.1.42",
          username: "admin",
          password: "secret"
        }
      ]
    };

    const state = workspaceReducer(withPassword, {
      type: "deleteCameraEntry",
      cameraId: "camera-42"
    });

    expect(state.cameraLists[0].cameras.map((camera) => camera.id)).not.toContain("camera-42");
    expect(state.tiles.map((tile) => tile.cameraId)).not.toContain("camera-42");
    expect(state.passwordRecords).toEqual([]);
    expect(state.selectedTileId).toBe("tile-43");
  });

  it("moves camera tabs and updates the saved camera-list order", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "moveTile",
      tileId: "tile-42",
      direction: "left"
    });

    expect(state.tiles.slice(0, 2).map((tile) => tile.id)).toEqual(["tile-42", "tile-41"]);
    expect(state.cameraLists[0].cameras.slice(0, 2).map((camera) => camera.id)).toEqual([
      "camera-42",
      "camera-41"
    ]);
  });

  it("drags a camera tab to an absolute index while keeping manual tabs in the same order", () => {
    const manualTile = {
      id: "tile-manual",
      cameraId: null,
      url: "about:blank",
      title: "about:blank",
      partition: "persist:ditbrowse-job-sample-list-sample",
      viewport: { width: 1024, height: 768 },
      zoom: 1
    };
    const mixedWorkspace = {
      ...sampleWorkspace,
      tiles: [sampleWorkspace.tiles[0], manualTile, ...sampleWorkspace.tiles.slice(1)]
    };

    const state = workspaceReducer(mixedWorkspace, {
      type: "moveTileToIndex",
      tileId: "tile-43",
      toIndex: 0
    });

    expect(state.tiles.slice(0, 4).map((tile) => tile.id)).toEqual([
      "tile-43",
      "tile-41",
      "tile-manual",
      "tile-42"
    ]);
    expect(state.cameraLists[0].cameras.slice(0, 3).map((camera) => camera.id)).toEqual([
      "camera-43",
      "camera-41",
      "camera-42"
    ]);
  });

  it("moves camera-list rows and reorders the matching tabs", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "moveCameraEntry",
      cameraId: "camera-43",
      toIndex: 0
    });

    expect(state.cameraLists[0].cameras.slice(0, 3).map((camera) => camera.id)).toEqual([
      "camera-43",
      "camera-41",
      "camera-42"
    ]);
    expect(state.tiles.slice(0, 3).map((tile) => tile.cameraId)).toEqual([
      "camera-43",
      "camera-41",
      "camera-42"
    ]);
  });

  it("saves an edited active list draft and reconciles tile order without replacing manual tabs", () => {
    const manualTile = {
      id: "tile-manual",
      cameraId: null,
      url: "about:blank",
      title: "about:blank",
      partition: "persist:ditbrowse-job-sample-list-sample",
      viewport: { width: 1024, height: 768 },
      zoom: 1
    };
    const mixedWorkspace = {
      ...sampleWorkspace,
      tiles: [sampleWorkspace.tiles[0], manualTile, ...sampleWorkspace.tiles.slice(1)]
    };
    const draftList = {
      ...sampleWorkspace.cameraLists[0],
      defaultPrefix: "10.20.100.",
      cameras: [
        { ...sampleWorkspace.cameraLists[0].cameras[2], suffix: "3", usesListPrefix: true },
        { ...sampleWorkspace.cameraLists[0].cameras[0], suffix: "1", usesListPrefix: true }
      ]
    };

    const state = workspaceReducer(mixedWorkspace, {
      type: "saveActiveCameraListDraft",
      list: draftList
    });

    expect(state.cameraLists[0].defaultPrefix).toBe("http://10.20.100.");
    expect(state.cameraLists[0].cameras.map((camera) => camera.id)).toEqual([
      "camera-43",
      "camera-41"
    ]);
    expect(state.cameraLists[0].cameras.map((camera) => camera.url)).toEqual([
      "http://10.20.100.03",
      "http://10.20.100.01"
    ]);
    expect(state.tiles.map((tile) => tile.id)).toEqual(["tile-43", "tile-manual", "tile-41"]);
    expect(state.passwordRecords).toEqual([]);
  });

  it("closes a non-selected tile without changing the saved camera-list order", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "closeTile",
      tileId: "tile-42"
    });

    expect(state.tiles.map((tile) => tile.id)).not.toContain("tile-42");
    expect(state.selectedTileId).toBe("tile-41");
    expect(state.cameraLists[0].cameras.map((camera) => camera.id)).toContain("camera-42");
  });

  it("selects the next tile when closing the selected tile", () => {
    const state = workspaceReducer(sampleWorkspace, {
      type: "closeTile",
      tileId: "tile-41"
    });

    expect(state.tiles[0]).toMatchObject({
      id: "tile-42",
      cameraId: "camera-42"
    });
    expect(state.selectedTileId).toBe("tile-42");
  });

  it("selects the previous tile when closing the selected final tile", () => {
    const selectedLast = {
      ...sampleWorkspace,
      selectedTileId: "tile-52"
    };

    const state = workspaceReducer(selectedLast, {
      type: "closeTile",
      tileId: "tile-52"
    });

    expect(state.tiles.at(-1)).toMatchObject({
      id: "tile-51",
      cameraId: "camera-51"
    });
    expect(state.selectedTileId).toBe("tile-51");
  });

  it("clears the selection when closing the last remaining tile", () => {
    const oneTile = {
      ...sampleWorkspace,
      selectedTileId: "tile-41",
      tiles: [sampleWorkspace.tiles[0]]
    };

    const state = workspaceReducer(oneTile, {
      type: "closeTile",
      tileId: "tile-41"
    });

    expect(state.tiles).toEqual([]);
    expect(state.selectedTileId).toBeNull();
    expect(state.cameraLists[0].cameras).toHaveLength(12);
  });

  it("resets selected tile zoom and viewport to defaults", () => {
    const zoomed = workspaceReducer(sampleWorkspace, {
      type: "setSelectedTileZoom",
      zoom: 1.5
    });
    const resized = workspaceReducer(zoomed, {
      type: "setSelectedTileViewport",
      width: 1920,
      height: 1080
    });
    const reset = workspaceReducer(resized, { type: "resetSelectedTileScale" });

    expect(reset.tiles[0]).toMatchObject({
      zoom: 1,
      viewport: { width: 1024, height: 768 }
    });
  });

  it("resets the grid to active list order", () => {
    const moved = {
      ...sampleWorkspace,
      tiles: [sampleWorkspace.tiles[1], sampleWorkspace.tiles[0], ...sampleWorkspace.tiles.slice(2)]
    };
    const reset = workspaceReducer(moved, { type: "resetGridToListOrder" });

    expect(reset.tiles[0]).toMatchObject({
      cameraId: "camera-41",
      url: "http://192.168.1.01"
    });
  });
});
