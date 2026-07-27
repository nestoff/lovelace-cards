import { describe, expect, it, vi } from "vitest";
import {
  buildPingCommand,
  normalizePingHost,
  parsePingLatency,
  pingHost
} from "./hostPing";

describe("hostPing", () => {
  it("uses one 16-byte packet with a one-second wait", () => {
    expect(buildPingCommand("10.20.100.108")).toEqual({
      file: "/sbin/ping",
      args: ["-n", "-c", "1", "-W", "1000", "-s", "16", "10.20.100.108"]
    });
  });

  it("accepts IPv4 and DNS hosts while rejecting command-like and IPv6 targets", () => {
    expect(normalizePingHost("10.20.100.108")).toBe("10.20.100.108");
    expect(normalizePingHost("Camera-1.local.")).toBe("camera-1.local");
    expect(normalizePingHost("-c 99")).toBeNull();
    expect(normalizePingHost("camera.local/path")).toBeNull();
    expect(normalizePingHost("::1")).toBeNull();
  });

  it("parses exact and sub-millisecond round-trip values", () => {
    expect(
      parsePingLatency(
        "24 bytes from 10.20.100.108: icmp_seq=0 ttl=64 time=4.27 ms"
      )
    ).toBe(4.27);
    expect(parsePingLatency("24 bytes from 127.0.0.1: time<1 ms")).toBe(0.5);
    expect(parsePingLatency("1 packets transmitted, 1 packets received")).toBeNull();
  });

  it("reports parsed round-trip latency", async () => {
    const run = vi.fn(async () =>
      Promise.resolve("24 bytes from 10.20.100.108: icmp_seq=0 ttl=64 time=4.27 ms")
    );

    await expect(pingHost("10.20.100.108", run, () => 1234)).resolves.toEqual({
      host: "10.20.100.108",
      reachable: true,
      latencyMs: 4.27,
      checkedAt: 1234
    });
    expect(run).toHaveBeenCalledWith(
      "/sbin/ping",
      ["-n", "-c", "1", "-W", "1000", "-s", "16", "10.20.100.108"]
    );
  });

  it("reports an unreachable host without throwing", async () => {
    const run = vi.fn(async () => Promise.reject(new Error("timeout")));

    await expect(pingHost("10.20.100.108", run, () => 1234)).resolves.toEqual({
      host: "10.20.100.108",
      reachable: false,
      latencyMs: null,
      checkedAt: 1234
    });
  });

  it("never invokes the command runner for an invalid target", async () => {
    const run = vi.fn(async () => Promise.resolve(""));

    await expect(pingHost("-c 99", run, () => 1234)).resolves.toEqual({
      host: "-c 99",
      reachable: false,
      latencyMs: null,
      checkedAt: 1234
    });
    expect(run).not.toHaveBeenCalled();
  });
});
