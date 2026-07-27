import { beforeEach, describe, expect, it, vi } from "vitest";
import { sampleWorkspace } from "../../shared/sampleData";
import type { WorkspaceState } from "../../shared/types";
import {
  loadWorkspace,
  resetCameraSessionData,
  resetListSessionData
} from "./workspaceStorage";

function cloneWorkspace(workspace: WorkspaceState): WorkspaceState {
  return JSON.parse(JSON.stringify(workspace)) as WorkspaceState;
}

describe("workspaceStorage", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: {
        getItem: vi.fn((key: string) => values.get(key) ?? null),
        setItem: vi.fn((key: string, value: string) => values.set(key, value)),
        removeItem: vi.fn((key: string) => values.delete(key)),
        clear: vi.fn(() => values.clear())
      }
    });
    window.ditbrowse = { version: "test" };
  });

  it("migrates fallback localStorage into Electron storage when Electron only has the sample workspace", async () => {
    const fallbackWorkspace = cloneWorkspace(sampleWorkspace);
    fallbackWorkspace.cameraLists[0].defaultPrefix = "http://10.20.100.";
    fallbackWorkspace.cameraLists[0].cameras[0].url = "http://10.20.100.1";
    const saveWorkspace = vi.fn();
    window.localStorage.setItem("ditbrowse-workspace", JSON.stringify(fallbackWorkspace));
    window.ditbrowse = {
      version: "test",
      loadWorkspace: vi.fn(async () => cloneWorkspace(sampleWorkspace)),
      saveWorkspace
    };

    const loadedWorkspace = await loadWorkspace();

    expect(loadedWorkspace).toEqual(fallbackWorkspace);
    expect(saveWorkspace).toHaveBeenCalledWith(fallbackWorkspace);
  });

  it("keeps the Electron workspace when it already has user data", async () => {
    const electronWorkspace = cloneWorkspace(sampleWorkspace);
    electronWorkspace.cameraLists[0].defaultPrefix = "http://172.16.10.";
    const fallbackWorkspace = cloneWorkspace(sampleWorkspace);
    fallbackWorkspace.cameraLists[0].defaultPrefix = "http://10.20.100.";
    const saveWorkspace = vi.fn();
    window.localStorage.setItem("ditbrowse-workspace", JSON.stringify(fallbackWorkspace));
    window.ditbrowse = {
      version: "test",
      loadWorkspace: vi.fn(async () => electronWorkspace),
      saveWorkspace
    };

    const loadedWorkspace = await loadWorkspace();

    expect(loadedWorkspace).toEqual(electronWorkspace);
    expect(saveWorkspace).not.toHaveBeenCalled();
  });

  it("routes camera and list reset requests through Electron", async () => {
    const resetCamera = vi.fn(async () => undefined);
    const resetList = vi.fn(async () => undefined);
    window.ditbrowse = {
      version: "test",
      resetCameraSessionData: resetCamera,
      resetListSessionData: resetList
    };

    await resetCameraSessionData("persist:list", "http://10.20.100.108");
    await resetListSessionData("persist:list");

    expect(resetCamera).toHaveBeenCalledWith("persist:list", "http://10.20.100.108");
    expect(resetList).toHaveBeenCalledWith("persist:list");
  });
});
