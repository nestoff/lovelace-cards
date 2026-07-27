import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  clearData: vi.fn(async () => undefined),
  clearAuthCache: vi.fn(async () => undefined),
  closeAllConnections: vi.fn(async () => undefined),
  fromPartition: vi.fn()
}));

mocks.fromPartition.mockReturnValue({
  clearData: mocks.clearData,
  clearAuthCache: mocks.clearAuthCache,
  closeAllConnections: mocks.closeAllConnections
});

vi.mock("electron", () => ({ session: { fromPartition: mocks.fromPartition } }));

import { resetCameraSessionData, resetListSessionData } from "./session";

describe("session reset", () => {
  beforeEach(() => vi.clearAllMocks());

  it("clears thorough origin data and partition HTTP auth for one camera", async () => {
    await resetCameraSessionData("persist:list", "http://10.20.100.108");

    expect(mocks.fromPartition).toHaveBeenCalledWith("persist:list");
    expect(mocks.clearData).toHaveBeenCalledWith({
      origins: ["http://10.20.100.108"],
      dataTypes: [
        "backgroundFetch",
        "cache",
        "cookies",
        "fileSystems",
        "indexedDB",
        "localStorage",
        "serviceWorkers",
        "webSQL"
      ],
      avoidClosingConnections: false
    });
    expect(mocks.clearAuthCache).toHaveBeenCalledOnce();
    expect(mocks.closeAllConnections).not.toHaveBeenCalled();
  });

  it("clears all list data, authentication, and connections", async () => {
    await resetListSessionData("persist:list");

    expect(mocks.clearData).toHaveBeenCalledWith({
      dataTypes: [
        "backgroundFetch",
        "cache",
        "cookies",
        "fileSystems",
        "indexedDB",
        "localStorage",
        "serviceWorkers",
        "webSQL"
      ],
      avoidClosingConnections: false
    });
    expect(mocks.clearAuthCache).toHaveBeenCalledOnce();
    expect(mocks.closeAllConnections).toHaveBeenCalledOnce();
  });
});
