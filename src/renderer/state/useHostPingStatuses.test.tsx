import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { HostPingResult } from "../../shared/hostPing";
import { HOST_PING_INTERVAL_MS, useHostPingStatuses } from "./useHostPingStatuses";

function deferred<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((promiseResolve) => {
    resolve = promiseResolve;
  });
  return { promise, resolve };
}

function onlineResult(host: string, latencyMs = 3.5): HostPingResult {
  return {
    host,
    reachable: true,
    latencyMs,
    checkedAt: 100
  };
}

describe("useHostPingStatuses", () => {
  beforeEach(() => {
    window.ditbrowse = { version: "test" };
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("pings each unique base host immediately", async () => {
    const pingHost = vi.fn(async (host: string) => onlineResult(host));
    window.ditbrowse.pingHost = pingHost;

    const { result } = renderHook(() =>
      useHostPingStatuses([
        "http://10.20.100.101/rmt.html",
        "http://10.20.100.101/index",
        "https://10.20.100.102:8443/controls"
      ])
    );

    await waitFor(() => expect(pingHost).toHaveBeenCalledTimes(2));
    expect(pingHost).toHaveBeenCalledWith("10.20.100.101");
    expect(pingHost).toHaveBeenCalledWith("10.20.100.102");
    await waitFor(() =>
      expect(result.current.get("10.20.100.101")).toMatchObject({
        state: "online",
        latencyMs: 3.5
      })
    );
  });

  it("refreshes after five seconds without overlapping a running cycle", async () => {
    vi.useFakeTimers();
    const firstCheck = deferred<HostPingResult>();
    const pingHost = vi
      .fn<(host: string) => Promise<HostPingResult>>()
      .mockImplementationOnce(() => firstCheck.promise)
      .mockImplementation(async (host) => onlineResult(host, 4.5));
    window.ditbrowse.pingHost = pingHost;

    renderHook(() => useHostPingStatuses(["http://10.20.100.101/rmt.html"]));
    expect(pingHost).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTimeAsync(HOST_PING_INTERVAL_MS));
    expect(pingHost).toHaveBeenCalledTimes(1);

    firstCheck.resolve(onlineResult("10.20.100.101"));
    await act(async () => {
      await firstCheck.promise;
    });
    await act(async () => vi.advanceTimersByTimeAsync(HOST_PING_INTERVAL_MS));
    expect(pingHost).toHaveBeenCalledTimes(2);
  });

  it("uses the configured interval for later checks", async () => {
    vi.useFakeTimers();
    const pingHost = vi.fn(async (host: string) => onlineResult(host));
    window.ditbrowse.pingHost = pingHost;

    renderHook(() =>
      useHostPingStatuses(["http://10.20.100.101/rmt.html"], 12_000)
    );
    await act(async () => Promise.resolve());
    expect(pingHost).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTimeAsync(11_999));
    expect(pingHost).toHaveBeenCalledTimes(1);

    await act(async () => vi.advanceTimersByTimeAsync(1));
    expect(pingHost).toHaveBeenCalledTimes(2);
  });

  it("maps rejected checks to offline", async () => {
    window.ditbrowse.pingHost = vi.fn(async () => Promise.reject(new Error("IPC failed")));

    const { result } = renderHook(() =>
      useHostPingStatuses(["http://10.20.100.105/rmt.html"])
    );

    await waitFor(() =>
      expect(result.current.get("10.20.100.105")).toMatchObject({
        state: "offline",
        reachable: false,
        latencyMs: null,
        offlineSince: expect.any(Number)
      })
    );
  });

  it("preserves the start of a continuous offline period and resets after recovery", async () => {
    vi.useFakeTimers();
    const results: HostPingResult[] = [
      { host: "10.20.100.105", reachable: false, latencyMs: null, checkedAt: 100 },
      { host: "10.20.100.105", reachable: false, latencyMs: null, checkedAt: 5_100 },
      { host: "10.20.100.105", reachable: true, latencyMs: 4, checkedAt: 10_100 },
      { host: "10.20.100.105", reachable: false, latencyMs: null, checkedAt: 15_100 }
    ];
    window.ditbrowse.pingHost = vi.fn(async () => results.shift()!);

    const { result } = renderHook(() =>
      useHostPingStatuses(["http://10.20.100.105/rmt.html"])
    );
    await act(async () => Promise.resolve());
    expect(result.current.get("10.20.100.105")).toMatchObject({
      state: "offline",
      offlineSince: 100
    });

    await act(async () => vi.advanceTimersByTimeAsync(HOST_PING_INTERVAL_MS));
    expect(result.current.get("10.20.100.105")).toMatchObject({
      state: "offline",
      offlineSince: 100,
      checkedAt: 5_100
    });

    await act(async () => vi.advanceTimersByTimeAsync(HOST_PING_INTERVAL_MS));
    expect(result.current.get("10.20.100.105")).toMatchObject({ state: "online" });

    await act(async () => vi.advanceTimersByTimeAsync(HOST_PING_INTERVAL_MS));
    expect(result.current.get("10.20.100.105")).toMatchObject({
      state: "offline",
      offlineSince: 15_100
    });
  });

  it("ignores a stale result after the camera host changes", async () => {
    const oldCheck = deferred<HostPingResult>();
    window.ditbrowse.pingHost = vi.fn(async (host) => {
      if (host === "10.20.100.101") {
        return oldCheck.promise;
      }
      return onlineResult(host, 7.5);
    });

    const { result, rerender } = renderHook(
      ({ urls }: { urls: string[] }) => useHostPingStatuses(urls),
      { initialProps: { urls: ["http://10.20.100.101/rmt.html"] } }
    );

    rerender({ urls: ["http://10.20.100.102/index"] });
    await waitFor(() =>
      expect(result.current.get("10.20.100.102")).toMatchObject({
        state: "online",
        latencyMs: 7.5
      })
    );

    oldCheck.resolve(onlineResult("10.20.100.101", 1.5));
    await act(async () => {
      await oldCheck.promise;
    });

    expect(result.current.has("10.20.100.101")).toBe(false);
    expect(result.current.get("10.20.100.102")).toMatchObject({ latencyMs: 7.5 });
  });

  it("does not start polling when the Electron ping bridge is unavailable", async () => {
    vi.useFakeTimers();
    const { result } = renderHook(() =>
      useHostPingStatuses(["http://10.20.100.101/rmt.html"])
    );

    await act(async () => vi.advanceTimersByTimeAsync(HOST_PING_INTERVAL_MS * 2));
    expect(result.current.size).toBe(0);
  });
});
